#!/usr/bin/env python3
"""Full-corpus embed: 44,792 chunks via Gemini batchEmbedContents (100/call,
matching Phase 7's proven request shape), written progressively to a durable
JSONL on /mnt/d (session scratchpad has been observed to be wiped across
session resets - this script and its output both live on /mnt/d for that
reason). Resumable: on start, skips any chunkKey already present in the
output file, so a restart only re-does the last partial batch, not the
whole run.

Round-robins across 3 real Gemini API keys (GEMINI_API_KEY, _1, _2 in
.env.local - each the user's own, each on the free tier's separate
per-key/per-project daily quota) because a single key's free-tier quota for
gemini-embedding-2 is a hard 1,000 embed-requests/day
(EmbedContentRequestsPerDayPerUserPerProjectPerModel-FreeTier, confirmed via
the API's own error body) - at 1 key that's ~45 days for the full corpus, at
3 keys sharing the work it's ~15. A 429 whose body's quotaId contains
"PerDay" marks that key exhausted for today and switches to the next key
immediately (no backoff - retrying the same key won't help until tomorrow's
reset); a 429 without that (a transient per-minute limit) still gets
exponential backoff on the same key, as before. When every key is exhausted,
stops cleanly rather than busy-waiting - re-invoke after the next daily
quota reset to resume."""
import json
import time
import urllib.error
import urllib.request

ENV_LOCAL = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/.env.local"
CHUNKS_IN = "/mnt/d/uetgpt_corpus_v1/embeddings/all_chunks.jsonl"
OUT = "/mnt/d/uetgpt_corpus_v1/embeddings/full_corpus_embeddings.jsonl"
MAX_EMBED_CHARS = 28_000
DIM = 768
BATCH = 100
URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents"
WALL_CLOCK_BUDGET_S = 540  # stop cleanly before the caller's ~10min timeout
KEY_NAMES = ["GEMINI_API_KEY", "GEMINI_API_KEY_1", "GEMINI_API_KEY_2"]


class DailyQuotaExhausted(Exception):
    pass


def read_keys():
    found = {}
    with open(ENV_LOCAL) as f:
        for line in f:
            for name in KEY_NAMES:
                if line.startswith(name + "="):
                    found[name] = line.strip().split("=", 1)[1]
    keys = [found[n] for n in KEY_NAMES if n in found and found[n]]
    if not keys:
        raise RuntimeError("no Gemini API keys found in .env.local")
    return keys


