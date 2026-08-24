#!/usr/bin/env python3
"""Confirm bge-m3's small cosine shift on large chunks is length DILUTION,
not partial truncation.

Method: take one large chunk, cut it to increasing prefix lengths, and for each
length compare cosine(prefix, prefix + marker).

  - Dilution  -> cosine rises smoothly with length (the marker is a shrinking
                 fraction of the text) and NEVER reaches exactly 1.0.
  - Truncation-> cosine jumps to exactly 1.0 once the prefix exceeds the
                 model's context limit, because the marker falls off the end.

The shape of the curve distinguishes them unambiguously.
"""
import json
import urllib.request

ENV = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/.env.local"
CHUNKS = "/mnt/d/uetgpt_corpus_v1/embeddings/all_chunks.jsonl"
MARKER = (" The secret annual convocation ceremony for the department of "
          "aeronautical engineering is scheduled for the twenty ninth of "
          "February in the grand auditorium at Taxila.")


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


def embed(account, token, model, texts):
    url = f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}"
    req = urllib.request.Request(
        url, data=json.dumps({"text": texts}).encode(),
        headers={"Authorization": f"Bearer {token}",
                 "Content-Type": "application/json"},
        method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        res = json.loads(r.read().decode())["result"]
    for k in ("data", "embeddings", "vectors"):
        if isinstance(res.get(k), list):
            return res[k]
    raise RuntimeError("unexpected shape")


def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    return dot / ((sum(x*x for x in a) ** 0.5) * (sum(x*x for x in b) ** 0.5))


def main():
    env = read_env()
    account, token = env["account"], env["token"]

    biggest = ""
    with open(CHUNKS) as f:
        for line in f:
            t = json.loads(line).get("text") or ""
            if len(t) > len(biggest):
                biggest = t
            if len(biggest) >= 7200:
                break

    lengths = [400, 1000, 2000, 4000, 7200]
    for model in ("@cf/baai/bge-m3", "@cf/google/embeddinggemma-300m"):
        print(f"=== {model} ===")
        payload = []
        for L in lengths:
            p = biggest[:L]
            payload += [p, p + MARKER]
        vecs = embed(account, token, model, payload)
        for i, L in enumerate(lengths):
            c = cosine(vecs[2*i], vecs[2*i + 1])
            flag = "  <-- EXACTLY 1.0 = marker not read" if c > 0.99999 else ""
            print(f"  prefix {L:>5} chars: cosine = {c:.6f}{flag}")
        print()


if __name__ == "__main__":
    main()
