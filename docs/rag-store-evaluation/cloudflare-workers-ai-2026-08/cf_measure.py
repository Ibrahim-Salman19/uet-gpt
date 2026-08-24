#!/usr/bin/env python3
"""Measure real neuron cost against ACTUAL corpus chunks, not toy strings.

Answers the questions that decide whether this plan is viable:
  1. neurons per chunk at realistic sizes -> chunks/day within the free 10k
  2. does the largest chunk (7200 chars, ~1800 tok) survive embeddinggemma's
     2048-token limit without error or silent truncation?
  3. what batch size actually works?

Kept small on purpose. Never prints the token.
"""
import json
import urllib.request
import urllib.error

ENV = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/.env.local"
CHUNKS = "/mnt/d/uetgpt_corpus_v1/embeddings/all_chunks.jsonl"
FREE_NEURONS_PER_DAY = 10_000


def read_env():
    vals = {}
    with open(ENV) as f:
        for line in f:
            line = line.strip()
            if line.startswith("CLOUDFLARE_ACCOUNT_ID="):
                vals["account"] = line.split("=", 1)[1]
            elif line.startswith("CLOUDFLARE_API_TOKEN="):
                vals["token"] = line.split("=", 1)[1]
    return vals


def run(account, token, model, payload):
    url = f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}"
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {token}",
                 "Content-Type": "application/json"},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, dict(r.headers), json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), json.loads(e.read().decode() or "{}")


def vecs_of(body):
    res = body.get("result") if isinstance(body, dict) else None
    if not isinstance(res, dict):
        return None
    for k in ("data", "embeddings", "vectors"):
        if isinstance(res.get(k), list):
            return res[k]
    return None


def load_chunks():
    small, large = [], []
    with open(CHUNKS) as f:
        for line in f:
            d = json.loads(line)
            t = d.get("text") or d.get("content") or ""
            if len(t) > 7000 and len(large) < 12:
                large.append(t)
            elif 500 < len(t) < 1500 and len(small) < 12:
                small.append(t)
            if len(small) >= 12 and len(large) >= 12:
                break
    return small, large


def main():
    env = read_env()
    account, token = env["account"], env["token"]
    small, large = load_chunks()
    print(f"loaded {len(small)} typical chunks, {len(large)} large chunks")
    print(f"  typical avg chars: {sum(map(len, small))//len(small)}")
    print(f"  large   avg chars: {sum(map(len, large))//len(large)}")

    total_chars = 92_907_926
    total_chunks = 44_792

    for model in ("@cf/baai/bge-m3", "@cf/google/embeddinggemma-300m"):
        print(f"\n=== {model} ===")

        for label, batch in (("typical x10", small[:10]), ("large x10", large[:10])):
            status, headers, body = run(account, token, model, {"text": batch})
            v = vecs_of(body)
            neurons = headers.get("cf-ai-neurons")
            chars = sum(map(len, batch))
            if status != 200 or not v:
                print(f"  {label}: HTTP {status} -> {json.dumps(body)[:300]}")
                continue
            per_char = float(neurons) / chars if neurons else 0
            print(f"  {label}: {len(v)} vecs dim={len(v[0])}, "
                  f"{chars} chars, neurons={neurons} "
                  f"({per_char*1e6:.4f} neurons/M chars)")

            if label == "large x10":
                projected = per_char * total_chars
                print(f"    -> full corpus ({total_chars/1e6:.1f}M chars): "
                      f"~{projected:.0f} neurons")
                if projected > 0:
                    print(f"    -> days at {FREE_NEURONS_PER_DAY}/day free: "
                          f"{projected/FREE_NEURONS_PER_DAY:.2f}")

        # largest single chunk - does it survive the context limit?
        biggest = max(large, key=len)
        status, headers, body = run(account, token, model, {"text": biggest})
        v = vecs_of(body)
        print(f"  largest single chunk ({len(biggest)} chars): HTTP {status}, "
              f"{'dim=' + str(len(v[0])) if v else json.dumps(body)[:200]}")

    # max batch probe on the cheaper model
    print("\n=== batch size probe (@cf/baai/bge-m3) ===")
    for n in (25, 50, 100):
        batch = (small * 20)[:n]
        status, headers, body = run(account, token, "@cf/baai/bge-m3", {"text": batch})
        v = vecs_of(body)
        print(f"  batch {n}: HTTP {status}, vecs={len(v) if v else '-'}, "
              f"neurons={headers.get('cf-ai-neurons')}"
              + ("" if status == 200 else f" -> {json.dumps(body)[:200]}"))


if __name__ == "__main__":
    main()
