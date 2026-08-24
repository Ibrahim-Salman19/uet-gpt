#!/usr/bin/env python3
"""Re-extract the 101 documents whose chunkCount > 60 (extract_all_chunks.py's
.take(60) silently truncated these - confirmed via the documents table's
chunkCount field, real sum 44,792 vs 27,580 extracted by the first pass).
One document per inline-query call since some have 1000+ chunks (largest:
2,445). Then merges with extract_all_chunks.py's output, dropping the
truncated entries for these 101 documents and appending the complete
versions, deduped by chunkKey. Verified result: 44,792 unique chunks across
all 1,891 documents - exact match to the corpus's known total."""
import json
import subprocess
import time

CWD = "/mnt/c/Users/hafiz/UETGPT/uet-gpt"
EMB_DIR = "/mnt/d/uetgpt_corpus_v1/embeddings"


def run_one(doc_id, take_n, attempt=1):
    query = f"""
const chunks = await ctx.db.query('crawledChunks')
  .withIndex('by_documentId_and_chunkKey', q => q.eq('documentId', '{doc_id}'))
  .take({take_n});
return chunks.map(c => ({{documentId: c.documentId, contentHash: c.contentHash, chunkKey: c.chunkKey, headingPath: c.headingPath, text: c.text}}));
"""
    result = subprocess.run(
        ["npx", "convex", "run", "--inline-query", query],
        cwd=CWD, capture_output=True, text=True, timeout=90,
    )
    if result.returncode != 0:
        if attempt <= 4:
            time.sleep(2 * attempt)
            return run_one(doc_id, take_n, attempt + 1)
        raise RuntimeError(f"doc {doc_id} failed after {attempt} attempts: {result.stderr[:1000]}")
    return json.loads(result.stdout)


def extract_over60():
    docs = json.load(open(f"{EMB_DIR}/over60_docs.json"))
    total = 0
    with open(f"{EMB_DIR}/over60_chunks.jsonl", "w") as f:
        for i, d in enumerate(docs, 1):
            take_n = d["chunkCount"] + 5
            rows = run_one(d["id"], take_n)
            if len(rows) != d["chunkCount"]:
                print(f"WARNING: doc {d['id']} expected {d['chunkCount']} got {len(rows)}", flush=True)
            for row in rows:
                f.write(json.dumps(row) + "\n")
            total += len(rows)
            f.flush()
            print(f"{i}/{len(docs)} doc={d['id']} chunkCount={d['chunkCount']} got={len(rows)} total={total}", flush=True)
    print(f"over-60 extraction done. total: {total}")


def merge():
    over60 = json.load(open(f"{EMB_DIR}/over60_docs.json"))
    over60_ids = set(d["id"] for d in over60)

    seen_keys = set()
    kept = 0
    with open(f"{EMB_DIR}/all_chunks_pass1.jsonl") as fin, \
         open(f"{EMB_DIR}/all_chunks.jsonl", "w") as fout:
        for line in fin:
            row = json.loads(line)
            if row["documentId"] in over60_ids:
                continue
            if row["chunkKey"] in seen_keys:
                continue
            seen_keys.add(row["chunkKey"])
            fout.write(line)
            kept += 1

        with open(f"{EMB_DIR}/over60_chunks.jsonl") as f2:
            for line in f2:
                row = json.loads(line)
                if row["chunkKey"] in seen_keys:
                    continue
                seen_keys.add(row["chunkKey"])
                fout.write(line)
                kept += 1

    print(f"merged: {kept} unique chunks total")


if __name__ == "__main__":
    extract_over60()
    merge()
