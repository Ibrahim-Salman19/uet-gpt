#!/usr/bin/env python3
"""Two gating checks before recommending a model.

A. TRUNCATION for qwen3-embedding-0.6b. Only bge-m3 and embeddinggemma were
   tested earlier; embeddinggemma failed. A model cannot be recommended on cost
   or quality until it is shown to read our largest chunks.

B. CLEAN ABSOLUTE COST. Earlier per-char rates disagreed wildly (282 vs 519 vs
   1620 neurons/M chars), so the absolute projection is untrustworthy. Measure
   on a RANDOM representative sample, one pass, no retries, no batch splitting,
   recording neurons per request -- and also test whether batch shape changes
   the price, which would explain the disagreement.
"""
import json
import random
import time
import urllib.request
import urllib.error

ENV = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/.env.local"
CHUNKS = "/mnt/d/uetgpt_corpus_v1/embeddings/all_chunks.jsonl"
TOTAL_CHARS = 92_907_926
TOTAL_CHUNKS = 44_792
MARKER = (" The secret annual convocation ceremony for the department of "
          "aeronautical engineering is scheduled for the twenty ninth of "
          "February in the grand auditorium at Taxila.")


def read_env():
    v = {}
    for line in open(ENV):
        line = line.strip()
        if line.startswith("CLOUDFLARE_ACCOUNT_ID="):
            v["account"] = line.split("=", 1)[1]
        elif line.startswith("CLOUDFLARE_API_TOKEN="):
            v["token"] = line.split("=", 1)[1]
    return v


def post(account, token, model, texts):
    url = f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}"
    req = urllib.request.Request(
        url, data=json.dumps({"text": texts}).encode(),
        headers={"Authorization": f"Bearer {token}",
                 "Content-Type": "application/json"},
        method="POST")
    with urllib.request.urlopen(req, timeout=180) as r:
        neurons = float(r.headers.get("cf-ai-neurons") or 0)
        res = json.loads(r.read().decode())["result"]
    for k in ("data", "embeddings", "vectors"):
        if isinstance(res.get(k), list):
            return res[k], neurons
    raise RuntimeError("shape")


def cosine(a, b):
    return sum(x * y for x, y in zip(a, b))


def main():
    env = read_env()
    acct, tok = env["account"], env["token"]

    all_chunks = []
    biggest = ""
    for line in open(CHUNKS):
        t = json.loads(line).get("text") or ""
        if len(t) > len(biggest):
            biggest = t
        if len(t) > 200:
            all_chunks.append(t)
    print(f"corpus: {len(all_chunks)} usable chunks, largest {len(biggest)} chars\n")

    # ---------- A. truncation ----------
    print("=== A. truncation check (does the model read the tail?) ===")
    for model in ("@cf/qwen/qwen3-embedding-0.6b", "@cf/baai/bge-m3"):
        vecs, _ = post(acct, tok, model, [biggest, biggest + MARKER])
        c = cosine(vecs[0], vecs[1])
        verdict = ("TRUNCATED - tail never read" if c > 0.99999
                   else "OK - tail was read")
        print(f"  {model:<34} cosine={c:.6f}  {verdict}")
        time.sleep(2)

    # ---------- B. clean cost on a random representative sample ----------
    print("\n=== B. cost on a RANDOM representative sample ===")
    rng = random.Random(7)
    sample = rng.sample(all_chunks, 400)
    schars = sum(map(len, sample))
    print(f"  sample: {len(sample)} random chunks, {schars} chars, "
          f"avg {schars // len(sample)}")
    print(f"  (corpus avg is {TOTAL_CHARS // TOTAL_CHUNKS} chars/chunk)\n")

    for model in ("@cf/qwen/qwen3-embedding-0.6b", "@cf/baai/bge-m3"):
        total_neu = 0.0
        sent = 0
        batch, size = [], 0
        for t in sample:
            if batch and size + len(t) > 50_000:
                _, n = post(acct, tok, model, batch)
                total_neu += n
                sent += len(batch)
                batch, size = [], 0
                time.sleep(2)
            batch.append(t)
            size += len(t)
        if batch:
            _, n = post(acct, tok, model, batch)
            total_neu += n
            sent += len(batch)
            time.sleep(2)

        per_mchar = total_neu / (schars / 1e6)
        full = per_mchar * TOTAL_CHARS / 1e6
        print(f"  {model}")
        print(f"    {sent} chunks, {total_neu:.2f} neurons "
              f"=> {per_mchar:.1f} neurons/M chars")
        print(f"    full corpus ~{full:,.0f} neurons = {full / 10000:.2f} days "
              f"at 10k/day free")

    # ---------- C. does batch shape change price? ----------
    print("\n=== C. does batch SHAPE change the price? (same texts, "
          "different batching) ===")
    probe = sample[:40]
    pchars = sum(map(len, probe))
    for model in ("@cf/qwen/qwen3-embedding-0.6b", "@cf/baai/bge-m3"):
        # one big batch
        _, n_one = post(acct, tok, model, probe)
        time.sleep(2)
        # many small batches
        n_many = 0.0
        for i in range(0, len(probe), 5):
            _, n = post(acct, tok, model, probe[i:i + 5])
            n_many += n
            time.sleep(2)
        print(f"  {model}")
        print(f"    {pchars} chars as 1 batch of 40 : {n_one:.2f} neurons")
        print(f"    same chars as 8 batches of 5   : {n_many:.2f} neurons "
              f"({n_many / n_one:.2f}x)")


if __name__ == "__main__":
    main()
