#!/usr/bin/env python3
"""Head-to-head retrieval quality on OUR corpus, not a public leaderboard.

Method: known-item retrieval. Take a stratified sample of chunks spanning many
documents. For a subset, pull one distinctive sentence out of the chunk and use
it as the query; the chunk it came from is the ground-truth target. Rank all
sampled chunks by cosine and measure Recall@1/@5 and MRR@10.

This is a proxy for discriminative power on UET Taxila's actual language, not a
full RAG evaluation -- but it is identical for every model, so the COMPARISON
is fair, which is the decision we need.

Ground truth needs no human labels and no model, so it cannot favour either
candidate.
"""
import json
import random
import re
import time
import urllib.request
import urllib.error

ENV = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/.env.local"
CHUNKS = "/mnt/d/uetgpt_corpus_v1/embeddings/all_chunks.jsonl"

N_CHUNKS = 1000
N_QUERIES = 100
BATCH = 50
SEED = 20260824

MODELS = ["@cf/baai/bge-m3", "@cf/qwen/qwen3-embedding-0.6b"]


def read_env():
    v = {}
    with open(ENV) as f:
        for line in f:
            line = line.strip()
            if line.startswith("CLOUDFLARE_ACCOUNT_ID="):
                v["account"] = line.split("=", 1)[1]
            elif line.startswith("CLOUDFLARE_API_TOKEN="):
                v["token"] = line.split("=", 1)[1]
    return v


def _post(account, token, model, texts, max_retries=6):
    """POST one batch, retrying 429/5xx with exponential backoff.

    Cloudflare rate-limits these endpoints, and an unattended multi-day ingest
    will certainly encounter it -- so backoff is required behaviour, not a
    nicety. 400 is deterministic (batch too large) and is re-raised immediately
    for the caller to split.
    """
    url = f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}"
    delay = 2.0
    for attempt in range(max_retries):
        req = urllib.request.Request(
            url, data=json.dumps({"text": texts}).encode(),
            headers={"Authorization": f"Bearer {token}",
                     "Content-Type": "application/json"},
            method="POST")
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                neurons = float(r.headers.get("cf-ai-neurons") or 0)
                res = json.loads(r.read().decode())["result"]
            for k in ("data", "embeddings", "vectors"):
                if isinstance(res.get(k), list):
                    return res[k], neurons
            raise RuntimeError("unexpected response shape")
        except urllib.error.HTTPError as e:
            if e.code == 400:
                raise
            if e.code in (429, 500, 502, 503, 504) and attempt < max_retries - 1:
                retry_after = e.headers.get("retry-after")
                wait = float(retry_after) if retry_after else delay
                print(f"    HTTP {e.code}, backing off {wait:.1f}s "
                      f"(attempt {attempt + 1}/{max_retries})", flush=True)
                time.sleep(wait)
                delay = min(delay * 2, 60)
                continue
            raise
        except urllib.error.URLError:
            if attempt == max_retries - 1:
                raise
            time.sleep(delay)
            delay = min(delay * 2, 60)
    raise RuntimeError("exhausted retries")


def embed_all(account, token, model, texts):
    """Batch by CHARACTER budget, not item count.

    The 60,000-token context is a per-REQUEST total across the whole batch, not
    per text (measured: 133,634 chars -> 'Max context reached 82650 tokens but
    model supports only 60000'). That implies ~1.6 chars/token on this corpus,
    so ~96k chars would be the theoretical ceiling; CHAR_BUDGET keeps a wide
    margin. On an over-budget 400 the batch is split and retried rather than
    failing the run.
    """
    CHAR_BUDGET = 60_000
    out, neurons = [], 0.0

    def flush(batch):
        nonlocal neurons
        if not batch:
            return
        try:
            vecs, n = _post(account, token, model, batch)
            out.extend(vecs)
            neurons += n
            time.sleep(PACE_S)
        except urllib.error.HTTPError as e:
            if e.code == 400 and len(batch) > 1:
                mid = len(batch) // 2
                flush(batch[:mid])
                flush(batch[mid:])
            else:
                raise

    PACE_S = 1.0
    batch, size = [], 0
    for t in texts:
        if batch and size + len(t) > CHAR_BUDGET:
            flush(batch)
            batch, size = [], 0
        batch.append(t)
        size += len(t)
    flush(batch)
    return out, neurons