def batch_embed(api_key, texts):
    body = {
        "requests": [
            {
                "model": "models/gemini-embedding-2",
                "content": {"parts": [{"text": t[:MAX_EMBED_CHARS]}]},
                "outputDimensionality": DIM,
            }
            for t in texts
        ]
    }
    req = urllib.request.Request(
        URL,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    delay = 4.0
    last_err = None
    for attempt in range(1, 6):
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = json.loads(resp.read())
            embeddings = data.get("embeddings")
            if not embeddings or len(embeddings) != len(texts):
                raise RuntimeError(f"unexpected response shape: {json.dumps(data)[:1000]}")
            return [e["values"] for e in embeddings]
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code == 429:
                body_text = e.read().decode(errors="replace")
                is_daily = False
                try:
                    violations = json.loads(body_text)["error"]["details"]
                    for d in violations:
                        for v in d.get("violations", []):
                            if "PerDay" in v.get("quotaId", ""):
                                is_daily = True
                except (json.JSONDecodeError, KeyError, TypeError):
                    # Response didn't match the expected QuotaFailure shape -
                    # fall back to the substring check rather than treating
                    # an unparseable body as a transient error to retry
                    # forever.
                    is_daily = "PerDay" in body_text
                if is_daily:
                    raise DailyQuotaExhausted(body_text[:300]) from None
                print(f"    transient 429 (attempt {attempt}), backing off {delay:.0f}s", flush=True)
                time.sleep(delay)
                delay = min(delay * 2, 120)
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as e:
            last_err = e
            print(f"    transport error (attempt {attempt}): {e}, backing off {delay:.0f}s", flush=True)
            time.sleep(delay)
            delay = min(delay * 2, 120)
            continue
    raise RuntimeError(f"exhausted retries: {last_err}")


FAILED_OUT = "/mnt/d/uetgpt_corpus_v1/embeddings/failed_chunks.jsonl"


def embed_with_bisection(api_key, rows, key_label):
    """Wraps batch_embed with bisection on a non-retryable, non-daily-quota
    HTTPError: a single malformed chunk (unusual encoding, etc.) must not
    halt the entire day's run. Splits the failing batch in half and retries
    each half; at batch size 1, a still-failing chunk is durably logged to
    FAILED_OUT (not silently dropped) and skipped. DailyQuotaExhausted
    propagates immediately (unrelated to any specific chunk's content)."""
    try:
        vecs = batch_embed(api_key, [r["text"] for r in rows])
        return list(zip(rows, vecs))
    except DailyQuotaExhausted:
        raise
    except Exception as e:
        if len(rows) == 1:
            print(f"    PERMANENT FAILURE for chunk {rows[0]['chunkKey']}: {e}", flush=True)
            with open(FAILED_OUT, "a") as ff:
                ff.write(json.dumps({"chunkKey": rows[0]["chunkKey"], "documentId": rows[0]["documentId"], "error": str(e)[:500]}) + "\n")
            return []
        mid = len(rows) // 2
        print(f"    batch of {len(rows)} failed ({e}), bisecting", flush=True)
        return (embed_with_bisection(api_key, rows[:mid], key_label)
                + embed_with_bisection(api_key, rows[mid:], key_label))


def load_done_keys():
    done = set()
    try:
        with open(OUT) as f:
            for line in f:
                try:
                    done.add(json.loads(line)["chunkKey"])
                except (json.JSONDecodeError, KeyError):
                    continue
    except FileNotFoundError:
        pass
    return done


def main():
    api_keys = read_keys()
    print(f"{len(api_keys)} Gemini API key(s) available for round-robin", flush=True)
    key_idx = 0
    exhausted_today = set()

    all_rows = [json.loads(l) for l in open(CHUNKS_IN)]
    done_keys = load_done_keys()
    remaining = [r for r in all_rows if r["chunkKey"] not in done_keys]
    print(f"total chunks: {len(all_rows)}, already embedded: {len(done_keys)}, remaining: {len(remaining)}", flush=True)

    start = time.time()
    embedded_this_run = 0
    with open(OUT, "a") as f:
        i = 0
        while i < len(remaining):
            if time.time() - start > WALL_CLOCK_BUDGET_S:
                print(f"stopping cleanly at wall-clock budget ({WALL_CLOCK_BUDGET_S}s) - re-invoke to resume", flush=True)
                break
            if len(exhausted_today) >= len(api_keys):
                print("ALL KEYS EXHAUSTED for today's daily quota - re-invoke after reset to resume", flush=True)
                break

            batch = remaining[i:i + BATCH]
            try:
                pairs = embed_with_bisection(api_keys[key_idx], batch, KEY_NAMES[key_idx])
            except DailyQuotaExhausted:
                print(f"  key #{key_idx} ({KEY_NAMES[key_idx]}) hit its daily quota, switching key", flush=True)
                exhausted_today.add(key_idx)
                key_idx = (key_idx + 1) % len(api_keys)
                continue  # retry same batch with next key

            for row, v in pairs:
                assert len(v) == DIM
                f.write(json.dumps({
                    "documentId": row["documentId"],
                    "contentHash": row["contentHash"],
                    "chunkKey": row["chunkKey"],
                    "headingPath": row["headingPath"],
                    "embedding": v,
                }) + "\n")
            f.flush()
            i += len(batch)
            embedded_this_run += len(pairs)
            done_so_far = len(done_keys) + embedded_this_run
            elapsed = time.time() - start
            print(f"embedded {done_so_far}/{len(all_rows)} | key #{key_idx} ({KEY_NAMES[key_idx]}) | {elapsed:.0f}s elapsed", flush=True)
            key_idx = (key_idx + 1) % len(api_keys)  # round-robin every batch to spread load
        else:
            print(f"DONE. total embedded this run: {embedded_this_run}, elapsed: {time.time()-start:.0f}s", flush=True)


if __name__ == "__main__":
    main()
