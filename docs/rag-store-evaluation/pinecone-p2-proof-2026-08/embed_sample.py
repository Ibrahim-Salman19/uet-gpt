#!/usr/bin/env python3
"""Phase 7 proof: embed a 100-chunk real sample via Gemini batchEmbedContents,
matching convex/embeddings/generate.ts's exact request shape (model
gemini-embedding-2, outputDimensionality 768, MAX_EMBED_CHARS 28000 truncation).
Writes embeddings to a durable local JSONL BEFORE any Pinecone call - embeddings
cost money and are irreversible, Pinecone upserts are cheap/replayable, so the
artifact must exist independently of what happens next."""
import json
import urllib.request

ENV_LOCAL = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/.env.local"
SAMPLE = "/tmp/claude-0/-mnt-c-Users-hafiz-UETGPT/28a878c8-9cc1-4f80-ab92-4beb50e71d35/scratchpad/sample_chunks.jsonl"
OUT = "/tmp/claude-0/-mnt-c-Users-hafiz-UETGPT/28a878c8-9cc1-4f80-ab92-4beb50e71d35/scratchpad/sample_embeddings.jsonl"
MAX_EMBED_CHARS = 28_000
DIM = 768
URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents"


def read_key():
    with open(ENV_LOCAL) as f:
        for line in f:
            if line.startswith("GEMINI_API_KEY="):
                return line.strip().split("=", 1)[1]
    raise RuntimeError("GEMINI_API_KEY not found")


def main():
    api_key = read_key()
    rows = [json.loads(l) for l in open(SAMPLE)]
    print(f"loaded {len(rows)} sample chunks")

    body = {
        "requests": [
            {
                "model": "models/gemini-embedding-2",
                "content": {"parts": [{"text": r["text"][:MAX_EMBED_CHARS]}]},
                "outputDimensionality": DIM,
            }
            for r in rows
        ]
    }
    req = urllib.request.Request(
        URL,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())

    embeddings = data.get("embeddings")
    if not embeddings or len(embeddings) != len(rows):
        raise RuntimeError(f"unexpected response shape: {json.dumps(data)[:2000]}")

    with open(OUT, "w") as f:
        for row, emb in zip(rows, embeddings):
            values = emb["values"]
            assert len(values) == DIM, f"expected {DIM} dims, got {len(values)}"
            f.write(json.dumps({
                "documentId": row["documentId"],
                "contentHash": row["contentHash"],
                "chunkKey": row["chunkKey"],
                "headingPath": row["headingPath"],
                "embedding": values,
            }) + "\n")

    print(f"wrote {len(rows)} embeddings to {OUT}")


if __name__ == "__main__":
    main()