def stratified_sample(n):
    """Round-robin across documents so the sample spans the corpus rather than
    a handful of adjacent documents (a flaw caught in earlier proof work)."""
    by_doc = {}
    with open(CHUNKS) as f:
        for line in f:
            d = json.loads(line)
            t = d.get("text") or d.get("content") or ""
            if len(t) < 300:
                continue
            by_doc.setdefault(d["documentId"], []).append(
                {"chunkKey": d["chunkKey"], "documentId": d["documentId"], "text": t})
    docs = sorted(by_doc)
    random.Random(SEED).shuffle(docs)
    out, i = [], 0
    while len(out) < n:
        progressed = False
        for doc in docs:
            if i < len(by_doc[doc]):
                out.append(by_doc[doc][i])
                progressed = True
                if len(out) >= n:
                    break
        if not progressed:
            break
        i += 1
    return out


def make_query(text):
    """A distinctive mid-document sentence: long enough to be meaningful,
    not the boilerplate first line of a page."""
    sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text)
             if 60 < len(s.strip()) < 300]
    if not sents:
        return None
    return sents[len(sents) // 2]


def cosine(a, b):
    return sum(x * y for x, y in zip(a, b))  # vectors are L2-normalized


def main():
    env = read_env()
    account, token = env["account"], env["token"]

    sample = stratified_sample(N_CHUNKS)
    ndocs = len({c["documentId"] for c in sample})
    print(f"sample: {len(sample)} chunks across {ndocs} documents")

    rng = random.Random(SEED)
    candidates = [(i, make_query(c["text"])) for i, c in enumerate(sample)]
    candidates = [(i, q) for i, q in candidates if q]
    rng.shuffle(candidates)
    queries = candidates[:N_QUERIES]
    print(f"queries: {len(queries)} known-item probes\n")

    corpus_texts = [c["text"] for c in sample]
    query_texts = [q for _, q in queries]

    results = {}
    for model in MODELS:
        print(f"embedding corpus + queries with {model} ...")
        cvecs, n1 = embed_all(account, token, model, corpus_texts)
        qvecs, n2 = embed_all(account, token, model, query_texts)
        print(f"  corpus done. dims={len(cvecs[0])}  neurons={n1 + n2:.2f}")

        r1 = r5 = 0
        mrr = 0.0
        for (target_idx, _), qv in zip(queries, qvecs):
            scores = sorted(
                ((cosine(qv, cv), i) for i, cv in enumerate(cvecs)),
                reverse=True)
            ranked = [i for _, i in scores[:10]]
            if ranked and ranked[0] == target_idx:
                r1 += 1
            if target_idx in ranked[:5]:
                r5 += 1
            if target_idx in ranked:
                mrr += 1.0 / (ranked.index(target_idx) + 1)

        n = len(queries)
        results[model] = {
            "dims": len(cvecs[0]),
            "recall@1": r1 / n,
            "recall@5": r5 / n,
            "mrr@10": mrr / n,
            "neurons": n1 + n2,
        }
        print(f"  Recall@1={r1/n:.3f}  Recall@5={r5/n:.3f}  MRR@10={mrr/n:.3f}\n")

    print("=== SUMMARY ===")
    for m, r in results.items():
        print(f"{m:<34} dim={r['dims']:<5} R@1={r['recall@1']:.3f} "
              f"R@5={r['recall@5']:.3f} MRR@10={r['mrr@10']:.3f} "
              f"({r['neurons']:.0f} neurons)")


if __name__ == "__main__":
    main()
