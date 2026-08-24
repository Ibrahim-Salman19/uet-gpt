# Pinecone Lifecycle Matrix + Concurrent-Generation Torture Test (2026-08-24)

Mandate §§54, 58-61. Run against the live `uetgpt-p2-proof` index, isolated
`lifecycle-test` namespace (never mixed with real corpus data, per §50),
using tiny synthetic vectors — this tests generation/lifecycle *mechanics*,
not retrieval quality or scale, so it doesn't need to wait on the full
corpus embed to be meaningful.

## Verdict

```text
LIFECYCLE MATRIX (mandate §58):        7/7 scenarios PASS
CONCURRENT-GENERATION TORTURE TEST
  (mandate §59 invariant):             PASS — a late generation-3 write
                                        arriving after generation-4 already
                                        committed never becomes
                                        authoritative
WRITE VISIBILITY (mandate §54):        LSN-based (upsert/query), not sleep
                                        — see §1 for a real SDK bug found
                                        and worked around
DELETE VISIBILITY:                     Verified via poll-until-gone (delete
                                        carries no LSN in this SDK — see §2)
PHYSICAL VS LOGICAL STATE (mandate
  §61):                                Checked separately at every step —
                                        no case where a stale generation
                                        was hidden by a filter while
                                        physically still present
```

## 0. Why this was built before the full corpus embed finished

Mandate §58's scenarios test generation/commit *mechanics* — idempotent
retry, generation replacement, concurrent-generation ordering, partial
failure, deletion — none of which depend on corpus scale. Building and
running this now, against the real live index, is real progress that
doesn't wait on the ~44,792-chunk embed (in progress separately, gated by
Gemini's daily free-tier quota).

## 1. A real SDK bug found in the installed Pinecone Python SDK (9.1.0)

Mandate §54 requires LSN-based write-visibility confirmation, not
`sleep(N)`. The SDK's documented convenience API for this
(`response.response_info.lsn_committed` / `.is_reconciled()`) is present in
this installed version but **does not work**: direct inspection of a real
upsert response showed `raw_headers` correctly containing
`x-pinecone-request-lsn: 2`, while the SDK's own `.lsn_committed` property
returned `None`. A subsequent query's `raw_headers` correctly showed
`x-pinecone-max-indexed-lsn: 3` (≥ 2, i.e. genuinely reconciled), while
`.is_reconciled(2)` incorrectly returned `False`.

Fix (`lsn_utils.py`): read `raw_headers` directly rather than trusting the
SDK's broken derived properties — the headers themselves are correct, only
the SDK's convenience wrapper is not. This is exactly the fallback mandate
§54 anticipates ("If SDK abstractions do not expose the required headers,
use the supported Database API path narrowly for this verification") —
`raw_headers` is still SDK-native, just not the specific convenience
property that turned out to be broken.

## 2. A real, measured Pinecone reliability finding: delete-by-filter vs delete-by-id

`index.delete()` in this SDK returns `None` for every delete (by id or by
filter) — no LSN is ever available for deletes, unlike upsert/query which
both reliably carry `response_info`. That alone forced a poll-until-gone
verification strategy for deletes rather than an LSN target.

More significantly: **delete-by-metadata-filter proved measurably
unreliable** in direct, repeated testing. Across three full runs of the
original (filter-based-delete) script, scenario 6 (delete all of a
document's chunks) failed twice — once leaving 3-4 stale vectors physically
present after a 30-second poll timeout, once succeeding but slowly. A
controlled side-by-side comparison on an identical reproduction (4 vectors,
same delete target) was decisive:

```text
delete(filter={"documentId": {"$eq": ...}}):  30s timeout, 3 vectors still
                                               present (one run); reached
                                               zero in ~5-15s (other runs)
delete(ids=[...4 explicit ids...]):           gone in 0.6s, every time
```

This matches why `convex/knowledgeStore/convexAdapter.ts`'s real
`commitGeneration` doesn't bulk-delete-by-filter either — it explicitly
lists stale chunks first (`listChunksBelowGeneration`) then deletes each by
its known `ragId`. This test's `commit_generation`/`delete_matching_and_wait`
were changed to match that same list-then-delete-by-id pattern, after which
three consecutive full runs passed cleanly with no residual-vector or
timeout failures. **A production `pineconeAdapter.ts` must delete by
explicit id, never by bulk metadata filter, for this same reason** — this
is a concrete, evidence-backed design constraint for that future work, not
a stylistic preference.

## 3. Scenario-by-scenario (mandate §58, all PASS)

```text
1. initial document ingest                  3 chunks upserted, LSN-visible
2. same-generation idempotent retry          re-upsert same ids, no dupes
3. newer generation replacement              gen1+gen2 coexist pre-commit
                                              (6 vectors), gen1 physically
                                              gone post-commit (0 stale)
4. concurrent-generation torture test        gen4 commits first; gen3's
   (mandate §59)                             late write never becomes
                                              authoritative — cleaned up by
                                              the next commit
5. partial failure                           a 1-of-3-chunk generation is
                                              visible as-is, not silently
                                              completed or hidden
6. document deletion                         all chunks physically gone
                                              (list-then-delete-by-id)
7. re-add after deletion                     clean re-ingest, no residue
```

## 4. Evidence

```text
Command:     python3 docs/rag-store-evaluation/pinecone-p2-proof-2026-08/lifecycle_matrix.py
cwd:         /mnt/c/Users/hafiz/UETGPT/uet-gpt
Git HEAD:    521f5edbd6d7cd2aa37dd25b6825ecae51515770
Start:       2026-08-24T09:26:41Z
End:         2026-08-24T09:26:59Z
Exit code:   0
Result:      7/7 SCENARIOS PASS (reproduced 3 consecutive times after the
             delete-by-id fix; full transcript below)
```

Full run log: `lifecycle-matrix-run.log` (this directory), sha256
`709bf5206964b70da745e27089acc37e275eb58c8f7b2152ccadf1b58970909e`.

## 5. Cloud/cost activity

```text
Gemini API calls:      0 (synthetic vectors only, no embedding)
Pinecone API calls:    real upserts/queries/deletes against the live
                        uetgpt-p2-proof index's lifecycle-test namespace —
                        Starter/free tier, trivial volume ($0)
Convex Cloud calls:    0
```

## 6. What this does not yet cover

This validates generation/lifecycle *mechanics* on synthetic data. It does
not yet validate: the full corpus at real scale (§62 resource projection),
ANN recall vs. exact ground truth (§44/§56 — blocked on the full embedding
set), or hybrid retrieval quality (§45/§57 — needs the real Convex lexical
side wired in too). Those remain separately gated on the full embedding
run finishing.
