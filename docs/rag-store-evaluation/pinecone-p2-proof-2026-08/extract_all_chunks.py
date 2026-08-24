#!/usr/bin/env python3
"""Extract all 44,792 chunks from the local Convex crawledChunks table into
a durable JSONL. Bare .paginate() on this table times out with
SystemTimeoutError even at page size 100 (confirmed empirically - more
expensive than .take() for reasons not fully diagnosed). Workaround:
loop by documentId (1,891 known ids) and .take() each document's chunks via
the by_documentId_and_chunkKey index equality prefix, batching ~8 documents
per inline-query call to stay under this deployment's per-call system-
operation budget (10 docs/call intermittently timed out).

NOTE: this first pass used .take(60) per document, which silently truncates
any document with more than 60 chunks. 101 of the 1,891 documents exceed
60 chunks (largest: 2,445). See extract_over60.py, which re-extracts those
101 documents in full and must be merged with this script's output to get
the true, complete 44,792-chunk corpus. Kept here as-run for reproducibility
rather than silently fixed, since the merge step is what makes the combined
result correct."""
import json
import subprocess
import time

DOC_IDS_FILE = "/mnt/d/uetgpt_corpus_v1/embeddings/all_doc_ids.json"
OUT = "/mnt/d/uetgpt_corpus_v1/embeddings/all_chunks_pass1.jsonl"
CWD = "/mnt/c/Users/hafiz/UETGPT/uet-gpt"
DOCS_PER_CALL = 8


def run_batch(doc_ids, attempt=1):
    doc_ids_js = json.dumps(doc_ids)
    query = f"""
const docIds = {doc_ids_js};
const out = [];
for (const documentId of docIds) {{
  const chunks = await ctx.db.query('crawledChunks')
    .withIndex('by_documentId_and_chunkKey', q => q.eq('documentId', documentId))
    .take(60);
  for (const c of chunks) {{
    out.push({{documentId: c.documentId, contentHash: c.contentHash, chunkKey: c.chunkKey, headingPath: c.headingPath, text: c.text}});
  }}
}}
return out;
"""
    result = subprocess.run(
        ["npx", "convex", "run", "--inline-query", query],
        cwd=CWD, capture_output=True, text=True, timeout=60,
    )
    if result.returncode != 0:
        if attempt <= 3:
            time.sleep(2 * attempt)
            return run_batch(doc_ids, attempt + 1)
        raise RuntimeError(f"batch failed after {attempt} attempts: {result.stderr[:1000]}")
    return json.loads(result.stdout)


def main():
    all_doc_ids = json.load(open(DOC_IDS_FILE))
    print(f"{len(all_doc_ids)} documents to extract chunks from")

    total = 0
    with open(OUT, "w") as f:
        for i in range(0, len(all_doc_ids), DOCS_PER_CALL):
            batch_ids = all_doc_ids[i:i + DOCS_PER_CALL]
            rows = run_batch(batch_ids)
            for row in rows:
                f.write(json.dumps(row) + "\n")
            total += len(rows)
            f.flush()
            if (i // DOCS_PER_CALL) % 20 == 0:
                print(f"docs {i}/{len(all_doc_ids)}, chunks so far={total}", flush=True)
    print(f"DONE. total chunks extracted: {total}")


if __name__ == "__main__":
    main()
