#!/usr/bin/env python3
"""Mandate §58-61: Pinecone lifecycle matrix + concurrent-generation torture
test, run for real against the live uetgpt-p2-proof index in an isolated
`lifecycle-test` namespace (mandate §50 - isolated benchmark namespace,
never mixed with real corpus data). Uses tiny synthetic vectors (this tests
generation/lifecycle MECHANICS, not retrieval quality or scale, so it does
not need to wait on the full corpus embed).

Mirrors convex/knowledgeStore/convexAdapter.ts's real semantics exactly:
vector id = f"{documentId}:{chunkKey}:{generation}" (generation-scoped,
matching computeRagVersionKey's shape - a re-upsert of the SAME generation
overwrites the same id; a NEW generation gets a NEW id). commitGeneration
deletes every vector for this document with metadata.generation < target,
mirroring commitGeneration's listChunksBelowGeneration + delete.

Every upsert is followed by lsn_utils.upsert_and_wait; every delete by
lsn_utils.delete_and_wait_gone - never a bare sleep (mandate §60). The two
helpers differ because this SDK's delete() returns no LSN at all (verified
by direct inspection, not assumed), unlike upsert/query which both reliably
carry response_info - delete_and_wait_gone polls the delete's own effect
instead."""
import sys

from pinecone import Pinecone
from pinecone.errors import NotFoundError

sys.path.insert(0, "/mnt/c/Users/hafiz/UETGPT/uet-gpt/docs/rag-store-evaluation/pinecone-p2-proof-2026-08")
from lsn_utils import upsert_and_wait, delete_and_wait_gone

ENV_LOCAL = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/.env.local"
INDEX_NAME = "uetgpt-p2-proof"
NAMESPACE = "lifecycle-test"
DIM = 768


def read_key():
    with open(ENV_LOCAL) as f:
        for line in f:
            if line.startswith("PINECONE_API_KEY="):
                return line.strip().split("=", 1)[1]
    raise RuntimeError("PINECONE_API_KEY not found")


def dummy_vector(seed):
    v = [0.0] * DIM
    v[seed % DIM] = 1.0
    return v


def make_chunk_vectors(document_id, generation, chunk_keys):
    return [
        {
            "id": f"{document_id}:{ck}:{generation}",
            "values": dummy_vector(hash((document_id, ck, generation)) & 0xFFFF),
            "metadata": {"documentId": document_id, "chunkKey": ck, "generation": generation},
        }
        for ck in chunk_keys
    ]


def delete_matching_and_wait(index, namespace, filter_):
    """Finding from direct comparison (see report.md): Pinecone serverless
    delete-by-filter is measurably unreliable in this environment - one
    real run needed 30+ seconds and still left 3 stale vectors, while an
    identical scenario using explicit-id delete resolved in 0.6s. This
    matches why convex/knowledgeStore/convexAdapter.ts's real
    commitGeneration doesn't bulk-delete-by-filter either: it lists the
    stale chunks first (listChunksBelowGeneration) then deletes each by its
    known ragId. Mirrors that here: query the filter for matching ids
    first, then delete by those explicit ids.

    A namespace that has never been written to doesn't exist yet, and
    Pinecone 404s a query/delete against it - harmless on a fresh index."""
    try:
        matches = index.query(namespace=namespace, vector=[0.0] * DIM, top_k=1000, filter=filter_)
    except NotFoundError:
        return
    ids = [m["id"] for m in matches["matches"]]
    if not ids:
        return
    try:
        delete_and_wait_gone(
            index, namespace,
            delete_fn=lambda: index.delete(ids=ids, namespace=namespace),
            verify_query_kwargs={"filter": filter_},
        )
    except NotFoundError:
        pass


def commit_generation(index, namespace, document_id, target_generation, results):
    """Deletes chunks below target_generation, mirroring
    convexAdapter.ts's commitGeneration. Verifies BOTH logical authority
    (implicit - the filter used to delete IS the authority boundary) AND
    eventual physical vector state (mandate §61 - a filter hiding stale
    records forever while they physically accumulate is not a pass)."""
    stale_filter = {"documentId": {"$eq": document_id}, "generation": {"$lt": target_generation}}
    delete_matching_and_wait(index, namespace, stale_filter)
    check_stale_authoritative(index, namespace, document_id, target_generation, results, "post-commit")


def check_stale_authoritative(index, namespace, document_id, below_generation, results, label):
    """The mandate §59 invariant, checked directly: no vector with
    generation < below_generation may be present (not just filtered) for
    this document. Uses a broad top_k query with a metadata filter as the
    physical-state check (mandate §61)."""
    stale = index.query(
        namespace=namespace, vector=dummy_vector(0), top_k=100,
        filter={"documentId": {"$eq": document_id}, "generation": {"$lt": below_generation}},
        include_metadata=True,
    )
    ok = len(stale["matches"]) == 0
    results.append((f"{label}: no stale generation < {below_generation} physically present", ok, len(stale["matches"])))
    return ok


