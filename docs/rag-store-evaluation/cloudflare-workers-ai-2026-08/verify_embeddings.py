#!/usr/bin/env python3
"""Completeness + integrity verification for the embedded corpus.

Run after the embedding job reports finished. Answers the only questions that
matter before the vectors are trusted downstream:

  1. Is every source chunk present, exactly once?          (completeness)
  2. Is every vector structurally valid?                    (integrity)
  3. Is every vector actually distinct and meaningful?      (silent-failure)
  4. Does every record carry its model/dims provenance?     (auditability)

(3) exists because the dangerous failure mode is not a crash, it is a file full
of plausible-looking vectors that are secretly identical, zero, or duplicated -
which produces confidently wrong retrieval rather than an error. An earlier
model in this evaluation was caught silently truncating precisely because it
returned HTTP 200 the whole time.

Exit code 0 = safe to proceed, 1 = do not upsert.
"""
import json
import math
import sys
from collections import Counter

BASE = "/mnt/d/uetgpt_corpus_v1/embeddings"
CHUNKS = f"{BASE}/all_chunks.jsonl"
EMB = f"{BASE}/cf_embeddings.jsonl"
FAILED = f"{BASE}/cf_embed_failures.jsonl"

EXPECTED_MODEL = "@cf/qwen/qwen3-embedding-0.6b"
EXPECTED_DIM = 1024
NORM_TOL = 0.05


def main():
    problems = []

    source = {}
    with open(CHUNKS) as f:
        for line in f:
            d = json.loads(line)
            source[(d["documentId"], d["chunkKey"])] = d.get("contentHash")
    print(f"source chunks:        {len(source):,}")

    seen = Counter()
    dims = Counter()
    models = Counter()
    bad_norm = 0
    non_finite = 0
    all_zero = 0
    fingerprints = Counter()
    n = 0

    with open(EMB) as f:
        for lineno, line in enumerate(f, 1):
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                problems.append(f"line {lineno}: unparseable JSON")
                continue
            n += 1
            key = (d.get("documentId"), d.get("chunkKey"))
            seen[key] += 1
            models[d.get("model")] += 1
            v = d.get("embedding")
            if not isinstance(v, list):
                problems.append(f"line {lineno}: embedding is not a list")
                continue
            dims[len(v)] += 1
            if not all(isinstance(x, (int, float)) and math.isfinite(x) for x in v):
                non_finite += 1
                continue
            norm = math.sqrt(sum(x * x for x in v))
            if norm == 0.0:
                all_zero += 1
            elif abs(norm - 1.0) > NORM_TOL:
                bad_norm += 1
            # cheap collision fingerprint: catches a file of identical vectors
            fingerprints[tuple(round(x, 5) for x in v[:8])] += 1

    print(f"embedding records:    {n:,}")
    print(f"unique identities:    {len(seen):,}")

    # 1. completeness
    missing = set(source) - set(seen)
    extra = set(seen) - set(source)
    dupes = {k: c for k, c in seen.items() if c > 1}
    print(f"\n--- completeness ---")
    print(f"missing from output:  {len(missing):,}")
    print(f"not in source:        {len(extra):,}")
    print(f"duplicated:           {len(dupes):,}")
    if missing:
        problems.append(f"{len(missing)} source chunks were never embedded")
        for k in list(missing)[:3]:
            print(f"    e.g. missing {k[0]}:{k[1][:16]}...")
    if extra:
        problems.append(f"{len(extra)} records do not correspond to any source chunk")
    if dupes:
        problems.append(f"{len(dupes)} identities appear more than once")

    # 2. integrity
    print(f"\n--- integrity ---")
    print(f"dimensions observed:  {dict(dims)}")
    print(f"models observed:      {dict(models)}")
    print(f"non-finite vectors:   {non_finite}")
    print(f"all-zero vectors:     {all_zero}")
    print(f"norm outside 1+-{NORM_TOL}:  {bad_norm}")
    if set(dims) - {EXPECTED_DIM}:
        problems.append(f"unexpected dimensions present: {dict(dims)}")
    if set(models) - {EXPECTED_MODEL}:
        problems.append(f"unexpected/missing model provenance: {dict(models)}")
    if non_finite:
        problems.append(f"{non_finite} vectors contain NaN/Inf")
    if all_zero:
        problems.append(f"{all_zero} vectors are all-zero")
    if bad_norm:
        problems.append(f"{bad_norm} vectors are not unit-norm")

    # 3. silent-failure: are the vectors actually distinct?
    print(f"\n--- distinctness ---")
    worst = fingerprints.most_common(1)
    if worst:
        fp, cnt = worst[0]
        print(f"most repeated 8-dim prefix appears: {cnt:,} time(s)")
        # identical prefixes across many DIFFERENT chunks implies the model
        # returned a constant vector - the classic silent embedding failure
        if cnt > max(10, n * 0.001):
            problems.append(
                f"{cnt} vectors share an identical leading fingerprint - "
                f"possible constant/degenerate embeddings")
    print(f"distinct fingerprints: {len(fingerprints):,} of {n:,}")

    # 4. recorded failures
    try:
        with open(FAILED) as f:
            fails = [json.loads(l) for l in f if l.strip()]
    except FileNotFoundError:
        fails = []
    print(f"\n--- recorded failures ---")
    print(f"failure records:      {len(fails)}")
    if fails:
        reasons = Counter(x.get("reason") for x in fails)
        for r, c in reasons.most_common(5):
            print(f"    {c:>5}  {r}")
        problems.append(f"{len(fails)} chunks recorded as failed and were never embedded")

    print("\n" + "=" * 60)
    if problems:
        print("VERIFICATION FAILED - do not upsert:")
        for p in problems:
            print(f"  - {p}")
        return 1
    print(f"VERIFICATION PASSED")
    print(f"  {n:,}/{len(source):,} chunks embedded, all {EXPECTED_DIM}d, "
          f"unit-norm, distinct, full provenance.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
