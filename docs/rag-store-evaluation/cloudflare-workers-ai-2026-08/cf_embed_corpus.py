#!/usr/bin/env python3
"""Full-corpus embedding via Cloudflare Workers AI (@cf/qwen/qwen3-embedding-0.6b).

Design follows the failures measured in
docs/rag-store-evaluation/cloudflare-workers-ai-2026-08/report.md:

  - Batches are budgeted by CHARACTERS, not item count: the context limit is a
    per-REQUEST total across the batch, and a fixed item count works fine until
    it meets a run of large chunks. On a 400 the batch is split and retried.
  - 400 is deterministic (too big -> split); 429/5xx are transient (back off and
    retry honouring retry-after). Conflating them either wedges the run or
    silently loses chunks.
  - The free allocation is 10,000 neurons/day resetting 00:00 UTC, so the run
    self-limits against a locally tracked daily ledger and exits cleanly when
    the budget is spent. Re-running resumes.
  - Every vector is validated (dimension, finiteness, unit norm) before it is
    written. A silently-wrong vector is worse than a missing one.
  - Output is appended per batch, so an interruption at any point costs at most
    one batch. Resume skips work already on disk.

Lives on /mnt/d (durable) rather than the session scratchpad, which has been
observed to be wiped across session boundaries.
"""
import json
import math
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

ENV = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/.env.local"
BASE = "/mnt/d/uetgpt_corpus_v1/embeddings"
CHUNKS = f"{BASE}/all_chunks.jsonl"
OUT = f"{BASE}/cf_embeddings.jsonl"
FAILED = f"{BASE}/cf_embed_failures.jsonl"
STATE = f"{BASE}/cf_embed_state.json"

MODEL = "@cf/qwen/qwen3-embedding-0.6b"
DIM = 1024

# qwen3 400s on a 50,000-char batch; 20k leaves margin for token-density
# variation (this corpus runs ~1.6 chars/token, far denser than the usual ~4).
CHAR_BUDGET = 20_000
PACE_S = 1.2
DAILY_NEURON_BUDGET = 9_500   # of 10,000, leaving headroom
NORM_TOLERANCE = 0.05


LOCK = f"{BASE}/cf_embed.lock"


def acquire_lock():
    """Refuse to start if another instance is already running.

    Learned the hard way: two concurrent instances both appended to the output
    and both raced on the neuron ledger, producing 979 duplicate rows and ~819
    neurons of wasted free-tier allocation. Append-only output plus a shared
    budget ledger makes concurrency actively harmful, so this is enforced
    rather than merely documented.

    A stale lock (process no longer alive) is reclaimed automatically so a
    hard kill doesn't wedge the pipeline.
    """
    if os.path.exists(LOCK):
        try:
            with open(LOCK) as f:
                pid = int(f.read().strip())
            os.kill(pid, 0)          # signal 0 = liveness probe, no signal sent
        except (ValueError, ProcessLookupError, PermissionError, OSError):
            print(f"reclaiming stale lock at {LOCK}")
        else:
            sys.exit(f"another instance is already running (pid {pid}); "
                     f"refusing to start. Remove {LOCK} only if that is wrong.")
    with open(LOCK, "w") as f:
        f.write(str(os.getpid()))


def release_lock():
    try:
        os.remove(LOCK)
    except FileNotFoundError:
        pass


def read_env():
    v = {}
    with open(ENV) as f:
        for line in f:
            line = line.strip()
            if line.startswith("CLOUDFLARE_ACCOUNT_ID="):
                v["account"] = line.split("=", 1)[1]
            elif line.startswith("CLOUDFLARE_API_TOKEN="):
                v["token"] = line.split("=", 1)[1]
    if not v.get("account") or not v.get("token"):
        sys.exit("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN missing")
    return v


def today_utc():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def load_state():
    """Neuron ledger for the current UTC day. Cloudflare resets the free
    allocation at 00:00 UTC, so a date change zeroes the counter."""
    if os.path.exists(STATE):
        with open(STATE) as f:
            s = json.load(f)
        if s.get("date") == today_utc():
            return s
    return {"date": today_utc(), "neurons": 0.0}


def save_state(state):
    tmp = STATE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f)
    os.replace(tmp, STATE)      # atomic; a crash mid-write can't corrupt it


def post(account, token, model, texts, max_retries=7):
    """Returns (vectors, neurons). Raises HTTPError(400) for the caller to
    split; retries transient failures with exponential backoff."""
    url = f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}"
    delay = 2.0
    for attempt in range(max_retries):
        req = urllib.request.Request(
            url, data=json.dumps({"text": texts}).encode(),
            headers={"Authorization": f"Bearer {token}",
                     "Content-Type": "application/json"},
            method="POST")
        try:
            with urllib.request.urlopen(req, timeout=240) as r:
                neurons = float(r.headers.get("cf-ai-neurons") or 0)
                res = json.loads(r.read().decode())["result"]
            for k in ("data", "embeddings", "vectors"):
                if isinstance(res.get(k), list):
                    return res[k], neurons
            raise RuntimeError(f"unexpected response shape: {list(res)}")
        except urllib.error.HTTPError as e:
            if e.code == 400:
                raise
            if attempt == max_retries - 1:
                raise
            ra = e.headers.get("retry-after")
            wait = float(ra) if ra else delay
            print(f"    HTTP {e.code}; backoff {wait:.0f}s "
                  f"({attempt + 1}/{max_retries})", flush=True)
            time.sleep(wait)
            delay = min(delay * 2, 120)
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            if attempt == max_retries - 1:
                raise
            print(f"    network error ({e}); backoff {delay:.0f}s", flush=True)
            time.sleep(delay)
            delay = min(delay * 2, 120)
    raise RuntimeError("retries exhausted")


