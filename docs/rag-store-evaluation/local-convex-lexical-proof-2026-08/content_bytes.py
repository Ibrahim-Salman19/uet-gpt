#!/usr/bin/env python3
"""§7.1 corrected storage measurement: real logical content bytes for
exactly the fields the lexical schema (crawledChunks + documents) stores,
UTF-8 byte length. Not a filesystem/du measurement (see report.md §7.1 for
why the original du-based figure was replaced, not kept as a caveat) and
not a Convex Cloud storage prediction - a lower bound, excluding search-
index and storage-format overhead."""
import json

CHUNKS = "/mnt/d/uetgpt_corpus_v1/embeddings/all_chunks.jsonl"
DOCUMENTS = "/mnt/d/uetgpt_corpus_v1/documents.jsonl"


def main():
    chunk_bytes = n_chunks = 0
    with open(CHUNKS) as f:
        for line in f:
            d = json.loads(line)
            text = d.get("text") or d.get("content") or ""
            heading = d.get("headingPath") or []
            content_hash = d.get("contentHash") or ""
            chunk_key = d.get("chunkKey") or ""
            doc_id = d.get("documentId") or ""
            rag_id = f"lexical-proof:{content_hash}"  # actual stored format
            row = text + json.dumps(heading) + content_hash + chunk_key + doc_id + rag_id
            chunk_bytes += len(row.encode("utf-8"))
            n_chunks += 1

    doc_bytes = n_docs = 0
    with open(DOCUMENTS) as f:
        for line in f:
            d = json.loads(line)
            row = (d.get("canonicalUrl", "") + d.get("sourceUrl", "") +
                   d.get("title", "") + d.get("status", "") + d.get("contentType", ""))
            doc_bytes += len(row.encode("utf-8"))
            n_docs += 1

    total = chunk_bytes + doc_bytes
    print(f"chunks: {n_chunks:,}  content bytes: {chunk_bytes:,} ({chunk_bytes/1024/1024:.1f} MB)")
    print(f"docs:   {n_docs:,}  content bytes: {doc_bytes:,} ({doc_bytes/1024/1024:.1f} MB)")
    print(f"TOTAL content bytes (1x): {total:,} ({total/1024/1024:.1f} MB)")
    for mult in (2, 3):
        mb = total * mult / 1024 / 1024
        print(f"{mult}x DERIVED linear projection: {mb:.1f} MB ({mb/1024:.2f} GB)")


if __name__ == "__main__":
    main()
