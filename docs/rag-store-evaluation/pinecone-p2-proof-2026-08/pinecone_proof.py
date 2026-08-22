#!/usr/bin/env python3
"""Phase 7 proof: create a Pinecone Starter (serverless, free) index, upsert
the 100-chunk real embedding slice with minimal metadata (documentId,
chunkKey, headingPath - NOT full chunk text, per the P2 architecture where
Convex remains the text/lexical source of truth), then query it to confirm
dense retrieval round-trips correctly end-to-end."""
import json
import time

from pinecone import Pinecone, ServerlessSpec

ENV_LOCAL = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/.env.local"
EMB_FILE = "/tmp/claude-0/-mnt-c-Users-hafiz-UETGPT/28a878c8-9cc1-4f80-ab92-4beb50e71d35/scratchpad/sample_embeddings.jsonl"
INDEX_NAME = "uetgpt-p2-proof"
DIM = 768


def read_key():
    with open(ENV_LOCAL) as f:
        for line in f:
            if line.startswith("PINECONE_API_KEY="):
                return line.strip().split("=", 1)[1]
    raise RuntimeError("PINECONE_API_KEY not found")


def main():
    pc = Pinecone(api_key=read_key())

    existing = [idx["name"] for idx in pc.list_indexes()]
    print(f"existing indexes: {existing}")
    if INDEX_NAME not in existing:
        pc.create_index(
            name=INDEX_NAME,
            dimension=DIM,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        print(f"created index {INDEX_NAME}, waiting for ready...")
        while not pc.describe_index(INDEX_NAME).status["ready"]:
            time.sleep(2)
    else:
        print(f"index {INDEX_NAME} already exists, reusing")

    desc = pc.describe_index(INDEX_NAME)
    print(f"index dimension={desc.dimension} metric={desc.metric} host={desc.host}")

    index = pc.Index(host=desc.host)

    rows = [json.loads(l) for l in open(EMB_FILE)]
    vectors = []
    sample_metadata_bytes = None
    for r in rows:
        metadata = {
            "documentId": r["documentId"],
            "chunkKey": r["chunkKey"],
            "headingPath": r["headingPath"],
        }
        if sample_metadata_bytes is None:
            sample_metadata_bytes = len(json.dumps(metadata).encode())
        vectors.append({
            "id": r["chunkKey"],
            "values": r["embedding"],
            "metadata": metadata,
        })

    upsert_resp = index.upsert(vectors=vectors, namespace="uetgpt-corpus-v1")
    print(f"upserted: {upsert_resp}")
    print(f"sample metadata size: {sample_metadata_bytes} bytes")

    time.sleep(5)  # allow index to become consistent for query
    stats = index.describe_index_stats()
    print(f"index stats: {stats}")

    query_vec = vectors[0]["values"]
    result = index.query(
        namespace="uetgpt-corpus-v1",
        vector=query_vec,
        top_k=5,
        include_metadata=True,
    )
    print("query results (self-similarity check, top match should be id 0's own chunk):")
    for match in result["matches"]:
        print(f"  id={match['id']} score={match['score']:.4f} headingPath={match['metadata'].get('headingPath')}")


if __name__ == "__main__":
    main()
