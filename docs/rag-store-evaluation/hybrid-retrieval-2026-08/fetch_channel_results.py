#!/usr/bin/env python3
"""Mandate §45/46/57 hybrid retrieval evaluation, step 1 of 2.

Fetches REAL dense (Pinecone, corpus-v1-full namespace, same index this
session's full-corpus upload verified) and REAL lexical (local Convex
search_text via crawl/lexicalProof:searchChunksForProof) results for all 50
queries in scripts/eval/golden_set_verified.jsonl (originally written when
the set was 11 AI-reviewed fee queries; the label set was expanded to 50
afterward - this docstring was stale until Agent B's 2026-09-02 review
flagged it, see AGENT_B_REVIEW_2026-09-02.md §4a - the code and data
themselves were already current, only this comment lagged). Writes raw
ranked (chunkKey, score) lists to channel_results.json.

Why Python for the fetch, not TypeScript: importing the
@pinecone-database/pinecone SDK via `npx tsx` was found to hang
indefinitely (isolated by testing the bare `import("@pinecone-database
/pinecone")` alone - confirmed unrelated to this project's own code,
a tsx/esbuild<->this SDK version's CJS/ESM interop issue). The Python
Pinecone SDK has been used successfully throughout this session
(upload_full_corpus.py, verify_upload_mechanism.py) with zero such issue.
Per mandate §46, this file does NOT compute relevance/fusion - it only
fetches each channel's raw ranked results. The actual RRF fusion (the
part §46 requires be real production code, not a Python approximation)
happens in fuse_and_score.ts, which imports the real, unmodified
convex/embeddings/hybridRank.ts function.
"""
import json
import os
import urllib.request

from pinecone import Pinecone

ROOT = "/mnt/c/Users/hafiz/UETGPT/uet-gpt"
LABELS_PATH = f"{ROOT}/scripts/eval/golden_set_verified.jsonl"
QUERY_VECTORS_PATH = "/mnt/d/uetgpt_corpus_v1/embeddings/query_vectors.jsonl"
OUT_PATH = f"{ROOT}/docs/rag-store-evaluation/hybrid-retrieval-2026-08/channel_results.json"

INDEX = "uetgpt-corpus-v1-qwen1024"
NAMESPACE = "corpus-v1-full"
CONVEX_LOCAL_URL = "http://127.0.0.1:3210"
TOP_K = 10


def read_env(path, key):
    with open(path) as f:
        for line in f:
            if line.startswith(f"{key}="):
                return line.strip().split("=", 1)[1]
    return None


def load_jsonl(path):
    with open(path) as f:
        return [json.loads(line) for line in f]


def lexical_search(query, limit):
    payload = json.dumps(
        {
            "path": "crawl/lexicalProof:searchChunksForProof",
            "args": {"query": query, "limit": limit},
            "format": "json",
        }
    ).encode()
    req = urllib.request.Request(
        f"{CONVEX_LOCAL_URL}/api/action",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    body = json.loads(urllib.request.urlopen(req, timeout=30).read())
    if body.get("status") != "success":
        raise RuntimeError(f"lexical search failed: {body}")
    return [r["chunkKey"] for r in body["value"]]


def main():
    api_key = os.environ.get("PINECONE_API_KEY") or read_env(f"{ROOT}/.env.local", "PINECONE_API_KEY")
    if not api_key:
        raise RuntimeError("PINECONE_API_KEY not found in env or .env.local")

    pc = Pinecone(api_key=api_key)
    index = pc.Index(INDEX)

    labels = load_jsonl(LABELS_PATH)
    query_vectors = {q["queryId"]: q["embedding"] for q in load_jsonl(QUERY_VECTORS_PATH)}

    stats = index.describe_index_stats()
    print(f"Pinecone namespace record count: {stats.namespaces.get(NAMESPACE)}")

    out = []
    for label in labels:
        qid = label["queryId"]
        embedding = query_vectors.get(qid)
        if not embedding:
            print(f"  SKIP (no query embedding): {label['query']}")
            continue

        dense = index.query(vector=embedding, top_k=TOP_K, namespace=NAMESPACE, include_metadata=True)
        dense_ranked = [
            {"id": m.metadata["chunkKey"], "score": m.score}
            for m in dense.matches
            if m.metadata and "chunkKey" in m.metadata
        ]

        lexical_ranked = [{"id": ck, "score": 0} for ck in lexical_search(label["query"], TOP_K)]

        out.append(
            {
                "queryId": qid,
                "query": label["query"],
                "relevantChunkKeys": label["relevantChunkKeys"],
                "dense": dense_ranked,
                "lexical": lexical_ranked,
            }
        )
        print(f"  fetched: {label['query']!r} (dense={len(dense_ranked)}, lexical={len(lexical_ranked)})")

    with open(OUT_PATH, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nwrote {len(out)} queries' channel results to {OUT_PATH}")


if __name__ == "__main__":
    main()
