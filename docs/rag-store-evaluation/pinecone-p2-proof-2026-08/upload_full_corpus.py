#!/usr/bin/env python3
"""Mandate §51-§55: the real full-corpus upsert, authorized by the user
2026-08-29 conditional on verify_upload_mechanism.py passing first (it did,
9/9 checks, see verify-run.log). Same conventions, cross-verified against
real Pinecone data before this run:
  - vector ID = sha256hex(f"{chunkKey}|{documentId}|1")  (computeRagVersionKey)
  - metadata = {documentId, chunkKey, category:"crawled", generation:1}
    (pineconeAdapter.ts:173/173, category confirmed from
    convex/crawl/mutations.ts:342/1461, not invented)
  - namespace = corpus-v1-full (isolated from the test-verify-2026-08-29
    namespace already used and cleaned up)
  - batch size 60 records - MEASURED (not estimated) from 200 real records:
    ~22,990 bytes/record JSON-serialized (floats as decimal text, not raw
    binary - the original 4,278-byte estimate was wrong by ~5.4x, see
    upsert-authorization-request.md's correction), giving a safe ceiling of
    73 records/2MB; 60 leaves extra margin.
  - stops immediately on any batch failure - no silent partial-progress
    continuation, no retry-until-it-works loop that could mask a real
    problem (mandate §53: bounded, not infinite)."""
import hashlib
import json
import sys
import time

from pinecone import Pinecone
from lsn_utils import write_lsn, max_indexed_lsn

ENV_LOCAL = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/.env.local"
INDEX_NAME = "uetgpt-corpus-v1-qwen1024"
NAMESPACE = "corpus-v1-full"
CHUNKS = "/mnt/d/uetgpt_corpus_v1/embeddings/cf_embeddings.jsonl"
DIM = 1024
GENERATION = 1
CATEGORY = "crawled"
BATCH_SIZE = 60
EXPECTED_COUNT = 44792


def read_key():
    with open(ENV_LOCAL) as f:
        for line in f:
            if line.startswith("PINECONE_API_KEY="):
                return line.strip().split("=", 1)[1]
    raise RuntimeError("PINECONE_API_KEY not found")


def vector_id(chunk_key, document_id, generation):
    text = f"{chunk_key}|{document_id}|{generation}"
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_records():
    records = []
    seen_ids = set()
    with open(CHUNKS) as f:
        for line in f:
            d = json.loads(line)
            vid = vector_id(d["chunkKey"], d["documentId"], GENERATION)
            if vid in seen_ids:
                sys.exit(f"FATAL: duplicate vector id {vid} - two chunks collided, stopping "
                          f"before any upload rather than silently overwriting one")
            seen_ids.add(vid)
            records.append({
                "id": vid,
                "values": d["embedding"],
                "metadata": {
                    "documentId": d["documentId"],
                    "chunkKey": d["chunkKey"],
                    "category": CATEGORY,
                    "generation": GENERATION,
                },
            })
    return records


def main():
    pc = Pinecone(api_key=read_key())
    index = pc.Index(INDEX_NAME)

    print("loading and hashing all chunks...")
    records = load_records()
    n = len(records)
    print(f"loaded {n:,} records (expected {EXPECTED_COUNT:,})")
    if n != EXPECTED_COUNT:
        sys.exit(f"FATAL: chunk count {n} != expected {EXPECTED_COUNT} - source file drifted, "
                  f"stopping before any upload rather than uploading an unexpected count")

    t0 = time.time()
    last_lsn = None
    n_batches = -(-n // BATCH_SIZE)
    for i in range(0, n, BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        try:
            resp = index.upsert(vectors=batch, namespace=NAMESPACE)
        except Exception as e:
            sys.exit(f"FATAL: batch {batch_num}/{n_batches} (records {i}-{i+len(batch)}) "
                      f"failed: {e}\nStopped immediately - {i} records upserted before this "
                      f"failure. Safe to re-run from scratch (upsert is idempotent by id).")
        lsn = write_lsn(resp)
        if lsn is not None:
            last_lsn = lsn
        if batch_num % 50 == 0 or batch_num == n_batches:
            elapsed = time.time() - t0
            print(f"  batch {batch_num}/{n_batches}  ({i+len(batch):,}/{n:,} records)  "
                  f"lsn={lsn}  elapsed={elapsed:.0f}s", flush=True)

    print(f"\nall {n_batches} batches upserted in {time.time()-t0:.0f}s. last write LSN: {last_lsn}")

    if last_lsn is not None:
        print("waiting for write visibility (LSN-verified, not slept)...")
        deadline = time.monotonic() + 120.0
        poll_vector = [0.0] * DIM
        attempts = 0
        seen = None
        while time.monotonic() < deadline:
            attempts += 1
            resp = index.query(namespace=NAMESPACE, vector=poll_vector, top_k=1)
            seen = max_indexed_lsn(resp)
            if seen is not None and seen >= last_lsn:
                print(f"  reconciled after {attempts} polls, max_indexed_lsn={seen}")
                break
            time.sleep(1.0)
        else:
            sys.exit(f"FATAL: namespace did not reconcile to LSN {last_lsn} within 120s "
                      f"(last seen {seen}) - data is uploaded but visibility is NOT confirmed, "
                      f"do not proceed to benchmarking yet")

    print("\nverifying final count via describeIndexStats...")
    time.sleep(2.0)  # brief settle before stats, which is separate from the LSN-verified query path above
    stats = index.describe_index_stats()
    ns_stats = stats.namespaces.get(NAMESPACE)
    actual_count = ns_stats.vector_count if ns_stats else 0
    print(f"  vectors in {NAMESPACE}: {actual_count:,} (expected {n:,})")
    if actual_count != n:
        print(f"  WARNING: count mismatch - describeIndexStats can lag slightly behind "
              f"LSN-confirmed writes; re-check with the fetch spot-check below before concluding failure")

    print("\nspot-checking 20 records by fetch-by-id...")
    import random
    random.seed(42)
    sample = random.sample(records, 20)
    fetch_resp = index.fetch(ids=[r["id"] for r in sample], namespace=NAMESPACE)
    fetched = fetch_resp.vectors
    ok = 0
    for r in sample:
        rec = fetched.get(r["id"])
        if rec is None:
            print(f"  MISSING: {r['id'][:16]}...")
            continue
        meta_ok = (rec.metadata.get("documentId") == r["metadata"]["documentId"]
                   and rec.metadata.get("chunkKey") == r["metadata"]["chunkKey"])
        if meta_ok:
            ok += 1
        else:
            print(f"  METADATA MISMATCH: {r['id'][:16]}...")
    print(f"  {ok}/20 spot-checked records verified correct")

    print(f"\nDONE. {n:,} vectors uploaded to {INDEX_NAME}/{NAMESPACE}. "
          f"{'PASS' if ok == 20 and actual_count == n else 'REVIEW NEEDED - see warnings above'}")


if __name__ == "__main__":
    main()