def valid_vector(v):
    """A wrong vector is worse than a missing one - it fails silently at query
    time. Check shape, finiteness, and unit norm (this model returns
    L2-normalized output)."""
    if not isinstance(v, list) or len(v) != DIM:
        return False, f"dim {len(v) if isinstance(v, list) else '?'} != {DIM}"
    if not all(isinstance(x, (int, float)) and math.isfinite(x) for x in v):
        return False, "non-finite component"
    norm = math.sqrt(sum(x * x for x in v))
    if abs(norm - 1.0) > NORM_TOLERANCE:
        return False, f"norm {norm:.4f} not ~1.0"
    return True, None


def load_done():
    """Resume set: identities already embedded and on disk."""
    done = set()
    if not os.path.exists(OUT):
        return done
    with open(OUT) as f:
        for line in f:
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue        # tolerate a torn final line from a hard kill
            done.add(f"{d['documentId']}:{d['chunkKey']}")
    return done


def main():
    env = read_env()
    account, token = env["account"], env["token"]

    done = load_done()
    state = load_state()
    remaining_budget = DAILY_NEURON_BUDGET - state["neurons"]

    print(f"model:            {MODEL} ({DIM}d)")
    print(f"already embedded: {len(done)}")
    print(f"neuron ledger:    {state['neurons']:.1f} spent on {state['date']} "
          f"(UTC); {remaining_budget:.1f} left today")

    if remaining_budget <= 0:
        print("daily neuron budget already spent - exiting cleanly. "
              "Re-run after 00:00 UTC.")
        return 0

    pending = []
    with open(CHUNKS) as f:
        for line in f:
            d = json.loads(line)
            ident = f"{d['documentId']}:{d['chunkKey']}"
            if ident in done:
                continue
            text = d.get("text") or d.get("content") or ""
            if not text.strip():
                continue
            pending.append(d)

    print(f"pending:          {len(pending)}\n")
    if not pending:
        print("corpus fully embedded.")
        return 0

    out_f = open(OUT, "a")
    fail_f = open(FAILED, "a")
    written = 0
    spent = 0.0
    t0 = time.time()

    def flush(batch):
        """Embed one batch and persist it. Returns False to stop the run."""
        nonlocal written, spent
        if not batch:
            return True
        try:
            vecs, neurons = post(account, token, MODEL,
                                 [b.get("text") or b.get("content") for b in batch])
        except urllib.error.HTTPError as e:
            if e.code == 400 and len(batch) > 1:
                mid = len(batch) // 2
                return flush(batch[:mid]) and flush(batch[mid:])
            # A single chunk the API refuses: record and move on rather than
            # killing a multi-day run over one bad record.
            for b in batch:
                fail_f.write(json.dumps({
                    "documentId": b["documentId"], "chunkKey": b["chunkKey"],
                    "reason": f"HTTP {e.code}", "chars": len(b.get("text") or "")}) + "\n")
            fail_f.flush()
            print(f"    !! HTTP {e.code} on {len(batch)} chunk(s); recorded, skipping")
            return True

        spent += neurons
        state["neurons"] += neurons

        if len(vecs) != len(batch):
            # Never write misaligned vectors - that would silently attach the
            # wrong embedding to the wrong chunk.
            for b in batch:
                fail_f.write(json.dumps({
                    "documentId": b["documentId"], "chunkKey": b["chunkKey"],
                    "reason": f"count mismatch {len(vecs)}!={len(batch)}"}) + "\n")
            fail_f.flush()
            print(f"    !! vector/chunk count mismatch; batch skipped")
            return True

        for b, v in zip(batch, vecs):
            ok, why = valid_vector(v)
            if not ok:
                fail_f.write(json.dumps({
                    "documentId": b["documentId"], "chunkKey": b["chunkKey"],
                    "reason": f"invalid vector: {why}"}) + "\n")
                continue
            out_f.write(json.dumps({
                "documentId": b["documentId"],
                "contentHash": b.get("contentHash"),
                "chunkKey": b["chunkKey"],
                "headingPath": b.get("headingPath"),
                "model": MODEL,
                "dims": DIM,
                "embedding": v,
            }) + "\n")
            written += 1

        out_f.flush()
        os.fsync(out_f.fileno())   # survive a hard kill, not just a clean exit
        save_state(state)
        time.sleep(PACE_S)

        if state["neurons"] >= DAILY_NEURON_BUDGET:
            print(f"\ndaily neuron budget reached "
                  f"({state['neurons']:.0f}/{DAILY_NEURON_BUDGET}).")
            return False
        return True

    batch, size = [], 0
    stop = False
    for d in pending:
        text = d.get("text") or d.get("content")
        if batch and size + len(text) > CHAR_BUDGET:
            if not flush(batch):
                stop = True
                break
            batch, size = [], 0
        batch.append(d)
        size += len(text)

        if written and written % 2000 == 0:
            el = time.time() - t0
            print(f"  {written} written this run, {spent:.0f} neurons, "
                  f"{el/60:.1f} min", flush=True)

    if not stop:
        flush(batch)

    out_f.close()
    fail_f.close()

    total_done = len(done) + written
    print(f"\nwritten this run:   {written}")
    print(f"neurons this run:   {spent:.1f}")
    print(f"neurons today:      {state['neurons']:.1f}/{DAILY_NEURON_BUDGET}")
    print(f"corpus progress:    {total_done}/44792 "
          f"({total_done/44792*100:.1f}%)")
    print(f"elapsed:            {(time.time()-t0)/60:.1f} min")
    if total_done < 44792:
        print("\nnot finished - re-run to resume "
              "(after 00:00 UTC if the daily budget is spent).")
    return 0


if __name__ == "__main__":
    acquire_lock()
    try:
        sys.exit(main())
    finally:
        release_lock()
