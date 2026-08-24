#!/usr/bin/env python3
"""Does the endpoint silently truncate our largest chunks?

An HTTP 200 proves nothing -- a model that truncates still returns 200. So test
the observable consequence instead: embed a large chunk, then embed the SAME
chunk with a distinctive sentence appended at the very END.

  - If the model reads the whole text, the two vectors differ measurably.
  - If it truncated before reaching the tail, the vectors are ~identical
    (cosine ~1.0), because the appended text was never seen.

Control: do the same on a SHORT text, where no truncation is possible. The
short-text delta shows how much appending that sentence *should* move a vector.
"""
import json
import urllib.request
import urllib.error

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
        body = json.loads(r.read().decode())
    res = body["result"]
    for k in ("data", "embeddings", "vectors"):
        if isinstance(res.get(k), list):
            return res[k]
    raise RuntimeError(f"unexpected shape: {list(res)}")


def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(x * x for x in b) ** 0.5
    return dot / (na * nb)


def main():
    env = read_env()
    account, token = env["account"], env["token"]

    biggest = ""
    short = ""
    with open(CHUNKS) as f:
        for line in f:
            d = json.loads(line)
            t = d.get("text") or d.get("content") or ""
            if len(t) > len(biggest):
                biggest = t
            if not short and 300 < len(t) < 600:
                short = t
            if len(biggest) >= 7200 and short:
                break

    print(f"large chunk: {len(biggest)} chars")
    print(f"short control: {len(short)} chars\n")

    for model in ("@cf/baai/bge-m3", "@cf/google/embeddinggemma-300m"):
        print(f"=== {model} ===")
        # batch so both variants are embedded under identical conditions
        vl, vl_marked, vs, vs_marked = embed(
            account, token, model,
            [biggest, biggest + MARKER, short, short + MARKER])

        c_large = cosine(vl, vl_marked)
        c_short = cosine(vs, vs_marked)
        print(f"  LARGE  ({len(biggest)} chars): cosine(orig, orig+marker) = {c_large:.6f}")
        print(f"  SHORT  ({len(short)} chars, control): cosine = {c_short:.6f}")

        if c_large > 0.99999:
            verdict = "TRUNCATED - tail never read (vectors identical)"
        elif c_large > c_short + 0.02:
            verdict = "SUSPICIOUS - tail moved vector far less than control"
        else:
            verdict = "OK - tail was read, comparable to control"
        print(f"  verdict: {verdict}\n")


if __name__ == "__main__":
    main()
