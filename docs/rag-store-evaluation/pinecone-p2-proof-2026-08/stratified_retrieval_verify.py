#!/usr/bin/env python3
"""Phase 7 retrieval-verification fix: the original 100-chunk proof sample
was drawn via index-order .take(100), which happened to pull from just a
handful of adjacent documents - its "related chunks cluster correctly"
result was confounded by that, not real evidence of corpus-wide semantic
retrieval. This script embeds a genuinely stratified sample (2-3 chunks
each from 40 distinct, evenly-spaced documentIds) plus Phase 5's 5 real
natural-language queries, upserts into the uetgpt-p2-proof index under a
separate namespace, and queries it - so dense (Pinecone) results can be
directly compared to Phase 5's lexical (Convex search_text) results for the
same questions. Real result (see report.md for full transcript): all 5
queries returned topically correct results spanning multiple distinct
documents with sensible score ranges (0.55-0.70), not tautological."""
import json
import time
import urllib.error
import urllib.request

from pinecone import Pinecone

ENV_LOCAL = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/.env.local"
EMB_DIR = "/mnt/d/uetgpt_corpus_v1/embeddings"
MAX_EMBED_CHARS = 28_000
DIM = 768
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents"
INDEX_NAME = "uetgpt-p2-proof"
NAMESPACE = "uetgpt-stratified-verify"

QUERIES = [
    "admission fee structure",
    "hostel accommodation",
    "electrical engineering department",
    "scholarship eligibility criteria",
    "examination date sheet",
]


def read_env_key(name):
    with open(ENV_LOCAL) as f:
        for line in f:
            if line.startswith(name + "="):
                return line.strip().split("=", 1)[1]
    raise RuntimeError(f"{name} not found")


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
        GEMINI_URL,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    delay = 4.0
    for attempt in range(1, 7):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read())
            return [e["values"] for e in data["embeddings"]]
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 6:
                print(f"    429 (attempt {attempt}), backing off {delay:.0f}s")
                time.sleep(delay)
                delay *= 2
                continue
            raise


def main():
    gemini_key = read_env_key("GEMINI_API_KEY")
    stratified_chunks = [json.loads(l) for l in open(f"{EMB_DIR}/stratified_chunks.jsonl")]
    print(f"embedding {len(stratified_chunks)} stratified chunks")
    vecs = []
    for i in range(0, len(stratified_chunks), 100):
        chunk = stratified_chunks[i:i + 100]
        vecs.extend(batch_embed(gemini_key, [r["text"] for r in chunk]))

    print(f"embedding {len(QUERIES)} real queries")
    qvecs = batch_embed(gemini_key, QUERIES)

    pc = Pinecone(api_key=read_env_key("PINECONE_API_KEY"))
    desc = pc.describe_index(INDEX_NAME)
    index = pc.Index(host=desc.host)

    vectors = [
        {
            "id": c["chunkKey"],
            "values": v,
            "metadata": {"documentId": c["documentId"], "chunkKey": c["chunkKey"], "headingPath": c["headingPath"]},
        }
        for c, v in zip(stratified_chunks, vecs)
    ]
    resp = index.upsert(vectors=vectors, namespace=NAMESPACE)
    print(f"upserted {resp['upserted_count']} vectors")
    time.sleep(5)

    for q, qv in zip(QUERIES, qvecs):
        result = index.query(namespace=NAMESPACE, vector=qv, top_k=3, include_metadata=True)
        print(f"\nquery: {q!r}")
        for m in result["matches"]:
            print(f"  score={m['score']:.4f} documentId={m['metadata']['documentId']} headingPath={m['metadata'].get('headingPath')}")


if __name__ == "__main__":
    main()
