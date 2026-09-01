#!/usr/bin/env python3
"""Mandate §51/§55: verify the exact upload mechanism end-to-end on a THROWAWAY
namespace, with real vectors and full round-trip checks, before touching the
real corpus-v1-full namespace. Run this, read its output carefully, and only
proceed to the full upload if every check below prints PASS.

Reuses pineconeAdapter.ts's exact conventions (verified by reading the source,
not guessed):
  - vector ID = sha256hex(f"{chunkKey}|{documentId}|{generation}")
    (computeRagVersionKey, chunkKey.ts:121 - cross-verified this session that
    Node's crypto.subtle and Python's hashlib produce byte-identical hex for
    the same input string)
  - metadata = {documentId, chunkKey, category, generation} - no chunk text
    (pineconeAdapter.ts:173)
  - category = "crawled" (the REAL production value, confirmed from
    convex/crawl/mutations.ts:342/1461 - not invented)
  - generation = 1 (explicit, fixed for this one-time corpus load - no prior
    generation exists for these ids)
  - delete by explicit id, never by filter (module docs, pineconeAdapter.ts:44-51)

Reuses lsn_utils.py's header-parsing helpers (dimension-agnostic) but supplies
its own wait_for_write_visibility with a 1024-dim poll vector - the original
lsn_utils.py hardcodes 768 (correct for the OLD uetgpt-p2-proof index it was
written for, wrong for the current uetgpt-corpus-v1-qwen1024 index). Reusing
that file unmodified would silently break on a dimension mismatch - caught by
reading it in full before reuse, not by trusting the filename."""
import hashlib
import json
import sys
import time

from pinecone import Pinecone
from lsn_utils import _lsn_from_headers, write_lsn, max_indexed_lsn

ENV_LOCAL = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/.env.local"
INDEX_NAME = "uetgpt-corpus-v1-qwen1024"
TEST_NAMESPACE = "test-verify-2026-08-29"
CHUNKS = "/mnt/d/uetgpt_corpus_v1/embeddings/cf_embeddings.jsonl"
DIM = 1024
GENERATION = 1
CATEGORY = "crawled"
N_TEST = 5


def read_key():
    with open(ENV_LOCAL) as f:
        for line in f:
            if line.startswith("PINECONE_API_KEY="):
                return line.strip().split("=", 1)[1]
    raise RuntimeError("PINECONE_API_KEY not found")


def vector_id(chunk_key, document_id, generation):
    text = f"{chunk_key}|{document_id}|{generation}"
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def wait_for_write_visibility(index, namespace, target_lsn, timeout_s=30.0, poll_interval_s=0.5):
    deadline = time.monotonic() + timeout_s
    poll_vector = [0.0] * DIM
    attempts = 0
    last_seen = None
    while time.monotonic() < deadline:
        attempts += 1
        resp = index.query(namespace=namespace, vector=poll_vector, top_k=1)
        last_seen = max_indexed_lsn(resp)
        if last_seen is not None and last_seen >= target_lsn:
            return {"reconciled": True, "attempts": attempts, "max_indexed_lsn": last_seen}
        time.sleep(poll_interval_s)
    raise TimeoutError(f"namespace {namespace!r} did not reconcile to LSN {target_lsn} "
                        f"within {timeout_s}s ({attempts} polls, last={last_seen})")


def check(label, condition, detail=""):
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {label}" + (f" - {detail}" if detail else ""))
    return condition


