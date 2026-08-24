#!/usr/bin/env python3
"""Cloudflare Workers AI verification pass.

Deliberately tiny: a handful of short texts, to establish facts we have so far
only read in docs -- actual output dimensions, whether array batching works,
and what a call actually costs -- BEFORE committing to any bulk embed.

Never prints the token.
"""
import json
import urllib.request
import urllib.error

ENV = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/.env.local"


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


def run_model(account, token, model, payload):
    url = f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode())
            return resp.status, dict(resp.headers), body
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), json.loads(e.read().decode() or "{}")


def describe(body):
    """Pull the vector list out of whatever shape the response uses."""
    if not isinstance(body, dict):
        return None
    result = body.get("result")
    if not isinstance(result, dict):
        return None
    for key in ("data", "embeddings", "vectors"):
        if key in result and isinstance(result[key], list):
            return result[key]
    return None


def main():
    env = read_env()
    account, token = env.get("account"), env.get("token")
    if not account or not token:
        print("MISSING account id or token in .env.local")
        return
    print(f"account id: {account[:6]}...{account[-4:]}  (token present, not printed)")

    texts = [
        "UET Taxila admission requirements for undergraduate programs",
        "The library remains open until 8 PM on weekdays.",
        "Fee structure for the Computer Science department.",
    ]

    for model in ("@cf/baai/bge-m3", "@cf/google/embeddinggemma-300m"):
        print(f"\n=== {model} ===")

        # 1. single string
        status, headers, body = run_model(account, token, model, {"text": texts[0]})
        vecs = describe(body)
        if status != 200:
            print(f"  single-string: HTTP {status}")
            print(f"    {json.dumps(body)[:400]}")
            continue
        print(f"  single-string: HTTP 200, "
              f"{len(vecs) if vecs else '?'} vector(s), "
              f"dim={len(vecs[0]) if vecs else '?'}")

        # 2. array batching
        status2, headers2, body2 = run_model(account, token, model, {"text": texts})
        vecs2 = describe(body2)
        if status2 == 200 and vecs2:
            print(f"  array batch of 3: HTTP 200, {len(vecs2)} vectors, "
                  f"dim={len(vecs2[0])}")
        else:
            print(f"  array batch of 3: HTTP {status2} -> {json.dumps(body2)[:300]}")

        # 3. normalization check (are vectors unit length?)
        if vecs2:
            for i, v in enumerate(vecs2[:2]):
                norm = sum(x * x for x in v) ** 0.5
                print(f"    vec[{i}] L2 norm = {norm:.6f}")

        # 4. any usage/neuron accounting surfaced?
        usage = body2.get("result", {}).get("usage") if isinstance(body2, dict) else None
        if usage:
            print(f"    usage reported: {usage}")
        interesting = {k: v for k, v in headers2.items()
                       if any(s in k.lower() for s in ("neuron", "usage", "ratelimit", "cf-"))}
        if interesting:
            print(f"    headers: {interesting}")


if __name__ == "__main__":
    main()
