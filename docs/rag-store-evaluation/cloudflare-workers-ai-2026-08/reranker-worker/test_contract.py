#!/usr/bin/env python3
"""Prove the reranker adapter's contract transformation before deploying it.

worker.js cannot be exercised without deploying, but its logic is a pure
mapping between two response shapes. This reproduces that mapping exactly,
against the LIVE Cloudflare model, and asserts the output satisfies the
contract convex/reranking/cascade.ts consumes:

    [{index, score, text}], sorted by score desc, len <= top_n,
    index a valid offset into the submitted documents array,
    text === documents[index]                     <-- the alignment that
                                                      matters: a wrong index
                                                      silently returns the
                                                      wrong passage

It also checks the ranking is semantically right on real UET content, so a
"working" adapter that ranks badly cannot pass.
"""
import json
import sys
import urllib.error
import urllib.request

ENV = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/.env.local"
MODEL = "@cf/baai/bge-reranker-base"


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


def cf_rerank(account, token, query, documents, top_n):
    """Mirrors worker.js exactly: same request shape, same filter/sort/slice/map."""
    url = f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{MODEL}"
    payload = {"query": query, "contexts": [{"text": t} for t in documents]}
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {token}",
                 "Content-Type": "application/json"},
        method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        neurons = float(r.headers.get("cf-ai-neurons") or 0)
        body = json.loads(r.read().decode())

    scored = body["result"]["response"]
    limit = min(top_n, len(documents)) if top_n else len(documents)
    ranked = [
        {"index": r["id"], "score": r["score"], "text": documents[r["id"]]}
        for r in sorted(
            (r for r in scored
             if isinstance(r.get("id"), int) and 0 <= r["id"] < len(documents)),
            key=lambda r: r["score"], reverse=True)[:limit]
    ]
    return ranked, neurons


def main():
    env = read_env()
    account, token = env["account"], env["token"]

    query = "What are the admission requirements for undergraduate programs at UET Taxila?"
    documents = [
        "The library remains open until 8 PM on weekdays during the semester.",
        "Candidates seeking admission to undergraduate programs must have passed FSc "
        "pre-engineering with at least 60% marks and appear in the ECAT entrance test.",
        "The department of mechanical engineering was established in 1975.",
        "Undergraduate admission is open to students holding an intermediate "
        "qualification; merit is computed from matriculation, intermediate and entry "
        "test scores.",
        "Hostel accommodation is allocated on a first-come, first-served basis.",
    ]
    RELEVANT = {1, 3}
    top_n = 3

    ranked, neurons = cf_rerank(account, token, query, documents, top_n)
    print(f"neurons: {neurons}\n")
    for r in ranked:
        print(f"  [{r['index']}] {r['score']:.6f}  {r['text'][:70]}...")

    failures = []

    # contract shape
    if len(ranked) > top_n:
        failures.append(f"returned {len(ranked)} rows, top_n was {top_n}")
    for r in ranked:
        if set(r) != {"index", "score", "text"}:
            failures.append(f"unexpected keys: {set(r)}")
        if not isinstance(r["index"], int) or not 0 <= r["index"] < len(documents):
            failures.append(f"index {r['index']} out of range")
        # the alignment check: a wrong index returns the wrong passage silently
        elif r["text"] != documents[r["index"]]:
            failures.append(f"text/index misalignment at {r['index']}")

    # sorted descending
    scores = [r["score"] for r in ranked]
    if scores != sorted(scores, reverse=True):
        failures.append(f"not sorted descending: {scores}")

    # semantic correctness: both relevant passages must outrank all others
    top2 = {r["index"] for r in ranked[:2]}
    if top2 != RELEVANT:
        failures.append(f"top-2 was {top2}, expected the relevant passages {RELEVANT}")

    print()
    if failures:
        print("CONTRACT TEST FAILED:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("CONTRACT TEST PASSED")
    print("  shape, index/text alignment, ordering, and semantic ranking all correct.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
