#!/usr/bin/env python3
"""Quantify how much the 17.1% duplicate-chunk-text problem actually costs
retrieval, before recommending a fix for it.

Method: use already-embedded chunks as queries against the already-embedded
set (zero API cost - no new inference). For each probe, look at top-10
neighbours and measure how many slots are consumed by text that is
byte-identical to another result already in that same top-10.

That number is the concrete harm: every slot lost to a duplicate is a slot
not carrying new information to the LLM. It also tells us how much a
near-duplicate/MMR filter would actually recover, rather than assuming the
community's 20-30% figure applies here.

Reports the distribution, not just a mean - a fix justified by an average that
hides a bimodal distribution would be a bad fix.
"""
import json
import random
import sys

import numpy as np

BASE = "/mnt/d/uetgpt_corpus_v1/embeddings"
EMB = f"{BASE}/cf_embeddings.jsonl"
CHUNKS = f"{BASE}/all_chunks.jsonl"

N_PROBES = 300
TOP_K = 10
SEED = 20260825


def main():
    print("loading embeddings...", flush=True)
    keys, vecs = [], []
    with open(EMB) as f:
        for line in f:
            d = json.loads(line)
            keys.append((d["documentId"], d["chunkKey"]))
            vecs.append(d["embedding"])
    if not vecs:
        sys.exit("no embeddings yet")
    M = np.asarray(vecs, dtype=np.float32)   # already L2-normalized
    print(f"  {M.shape[0]:,} vectors x {M.shape[1]}d", flush=True)

    print("loading texts...", flush=True)
    want = set(keys)
    text = {}
    with open(CHUNKS) as f:
        for line in f:
            d = json.loads(line)
            k = (d["documentId"], d["chunkKey"])
            if k in want:
                text[k] = d.get("text") or ""

    idx_of = {k: i for i, k in enumerate(keys)}
    rng = random.Random(SEED)
    probes = rng.sample(range(len(keys)), min(N_PROBES, len(keys)))

    dup_counts = []
    affected = 0
    for pi in probes:
        sims = M @ M[pi]
        top = np.argpartition(-sims, TOP_K)[: TOP_K + 1]
        top = [int(i) for i in top[np.argsort(-sims[top])] if int(i) != pi][:TOP_K]

        seen, dups = set(), 0
        for i in top:
            t = text.get(keys[i], "")
            if t in seen:
                dups += 1          # this slot carried no new information
            else:
                seen.add(t)
        dup_counts.append(dups)
        if dups:
            affected += 1

    arr = np.asarray(dup_counts)
    print(f"\n=== duplicate crowding in top-{TOP_K} ({len(probes)} probes) ===")
    print(f"  mean redundant slots:   {arr.mean():.2f} / {TOP_K}"
          f"  ({arr.mean()/TOP_K*100:.1f}% of the window)")
    print(f"  median:                 {int(np.median(arr))}")
    print(f"  queries with >=1 dup:   {affected} ({affected/len(probes)*100:.1f}%)")
    print(f"  worst case:             {int(arr.max())} redundant slots")
    print()
    print("  distribution (redundant slots -> query count):")
    for v in range(0, TOP_K + 1):
        c = int((arr == v).sum())
        if c:
            print(f"    {v:>2}: {'#' * min(c, 50)} {c}")

    print()
    recovered = arr.mean()
    print(f"A near-duplicate/MMR filter would recover ~{recovered:.2f} of {TOP_K} "
          f"slots per query on average,")
    print(f"i.e. ~{recovered/TOP_K*100:.0f}% more distinct context reaching the LLM, "
          f"at no inference cost.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