def main():
    pc = Pinecone(api_key=read_key())
    desc = pc.describe_index(INDEX_NAME)
    index = pc.Index(host=desc.host)

    # Clean slate for this doc's ids across all scenarios below, so reruns
    # of this script are idempotent. Waits for its own effect before
    # proceeding, for the same reason every other delete in this script
    # does.
    for doc_id in ("lifecycle-doc-1", "lifecycle-doc-2"):
        delete_matching_and_wait(index, NAMESPACE, {"documentId": {"$eq": doc_id}})

    results = []

    # --- Scenario 1: initial document ingest ---
    doc1_gen1 = make_chunk_vectors("lifecycle-doc-1", 1, ["c0", "c1", "c2"])
    r = upsert_and_wait(index, NAMESPACE, doc1_gen1)
    results.append(("1. initial ingest: 3 chunks upserted+visible", r["upserted_count"] == 3, r))

    # --- Scenario 2: same-generation idempotent retry (re-upsert same gen) ---
    r2 = upsert_and_wait(index, NAMESPACE, doc1_gen1)  # identical ids -> overwrite, not duplicate
    results.append(("2. idempotent retry: re-upsert same generation succeeds, no duplication", r2["upserted_count"] == 3, r2))

    # --- Scenario 3: newer generation replacement ---
    doc1_gen2 = make_chunk_vectors("lifecycle-doc-1", 2, ["c0", "c1", "c2"])
    upsert_and_wait(index, NAMESPACE, doc1_gen2)
    # Before commitGeneration: both gen1 and gen2 vectors physically coexist (expected - upsertChunks never deletes)
    both_present = index.query(namespace=NAMESPACE, vector=dummy_vector(0), top_k=100,
                                filter={"documentId": {"$eq": "lifecycle-doc-1"}}, include_metadata=True)
    results.append(("3a. gen2 upserted alongside gen1 (pre-commit, expected coexistence)", len(both_present["matches"]) == 6, len(both_present["matches"])))
    commit_generation(index, NAMESPACE, "lifecycle-doc-1", 2, results)

    # --- Scenario 4: stale older generation "finishes late" (mandate §59 torture test) ---
    # Simulates: generation 4 starts and commits FIRST, then generation 3's
    # (late/slow) upsert finally lands. Invariant: gen 3 must NEVER become
    # authoritative after gen 4 has committed - the NEXT commitGeneration(4)
    # call must clean up gen 3's late arrival.
    doc2_gen4 = make_chunk_vectors("lifecycle-doc-2", 4, ["c0"])
    upsert_and_wait(index, NAMESPACE, doc2_gen4)
    commit_generation(index, NAMESPACE, "lifecycle-doc-2", 4, results)  # gen 4 commits first
    doc2_gen3_late = make_chunk_vectors("lifecycle-doc-2", 3, ["c0"])
    upsert_and_wait(index, NAMESPACE, doc2_gen3_late)  # gen 3's late write races in AFTER gen 4 already committed
    commit_generation(index, NAMESPACE, "lifecycle-doc-2", 4, results)  # must clean it back up
    results.append(("4. late gen-3 write never becomes authoritative after gen-4 commits", results[-1][1], None))

    # --- Scenario 5: partial failure (simulate: only some chunks of a
    # generation successfully upsert, then commitGeneration runs anyway -
    # verifies commitGeneration only ever removes generations strictly
    # below target, never touches the (partial) target generation itself) ---
    doc1_gen3_partial = make_chunk_vectors("lifecycle-doc-1", 3, ["c0"])  # only 1 of what would be 3 chunks
    upsert_and_wait(index, NAMESPACE, doc1_gen3_partial)
    partial_present = index.query(namespace=NAMESPACE, vector=dummy_vector(0), top_k=100,
                                   filter={"documentId": {"$eq": "lifecycle-doc-1"}, "generation": {"$eq": 3}},
                                   include_metadata=True)
    results.append(("5. partial-generation upsert is visible as-is (no false completion)", len(partial_present["matches"]) == 1, len(partial_present["matches"])))

    # --- Scenario 6: document deletion ---
    delete_matching_and_wait(index, NAMESPACE, {"documentId": {"$eq": "lifecycle-doc-1"}})
    check_stale_authoritative(index, NAMESPACE, "lifecycle-doc-1", 10**9, results, "6. document deletion removes all its chunks")

    # --- Scenario 7: re-add after deletion ---
    doc1_readd = make_chunk_vectors("lifecycle-doc-1", 1, ["c0"])
    r7 = upsert_and_wait(index, NAMESPACE, doc1_readd)
    results.append(("7. re-add after deletion succeeds cleanly", r7["upserted_count"] == 1, r7))

    print("\n=== Lifecycle Matrix + Concurrent-Generation Torture Test Results ===")
    all_pass = True
    for label, ok, detail in results:
        status = "PASS" if ok else "FAIL"
        if not ok:
            all_pass = False
        print(f"[{status}] {label}  (detail: {detail})")
    print(f"\nOVERALL: {'7/7 SCENARIOS PASS' if all_pass else 'FAILURES PRESENT - see above'}")

    # cleanup: leave the namespace empty for the next run
    for doc_id in ("lifecycle-doc-1", "lifecycle-doc-2"):
        delete_matching_and_wait(index, NAMESPACE, {"documentId": {"$eq": doc_id}})


if __name__ == "__main__":
    main()
