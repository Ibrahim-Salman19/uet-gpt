#!/usr/bin/env python3
"""Phase 5 driver v3: smaller batches, inter-batch pacing, and retry-with-
backoff on the deployment's write-rate limit (4 MiB/s). Safe to retry the
same batch: ingestBatchForLexicalProof is idempotent (upsertDocument's
content-hash skip + a chunkCount-based re-chunk fallback for partial
batches)."""
import json
import sys
import time
import urllib.error
import urllib.request

CORPUS = "/mnt/d/uetgpt_corpus_v1/documents.jsonl"
ENV_LOCAL = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/.env.local"
CONVEX_URL = "http://127.0.0.1:3210"
BATCH_BYTE_BUDGET = 120_000
INTER_BATCH_DELAY_S = 0.5
MAX_RETRIES = 6

def read_admin_key():
    with open(ENV_LOCAL) as f:
        for line in f:
            if line.startswith("CONVEX_SELF_HOSTED_ADMIN_KEY="):
                return line.strip().split("=", 1)[1]
    raise RuntimeError("admin key not found")

def load_docs():
    docs = []
    with open(CORPUS) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            d = json.loads(line)
            docs.append({
                "url": d["sourceUrl"],
                "title": d.get("title"),
                "markdown": d["markdown"],
                "contentHash": d["contentHash"],
                "sourceType": d.get("contentType", "html"),
            })
    return docs

def batch_by_bytes(docs, budget):
    batch, size = [], 0
    for d in docs:
        doc_size = len(json.dumps(d))
        if batch and size + doc_size > budget:
            yield batch
            batch, size = [], 0
        batch.append(d)
        size += doc_size
    if batch:
        yield batch

def call_action(admin_key, path, args, timeout=120):
    body = json.dumps({"path": path, "args": args, "format": "json"}).encode()
    req = urllib.request.Request(
        f"{CONVEX_URL}/api/action",
        data=body,
        headers={
            "Authorization": f"Convex {admin_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())

def call_with_retry(admin_key, path, args, label):
    delay = 2.0
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            result = call_action(admin_key, path, args)
        except (urllib.error.URLError, TimeoutError) as e:
            print(f"{label}: transport error (attempt {attempt}): {e}", flush=True)
            time.sleep(delay)
            delay *= 2
            continue
        if result.get("status") == "success":
            return result["value"]
        msg = result.get("errorMessage", "")
        if "Too many writes per second" in msg or "rate" in msg.lower():
            print(f"{label}: rate limited (attempt {attempt}), backing off {delay:.1f}s", flush=True)
            time.sleep(delay)
            delay *= 2
            continue
        print(f"{label}: FAILED: {msg[:2000]}", flush=True)
        sys.exit(1)
    print(f"{label}: exhausted {MAX_RETRIES} retries", flush=True)
    sys.exit(1)

def main():
    admin_key = read_admin_key()
    docs = load_docs()
    print(f"loaded {len(docs)} documents", flush=True)
    batches = list(batch_by_bytes(docs, BATCH_BYTE_BUDGET))
    print(f"{len(batches)} batches", flush=True)

    total_docs_written = 0
    total_chunks_written = 0
    start = time.time()
    for i, batch in enumerate(batches, 1):
        value = call_with_retry(
            admin_key,
            "crawl/lexicalProof:ingestBatchForLexicalProof",
            {"documents": batch},
            f"batch {i}/{len(batches)}",
        )
        total_docs_written += value.get("documentsWritten", 0)
        total_chunks_written += value.get("chunksWritten", 0)
        elapsed = time.time() - start
        print(f"batch {i}/{len(batches)} ok | docs={total_docs_written} chunks={total_chunks_written} | {elapsed:.0f}s elapsed", flush=True)
        time.sleep(INTER_BATCH_DELAY_S)

    print(f"DONE. total documents={total_docs_written} chunks={total_chunks_written} elapsed={time.time()-start:.0f}s", flush=True)

if __name__ == "__main__":
    main()