def main():
    pc = Pinecone(api_key=read_key())
    index = pc.Index(INDEX_NAME)
    failures = 0

    chunks = []
    with open(CHUNKS) as f:
        for _ in range(N_TEST):
            chunks.append(json.loads(f.readline()))
    print(f"loaded {len(chunks)} real chunks from {CHUNKS}")

    records = []
    id_to_chunk = {}
    for c in chunks:
        vid = vector_id(c["chunkKey"], c["documentId"], GENERATION)
        id_to_chunk[vid] = c
        records.append({
            "id": vid,
            "values": c["embedding"],
            "metadata": {
                "documentId": c["documentId"],
                "chunkKey": c["chunkKey"],
                "category": CATEGORY,
                "generation": GENERATION,
            },
        })
    if not check("5 distinct vector IDs generated", len(set(r["id"] for r in records)) == 5):
        failures += 1
    if not check("all vector IDs are 64 hex chars",
                 all(len(r["id"]) == 64 and all(ch in "0123456789abcdef" for ch in r["id"]) for r in records)):
        failures += 1

    upsert_resp = index.upsert(vectors=records, namespace=TEST_NAMESPACE)
    wlsn = write_lsn(upsert_resp)
    if not check("upsert returned a write LSN", wlsn is not None, f"lsn={wlsn}"):
        failures += 1
        sys.exit("cannot proceed without a write LSN to verify against - stopping, not guessing")

    vis = wait_for_write_visibility(index, TEST_NAMESPACE, wlsn)
    check("write became visible (LSN-verified, not slept)", vis["reconciled"],
          f"attempts={vis['attempts']} max_indexed_lsn={vis['max_indexed_lsn']}")

    fetch_resp = index.fetch(ids=list(id_to_chunk.keys()), namespace=TEST_NAMESPACE)
    fetched = fetch_resp.vectors
    if not check("fetch-by-id returned all 5 records", len(fetched) == 5, f"got {len(fetched)}"):
        failures += 1
    for vid, original in id_to_chunk.items():
        rec = fetched.get(vid)
        if rec is None:
            check(f"round-trip metadata for {vid[:12]}...", False, "missing from fetch")
            failures += 1
            continue
        meta_ok = (rec.metadata.get("documentId") == original["documentId"]
                   and rec.metadata.get("chunkKey") == original["chunkKey"]
                   and rec.metadata.get("category") == CATEGORY
                   and int(rec.metadata.get("generation")) == GENERATION)
        vec_ok = (len(rec.values) == DIM
                  and abs(rec.values[0] - original["embedding"][0]) < 1e-6
                  and abs(rec.values[-1] - original["embedding"][-1]) < 1e-6)
        if not check(f"round-trip metadata+vector for {vid[:12]}...", meta_ok and vec_ok):
            failures += 1

    # Query with one of the exact same embeddings - the identical chunk must
    # come back as the top hit with score ~1.0 (cosine self-similarity).
    probe_id, probe_chunk = next(iter(id_to_chunk.items()))
    query_resp = index.query(namespace=TEST_NAMESPACE, vector=probe_chunk["embedding"],
                              top_k=1, include_metadata=True)
    top = query_resp.matches[0] if query_resp.matches else None
    query_ok = (top is not None and top.id == probe_id and top.score > 0.999)
    check("query with a stored vector returns itself, score~1.0", query_ok,
          f"top_id={top.id[:12] if top else None} score={top.score if top else None}")
    if not query_ok:
        failures += 1

    # Cleanup: delete by explicit id (never by filter, matching production
    # convention), then verify the namespace is actually empty.
    index.delete(ids=list(id_to_chunk.keys()), namespace=TEST_NAMESPACE)
    deadline = time.monotonic() + 30.0
    empty = False
    while time.monotonic() < deadline:
        check_resp = index.query(namespace=TEST_NAMESPACE, vector=[0.0] * DIM, top_k=10)
        if len(check_resp.matches) == 0:
            empty = True
            break
        time.sleep(0.5)
    if not check("test namespace verified empty after delete", empty):
        failures += 1

    print()
    if failures == 0:
        print("ALL CHECKS PASSED - mechanism verified. Safe to proceed to the full corpus upload.")
        sys.exit(0)
    else:
        print(f"{failures} CHECK(S) FAILED - DO NOT proceed to the full corpus upload until fixed.")
        sys.exit(1)


if __name__ == "__main__":
    main()
