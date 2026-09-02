# Independent review package (Agent B) - status as of 2026-08-29, last updated 2026-09-02

Prepared per mandate §68/§73: a passing benchmark does not authorize
production cutover, and the agent who built the system must not self-certify
it. This document is the entry point for that review - what to check, where
the evidence lives, and what is explicitly NOT yet ready to be checked. It is
written now, before the gated items finish, so review readiness is a matter
of re-reading this file once they do, not a fresh engineering task.

## 0. One-line status

**NOT READY for production cutover.** Corpus embedding is COMPLETE and
verified, and as of 2026-08-30 both §44 (exact dense ground truth) and §56
(ANN Recall@10 >= 0.98, PASSED at the exact boundary, 49/50) are also
COMPLETE with real, verified evidence - see §2. `rugged-bird-156` data
verification was explicitly ruled OUT OF SCOPE by the user, not merely
credential-blocked - see §6. §45/§46/§57 (hybrid retrieval quality) is now
COMPLETE for all 50/50 queries (AI-reviewed, never HUMAN_VERIFIED) with a
2026-09-01 correction on file (§3): the "lexical never rescues a dense
miss" claim was retracted as a structural artifact of the labeling method,
not a measured result - see §2's gates table. §62 (resource projection) is
now PARTIAL: Convex risk is fully recorded (2026-08-29), and a real
Pinecone storage floor was DERIVED 2026-09-01 on the real corpus size
(9.0%/18.1%/27.1% of the 2GB Starter limit at 1x/2x/3x) - but that floor
excludes ANN index overhead (unmeasured, plausibly the dominant term) and
§62 also requires write/read-unit/latency telemetry not yet collected, so
this is not a "comfortable headroom" conclusion, just a corrected input.
**Updated 2026-09-01 (lifecycle matrix, live Pinecone):** §58 (lifecycle
matrix) had 6/7 scenarios EXECUTED against the live Pinecone index (isolated
namespace, real writes/deletes, verified 0 residue afterward - see §2). §61
(delete/replacement physical verification) is PASS, cross-checked two
independent ways.

**Updated 2026-09-01 (§59, later the same day):** the one remaining §58/§59
gap - scenario 4, "a stale older generation finishes late" (the N-vs-N+1
race) - is now CLOSED. It was NOT closed by calling Gemini, and it was NOT
tested against the raw Pinecone adapter (which still has no generation
fencing by design, correctly, since that invariant lives in the application
mutation layer, not the storage adapters). It was closed by
`convex/crawlMutationsGenerationRace.test.ts`, a new deterministic,
controlled-ordering `convex-test` proof that exercises the REAL
`onRagEntryComplete` fencing mutation through the REAL `@convex-dev/rag`
component's `add()`->`onComplete` chain (registered in-memory), using a
caller-supplied synthetic embedding - source-verified to never reach
`embedMany`/Gemini - so this closes the gap at zero cost, not by spending
the quota that had made it look unclosable. See §2's gates table for the
full evidence and reproduction command. §59 is now MEASURED (PASS), not an
INFERENCE. §63/§64/§65 (final Pinecone PASS/FAIL declaration) still cannot
be made - re-reading §2 in full turned up three OTHER open gates unrelated
to §59 (resource projection at 2x/3x scale, the unbiased lexical-value test,
and LSN write-visibility coverage of the lifecycle-test write path - see
that row for detail) - but the scope has narrowed from "the whole lifecycle
matrix plus these three" to just these three. §68/§73 (this document's own
purpose) remains the one gate that structurally cannot be self-executed by
this session.

**Updated 2026-09-02 (§45/§46/§57, the "unbiased lexical-value test" item
from the paragraph above): DONE, with a ceiling that is now confirmed
permanent rather than open.** A separate session (this document's author
did not do this work directly, but is the one recording it, so treat the
distinction as: measured by this project, not self-certified by whoever
built the retrieval code) found and fixed the exact defect this document
had flagged as open: the golden set's label pool was dense-only
(`generate_label_review.py` sourced candidates from dense top-5 only), so
`fusedTop5 - denseTop5` was measured directly - **103 chunks across all
50 queries had never been eligible to be marked relevant, by
construction.** All 103 were read in full and honestly judged (not a
rubber stamp: 15 relevant, 88 rejected with a stated reason each,
recorded in `scripts/eval/delta_label_review.md`), merged additively into
`golden_set_verified.jsonl`, and the real production fusion re-scored
locally: `scoredQueryCount` 19→23, `meanHitAt5` 0.9474→0.9565, `meanMrr`
0.7076→0.7295. 4 of the 15 newly-relevant chunks closed queries that
previously had *zero* labeled answer at all - exactly the failure mode
predicted. Full evidence, methodology, and a self-caught idempotency bug
(fixed and verified) are in
`docs/rag-store-evaluation/hybrid-retrieval-2026-08/report.md` §6.

**Separately, and this is the part that does not resolve:** asked
directly, the project's user confirmed they cannot personally verify
these UET Taxila facts (no domain knowledge) - the same limitation
already on file for the fee queries. `HUMAN_VERIFIED` is therefore
**confirmed unreachable** for this label set, not merely not-yet-done. A
cross-corroboration pass then searched the local corpus for independent
sources on every remaining plain-`LLM_JUDGED` query that asserts an
answer (16 queries): 10 upgraded to `AUTHORITATIVE_SOURCE_MATCH` with the
specific corroborating sources cited (7 same-fact confirmations, 3
weaker topical-consistency corroborations, explicitly distinguished, not
presented as one tier), 6 searched and documented as not-found - one of
which corrected a prior independence assumption (query 34's two "relevant"
chunks turned out to be the same document). `AUTHORITATIVE_SOURCE_MATCH`
coverage: 9→12→22 of 50 queries. Full detail, including a self-caught
Q8 evidence-conflict that needed reconciling (50% vs 60% CS eligibility -
both correct, not contradictory, now stated explicitly), is in the same
report.md's §7.

**Net effect on §63:** the "unbiased lexical-value test" item is closed
and should be struck from the §63 blocking-gates list below (see that
row for the correction) - but §63 still does not clear, for a reason that
is now a documented, permanent ceiling rather than an open task: 0/50
labels are `HUMAN_VERIFIED`, confirmed unreachable, and N=23/50 remains
modest. This is the specific decision Agent B (or the project's user)
needs to make that this session structurally cannot: whether
`AUTHORITATIVE_SOURCE_MATCH`/`LLM_JUDGED` evidence at this coverage is
sufficient to certify retrieval quality for a hosting decision, given no
UET Taxila domain expert is available to do better. New commits this
round: `f5c1f09` (pool-bias fix), `b5eac06` (idempotency fix + a
disclosure), `cc1c6d6` (corroboration pass), `6d12639` (Q8 reconciliation
+ tier disclosure) - all on `agent/2026-08-12-turso-knowledge-store`,
zero Gemini/Pinecone/Convex Cloud calls across all four.

**Agent B's independent review has now happened — see
`AGENT_B_REVIEW_2026-09-02.md` (commit `0e0904d`).** Verdict:
**NOT-PRODUCTION-READY**, agreeing with this document's own status - and
not a rubber stamp: Agent B independently reproduced the headline
hybrid-retrieval metric byte-for-byte from committed inputs in an
isolated worktree with zero cloud calls, verified all four commit SHAs
above match their diffs, confirmed the §59 concurrency test proves both
halves of its invariant, and found real (not fabricated) gaps this
document had missed: a load-bearing evidence log
(`upload-full-corpus-run.log`) that was never committed to git (now
fixed, commit `0e0904d`), the stale 768d/1024d caveat addressed above
(now fixed in this document, `candidate-matrix.json`, and
`evidence-manifest.json`), and an under-disclosed fusion-fidelity gap
(now surfaced in the gates table above and in
`hybrid-retrieval-2026-08/report.md`). Agent B's own answer to the label-
provenance judgment call, worth reading in full (its §5): the ANN-recall
store-selection decision (§56) can ship on its own label-free evidence,
but end-to-end retrieval-quality certification for production (§45/46/57)
cannot be closed by more AI-only labeling regardless of volume - it needs
either a real UET Taxila domain reviewer or a differently-designed
evaluation that doesn't depend on hand labels at all. That recommendation
is not yet acted on and is a decision for the project's user.

## 1. What is verified and can be checked right now

```text
[x] Embedding backend selection    docs/rag-store-evaluation/cloudflare-
                                   workers-ai-2026-08/report.md - measured
                                   bake-off (bge-m3 vs qwen3-0.6b) on this
                                   corpus, not vendor reputation. Two models
                                   disqualified by a truncation test, not
                                   assumed safe.

                                   SUPERSEDES mandate §35/§39/§40/§49, which
                                   specify gemini-embedding-2 at 768
                                   dimensions. Gemini was dropped for this
                                   corpus on resource-safety grounds (free-
                                   tier throughput vs. the user's explicit
                                   "I cannot spend money" constraint - see
                                   §6), and Cloudflare's
                                   @cf/qwen/qwen3-embedding-0.6b was selected
                                   instead via the bake-off above. Every
                                   place downstream that reads "768" in the
                                   mandate text should read 1024 in this
                                   project: query vectors, the Pinecone index
                                   dimension (uetgpt-corpus-v1-qwen1024, name
                                   is deliberate), and exact-ground-truth
                                   cosine search all use 1024d qwen3 vectors,
                                   consistently. This is not an oversight to
                                   flag - it is the documented supersession.

[x] Ingest robustness              cf_embed_corpus.py - idempotent, char-
                                   budgeted batching, retry-after backoff,
                                   per-vector validation, PID lockfile
                                   (added after a real concurrent-writer
                                   incident, §9 of report.md), daily-quota-
                                   vs-rate-limit distinction (fixed after a
                                   real bug that silently mislabeled quota
                                   exhaustion as per-chunk failures).

[x] Corpus-quality finding          17.1% duplicate chunk text (site-wide
                                   boilerplate), measured impact on top-10
                                   retrieval (not assumed): 9.3% mean
                                   redundant slots, but the mean hides a
                                   bimodal split - 68.7% of queries entirely
                                   unaffected, the rest losing ~30% of their
                                   context window to repeats. See GAPS.md §H.

[x] CompositeKnowledgeStore         convex/knowledgeStore/compositeStore.ts.
                                   Decides the dense/lexical split question
                                   (Pinecone has no BM25) rather than hiding
                                   it. 3 load-bearing ordering rules, each
                                   closing a specific failure mode. 20/20
                                   tests: the existing shared contract suite
                                   (10 cases) run against genuinely
                                   independent dense+lexical stores, plus 10
                                   tests proving the ordering/failure
                                   invariants directly. Two real bugs were
                                   found BY running this suite, not by
                                   inspection - see the commit message on
                                   5e75ad1 for both.

[x] pineconeAdapter.ts              Implements the dense half. Reuses
                                   computeRagVersionKey for vector IDs (same
                                   scheme Convex's own adapter uses - not a
                                   second identity scheme invented here).
                                   Deletes by explicit id only, never by
                                   filter (measured unreliable in the
                                   original Pinecone proof work). Verified
                                   against the LIVE uetgpt-corpus-v1-qwen1024
                                   index in an isolated namespace - 20
                                   checks, including a case where the
                                   adapter was RIGHT and the test's own
                                   assumption was wrong (see commit 1591ea2).
                                   Confirmed the index holds 0 vectors after
                                   the test - untouched for the real corpus.
                                   tsc: zero errors in this file, confirmed
                                   against the exact pre-existing 21-error
                                   baseline (see §7 for how that baseline is
                                   verified, not assumed).

[x] cloudflareRerank.ts             Direct Cloudflare inference call, no
                                   Worker deployment needed (the deployment
                                   path needed a permission that was
                                   deliberately not granted - see GAPS.md).
                                   Follows the existing groqRerank.ts
                                   convention: real, tested, deliberately
                                   UNWIRED from cascade.ts's live tiers.
                                   Verified via the actual exported
                                   internalAction's real dispatch property
                                   (_handler, confirmed by inspection, not
                                   assumed from the SDK's public API shape).
                                   REAL FINDING: reranking and corpus
                                   embedding share one Cloudflare account's
                                   daily budget - hit the actual limit live
                                   while testing. Not yet mitigated; see
                                   GAPS.md §I for options.

[x] Live outage root-caused and     adamant-stork-623 DISABLED for exceeding
    fixed (interim)                free-plan limits - reproduced the exact
                                   error directly, not inferred from a
                                   support message. Root cause is
                                   architectural (the corpus lived inside
                                   Convex, ~276MB against a ~0.5GB free
                                   allowance), not a one-time billing event -
                                   recorded so "get more quota" is not
                                   mistaken for a fix. confident-viper-402
                                   (the intended cutover target) diagnosed as
                                   EMPTY, not disabled, via response-shape
                                   comparison, not guessed. Vercel production
                                   traced to having pointed at the same
                                   Convex URL for 78 days unchanged - the
                                   July cutover almost certainly never
                                   completed at the Vercel level.
                                   INTERIM FIX APPLIED with explicit user
                                   authorization: production repointed to
                                   rugged-bird-156, verified end-to-end on
                                   the real domain (SHIP.md §0). This is
                                   NOT the target architecture - see §6.
```

## 2. Mandate gates status

```text
gate                                status      evidence
------------------------------------------------------------------------
embedding backend measured on       PASS        cloudflare-workers-ai-
  target corpus, not reputation                 2026-08/report.md §4
truncation/correctness verified     PASS        report.md §3
  before trusting a model
ingest idempotent/resumable/        PASS        cf_embed_corpus.py +
  validated                                     verify_embeddings.py
dense/lexical composition decided   PASS        compositeStore.ts,
  and justified, not defaulted                  SHIP.md §5 decision
pineconeAdapter built and tested    PASS        pineconeAdapter-live-
  against live infra                            test.ts, 20/20
reranker available, tested,         PASS        cloudflareRerank-live-
  correctly unwired pending review              test.ts
corpus embedding COMPLETE           PASS        44,792/44,792 (100%) as
  (§40 embed-exactly-once)                      of 2026-08-29.
                                                 verify_embeddings.py exits
                                                 0 - completeness, integrity,
                                                 and distinctness all clean.
                                                 (One 210-vector fingerprint
                                                 collision on first run was
                                                 confirmed to be a single
                                                 genuinely-duplicated source
                                                 chunk, not a degenerate
                                                 embedding; the verify
                                                 script's check was
                                                 corrected to cross-reference
                                                 contentHash before flagging.)
exact dense ground truth (§44)      PASS        50 queries (scripts/eval/
                                                 golden_set.jsonl) embedded
                                                 via Cloudflare qwen3 (same
                                                 model/format as the corpus,
                                                 bare text, no instruction
                                                 prefix - verified consistent
                                                 before running), exhaustive
                                                 local cosine search against
                                                 all 44,792 corpus vectors.
                                                 2026-08-30. Output:
                                                 ground_truth.jsonl, SHA-256
                                                 59c4ffe9...0b1b51. Sanity-
                                                 checked, not just trusted:
                                                 scores properly descending,
                                                 5 distinct chunkKeys in
                                                 every top5, real score
                                                 spread (not degenerate/
                                                 flat). Zero external calls
                                                 (pure local numpy).
ANN Recall@10 >= 0.98 vs exact      PASS        Full corpus upserted
  ground truth (§56)                            2026-08-30: 44,792/44,792
                                                 vectors (747/747 batches, 0
                                                 failures), LSN-verified
                                                 write visibility (reconciled
                                                 on the first poll), exact
                                                 count match, 20/20 fetch-by-
                                                 id spot-checks correct
                                                 (pinecone-p2-proof-2026-08/
                                                 upload-full-corpus-run.log).
                                                 ANN benchmark then run
                                                 (ann_recall.py):
                                                 mean Recall@5=0.988,
                                                 @10=0.98 EXACT (49/50,
                                                 verified with exact
                                                 rational arithmetic, not
                                                 just float display),
                                                 @20=0.974. Recall@10 meets
                                                 the >=0.98 gate exactly, at
                                                 the boundary, not with
                                                 comfortable margin - a real,
                                                 unrounded pass, not
                                                 "close enough." A first
                                                 print of this result showed
                                                 FAIL due to a float-
                                                 accumulation bug in the
                                                 gate comparison
                                                 (0.98 summed as
                                                 0.9799999999999999);
                                                 caught before reporting,
                                                 fixed in ann_recall.py
                                                 (epsilon-tolerant
                                                 comparison), and confirmed
                                                 independently via
                                                 Fraction-based exact
                                                 arithmetic. The 8/50 queries
                                                 with imperfect recall
                                                 (6 at 0.9, 2 at 0.8) were
                                                 checked, not assumed
                                                 benign: their exact top-10
                                                 scores are near-ties at the
                                                 rank-8-to-10 boundary
                                                 (gaps of 0.00009 and
                                                 0.00195), consistent with
                                                 the corpus's known
                                                 duplicate-content finding,
                                                 not a retrieval defect -
                                                 an approximate index
                                                 legitimately orders near-
                                                 identical scores
                                                 differently from exact
                                                 search.
hybrid retrieval evaluated with     PASS*       all 50/50 queries
  REAL Convex lexical +                         AI-reviewed (see §3
  hybridRank, not reimplemented                 addendum - never
  (§45/§46/§57)                                 HUMAN_VERIFIED), real
                                                 Pinecone dense + real
                                                 local Convex lexical +
                                                 real hybridRank fusion:
                                                 18/19 HitRate@5 (0.947),
                                                 mean MRR 0.708 on the 19
                                                 dense-derived labeled
                                                 queries. CORRECTED
                                                 2026-09-01 (see §3
                                                 addendum): labels were
                                                 sourced exclusively from
                                                 dense's own top-5
                                                 candidates
                                                 (generate_label_review.py),
                                                 so "lexical never
                                                 rescues a dense miss"
                                                 and "31/50 have none in
                                                 either channel" were
                                                 retracted as findings -
                                                 both are structurally
                                                 guaranteed by the
                                                 labeling method, not
                                                 measured. What remains
                                                 valid: fusion actively
                                                 hurt one query (marginal
                                                 dense rank-5 hit pushed
                                                 to rank 9) - an unbiased
                                                 result. UPDATED 2026-09-02
                                                 (see §0's same-date
                                                 paragraph and report.md
                                                 §6/§7 for full evidence):
                                                 the unbiased lexical-value
                                                 test (dense UNION lexical
                                                 candidate pool, both
                                                 reviewed) IS NOW DONE -
                                                 all 103 fusedTop5-minus-
                                                 denseTop5 chunks read and
                                                 judged, 15 genuinely
                                                 relevant, merged in.
                                                 Re-scored: 23/50 scorable
                                                 (was 19/50), HitRate@5
                                                 0.9565 (was 0.9474), mean
                                                 MRR 0.7295 (was 0.7076).
                                                 Separately, HUMAN_VERIFIED
                                                 is now CONFIRMED
                                                 UNREACHABLE (user has no
                                                 personal domain knowledge
                                                 of these facts, asked
                                                 directly) rather than
                                                 merely not-yet-done; a
                                                 cross-corroboration pass
                                                 raised AUTHORITATIVE_
                                                 SOURCE_MATCH coverage
                                                 9->12->22/50 as the
                                                 practical substitute
                                                 ceiling. Raw query text
                                                 only, no HyDE/rewrite
                                                 (blocked, see §3). ALSO
                                                 flagged by Agent B
                                                 2026-09-02 (previously
                                                 disclosed only in the
                                                 superseded hybrid_eval.ts
                                                 pilot script's header, not
                                                 here): the eval invokes
                                                 the real hybridRank()
                                                 function genuinely
                                                 unmodified, but as a
                                                 simplified 2-channel,
                                                 equal-weight call, not
                                                 production's real
                                                 IDF-adaptive weights,
                                                 3rd fusion channel
                                                 (chunkTextSearch), or
                                                 freshness/status
                                                 filtering - "real
                                                 hybridRank, not
                                                 reimplemented" is accurate
                                                 at the function-import
                                                 level, not a claim the
                                                 full production pipeline
                                                 was exercised - *PASS is
                                                 on retrieval mechanics
                                                 tested and now on an
                                                 unbiased label pool too,
                                                 but still not a
                                                 production-quality
                                                 verdict: the label set's
                                                 provenance ceiling (0
                                                 HUMAN_VERIFIED, N=23), the
                                                 simplified-fusion scope
                                                 above, and the HyDE path
                                                 are real open findings,
                                                 not a clean bill of
                                                 health.
resource projection at 2x/3x        PARTIAL     Convex: local-convex-
  scale (§62)                                   lexical-proof-2026-08/
                                                 report.md §7.1 - real
                                                 content bytes (excludes
                                                 index overhead):
                                                 247.3MB (1x) / 494.6MB
                                                 (2x) / 741.9MB (3x)
                                                 against a ~0.5GB free-
                                                 tier ceiling.
                                                 CONVEX_LEXICAL_CAPACITY_
                                                 RISK: RECORDED - 2x
                                                 already reaches the
                                                 ceiling on content bytes
                                                 alone. Pinecone:
                                                 DERIVED 2026-09-01 from
                                                 the real 44,792-vector/
                                                 1024d corpus and the
                                                 actual 4-field metadata
                                                 schema (documentId,
                                                 chunkKey, category,
                                                 generation) -
                                                 vectors+ids+metadata =
                                                 185.0MB (1x) / 369.9MB
                                                 (2x) / 554.9MB (3x)
                                                 against Pinecone
                                                 Starter's documented 2GB
                                                 serverless storage limit
                                                 (market-screen-2026-08/
                                                 evidence.json) = 9.0% /
                                                 18.1% / 27.1% - a
                                                 PAYLOAD-ONLY FLOOR
                                                 (vectors+ids+metadata),
                                                 replacing a stale market-
                                                 screen estimate (~63MB
                                                 raw) that predated the
                                                 real uploaded corpus, but
                                                 excluding the ANN index
                                                 structure itself, which
                                                 for a serverless HNSW-
                                                 class index is typically
                                                 the dominant storage
                                                 term, not a rounding
                                                 error - unlike the
                                                 Convex figure above,
                                                 this has not been cross-
                                                 checked against any
                                                 vendor-reported total, so
                                                 "comfortable headroom" is
                                                 NOT an established
                                                 conclusion at 2x/3x; a
                                                 2-3x index-overhead
                                                 multiplier on the 3x
                                                 payload figure alone
                                                 would land in a 55-80%
                                                 utilization band, not a
                                                 clearly-safe one.
                                                 Additionally, §62 also
                                                 calls for actual write
                                                 units / read units /
                                                 requests / errors /
                                                 latency, none of which
                                                 are collected yet - PASS
                                                 is not claimed; this row
                                                 is PARTIAL until real
                                                 Pinecone operational
                                                 telemetry (expected to
                                                 come from the §58/§59/§61
                                                 lifecycle work below) is
                                                 in hand.
Pinecone lifecycle matrix 7/7        PASS*       §58 - all 7/7 scenarios now
  (§58)                                          executed, but NOT all
                                                 against the live index -
                                                 see the per-scenario source
                                                 below before reading this
                                                 as "7/7 live Pinecone
                                                 executions." 1 (initial
                                                 ingest) and 3 (generation
                                                 replacement) from
                                                 pineconeAdapter-live-
                                                 test.ts (prior session,
                                                 ~20 checks, live index).
                                                 2 (same-generation
                                                 idempotent retry), 5 (a
                                                 round left uncommitted -
                                                 the state a real partial
                                                 failure would leave,
                                                 without inducing one), 6
                                                 (deletion), and 7 (re-add
                                                 after deletion, clean - no
                                                 ghost vectors from the
                                                 prior lifecycle) from
                                                 knowledgeStore/
                                                 pineconeLifecycleTest.ts
                                                 (new, 10/10 checks passed,
                                                 isolated namespace
                                                 `adapter-contract-test`,
                                                 real Pinecone writes/
                                                 deletes, 0 residue after,
                                                 independently verified via
                                                 a raw describeIndexStats
                                                 call - 2026-09-01, live
                                                 index). Scenario 4 (stale
                                                 older generation finishes
                                                 late) closed 2026-09-01 via
                                                 convex/crawlMutationsGeneration
                                                 Race.test.ts - see §59
                                                 below for the full
                                                 evidence. This is a
                                                 DIFFERENT layer/mechanism
                                                 than scenarios 1/2/3/5/6/7
                                                 above: it is an in-memory
                                                 convex-test proof against
                                                 the application mutation
                                                 layer (onRagEntryComplete),
                                                 not a live Pinecone write/
                                                 delete - which is the
                                                 CORRECT and complete
                                                 verification for this
                                                 specific scenario, not a
                                                 gap, because this
                                                 document's own §59 analysis
                                                 (below) already established
                                                 that pineconeAdapter.ts has
                                                 no generation fencing by
                                                 design and was never meant
                                                 to enforce this invariant -
                                                 the mutation layer is where
                                                 it actually lives, so that
                                                 is the layer that needed
                                                 testing. *PASS is on all 7
                                                 scenarios now executed, not
                                                 on "7/7 against the live
                                                 Pinecone index" - scenario 4
                                                 specifically used zero
                                                 Pinecone calls, by design.
Pinecone concurrent-generation       PASS        §59 - EXECUTED 2026-09-01,
  torture test (§59)                             EXCLUSIVELY via
                                                 convex/crawlMutationsGeneration
                                                 Race.test.ts, a new
                                                 convex-test (in-memory,
                                                 deterministic-ordering)
                                                 test. PRE-EXISTING
                                                 DISCREPANCY, found and
                                                 flagged while adding this
                                                 row, not silently left for
                                                 a reader to trip over:
                                                 `pinecone-p2-proof-2026-08/
                                                 lifecycle-matrix-report.md`
                                                 (2026-08-24) already claimed
                                                 §59 "PASS", and this
                                                 document never
                                                 cross-referenced or
                                                 reconciled that claim before
                                                 today - the two documents
                                                 have silently contradicted
                                                 each other since 2026-08-24
                                                 (that report: PASS; this
                                                 one, until today: INFERENCE
                                                 ONLY, NOT TESTED). Reading
                                                 that report's own
                                                 `lifecycle_matrix.py`
                                                 resolves the contradiction:
                                                 its `commit_generation()` is
                                                 a hand-written Python
                                                 REIMPLEMENTATION of the
                                                 fencing logic (its own
                                                 docstring says "mirroring
                                                 commitGeneration"), not the
                                                 real `onRagEntryComplete`
                                                 TypeScript code this row is
                                                 about - it proves the Python
                                                 mirror is internally
                                                 consistent, not that the
                                                 real production mutation
                                                 layer matches it. This is
                                                 the FIRST time the real
                                                 code was actually exercised
                                                 for this invariant. That
                                                 report is left unedited
                                                 (out of scope, and a
                                                 legitimate historical record
                                                 of what it actually tested,
                                                 correctly labeled at the
                                                 time by its own evidence)
                                                 - this note exists so a
                                                 future reader who finds it
                                                 first isn't misled into
                                                 thinking the real code was
                                                 already covered.
                                                 CORRECTION to this row's
                                                 own prior framing: the
                                                 gap was never actually
                                                 "requires calling Gemini."
                                                 @convex-dev/rag's add()
                                                 accepts a caller-supplied
                                                 chunks:[{text,embedding}]
                                                 alongside the real
                                                 onComplete callback in the
                                                 SAME call (verified against
                                                 the installed package's own
                                                 .d.ts before writing any
                                                 test code, per this
                                                 project's evidence
                                                 discipline) - source-read
                                                 of node_modules/@convex-dev/
                                                 rag/dist/client/index.js's
                                                 createChunkArgsBatch
                                                 confirms a chunk carrying
                                                 its own embedding is
                                                 filtered out of the "missing
                                                 embeddings" batch before
                                                 embedMany/doEmbed would ever
                                                 be called - zero Gemini
                                                 calls, by construction, not
                                                 assumption. This exercises
                                                 the REAL
                                                 onRagEntryComplete fencing
                                                 mutation
                                                 (convex/crawl/mutations.ts:
                                                 812-935) through the REAL
                                                 @convex-dev/rag component's
                                                 add()->promoteToReady->
                                                 onComplete chain (registered
                                                 in-memory via convex-test's
                                                 official
                                                 @convex-dev/rag/test
                                                 helper, which also
                                                 registers rag's own nested
                                                 workpool subcomponent) -
                                                 NOT pineconeAdapter.ts
                                                 directly, which still has
                                                 no fencing by design and is
                                                 not the layer this
                                                 invariant lives in (see the
                                                 gates-table row this
                                                 replaces for why a raw-
                                                 adapter test would have
                                                 been the wrong target).
                                                 Ordering used (deterministic,
                                                 not a real timing race - see
                                                 the test file's own header
                                                 for the industry-practice
                                                 citations): insert a
                                                 synthetic document at
                                                 ingestionGeneration 1, stage
                                                 its chunk text, patch the
                                                 SAME document to generation
                                                 2 (exactly what a real
                                                 second queueChunksForEmbedding
                                                 call does), THEN call
                                                 rag.add() for generation 1
                                                 with a synthetic embedding
                                                 and the real onComplete
                                                 callback - source-reading
                                                 node_modules/@convex-dev/
                                                 rag/dist/component/entries.js's
                                                 promoteToReadyHandler showed
                                                 onComplete fires
                                                 SYNCHRONOUSLY inside a
                                                 single-call add() with all
                                                 chunks supplied up front (no
                                                 scheduled/deferred window to
                                                 hold open), so the
                                                 adversarial ordering is
                                                 built by sequencing the
                                                 generation-2 bump BEFORE the
                                                 stale add() call rather than
                                                 by deferring a scheduled
                                                 callback - the correct
                                                 analogue of "generation 1's
                                                 embeddingWorkpool action was
                                                 already in flight when
                                                 generation 2's crawl round
                                                 started." Assertions, each
                                                 independently (§4f/§4g of
                                                 the plan this test
                                                 followed, docs/rag-store-
                                                 evaluation/concurrent-
                                                 generation-race-test-2026-09/
                                                 PLAN.md): no crawledChunks
                                                 row was created for
                                                 generation 1's stale write;
                                                 the document's
                                                 ingestionGeneration stayed
                                                 at 2 (not reverted); the
                                                 stale RAG entry was
                                                 deleted, not left
                                                 retrievable; its
                                                 pendingChunkText row was
                                                 cleaned up; and (positive
                                                 control - the load-bearing
                                                 assertion, since a harness
                                                 where onComplete silently
                                                 never fires would make the
                                                 negative result above pass
                                                 vacuously) a genuine
                                                 generation-2 completion,
                                                 run immediately afterward
                                                 in the same test, DID commit
                                                 normally: a real
                                                 crawledChunks row appeared
                                                 with ingestionGeneration 2
                                                 and the document's status
                                                 transitioned to "indexed".
                                                 A SECOND, stronger check
                                                 then follows in the same
                                                 test (added after an
                                                 external review of this
                                                 test caught that the first
                                                 pass only proved the WEAKER
                                                 half of §59's own wording -
                                                 "N must never become
                                                 authoritative after N+1
                                                 COMMITS", not merely after
                                                 N+1 has started): with
                                                 generation 2's row already
                                                 committed above, a second,
                                                 later stale generation-1
                                                 completion arrives (reusing
                                                 the same ragVersionKey,
                                                 free again since the first
                                                 stale attempt was deleted)
                                                 and is asserted to leave the
                                                 already-committed
                                                 generation-2 row completely
                                                 unchanged (same ragId, text,
                                                 ingestionGeneration,
                                                 chunksEmbedded, and status),
                                                 with its own entry deleted
                                                 same as the first stale
                                                 attempt. This is the
                                                 ordering §59 actually
                                                 names, not just the "N+1
                                                 has started" case. Also
                                                 asserted:
                                                 usage.tokens === 0 on both
                                                 add() calls, turning the
                                                 zero-Gemini-cost source
                                                 read into a standing guard
                                                 rather than a one-time
                                                 claim. Confirmed
                                                 deterministic: ran 3
                                                 consecutive times,
                                                 identical pass every time,
                                                 no sleep/real timers/
                                                 network. Reproduce:
                                                 `npx vitest run
                                                 convex/crawlMutationsGeneration
                                                 Race.test.ts`. Zero Gemini/
                                                 Pinecone/Convex Cloud calls
                                                 (convex-test is fully
                                                 in-memory; no deployment of
                                                 any kind involved). This
                                                 project's own `npm run
                                                 typecheck` (root
                                                 tsconfig.json) excludes
                                                 convex/ entirely except for
                                                 files transitively imported
                                                 from src/ - it never
                                                 actually checked this file.
                                                 The real gate is
                                                 `npx tsc --noEmit -p
                                                 convex/tsconfig.json`, which
                                                 initially failed on this
                                                 file alone (TS2688: the
                                                 `/// <reference
                                                 types="vite/client" />`
                                                 directive convex-test's own
                                                 testing guidelines require
                                                 could not resolve, because
                                                 pnpm does not hoist `vite`
                                                 to top-level node_modules
                                                 when it is only a
                                                 transitive dependency of
                                                 vitest) - fixed by adding
                                                 `vite` as an explicit
                                                 devDependency (not by
                                                 adding it to tsconfig's
                                                 `types` array, which this
                                                 project's own guidelines
                                                 forbid for uninstalled
                                                 packages). Re-run after the
                                                 fix: this file produces zero
                                                 errors under
                                                 convex/tsconfig.json; the 13
                                                 remaining errors there are
                                                 all pre-existing, in files
                                                 this work never touched.
Pinecone LSN write-visibility        PARTIAL     §54's specific mechanism
  polling, no sleep-based waits                 (capture x-pinecone-
  (§54/§60)                                     request-lsn on write,
                                                 poll x-pinecone-max-
                                                 indexed-lsn on query until
                                                 it catches up) is only
                                                 used by the initial full-
                                                 corpus upload (pinecone-
                                                 p2-proof-2026-08/
                                                 lsn_utils.py) - see §56
                                                 row above. Corrected
                                                 2026-09-01: this row
                                                 previously claimed
                                                 pineconeLifecycleTest.ts
                                                 satisfied §54 too: it
                                                 does NOT - it uses
                                                 bounded query-convergence
                                                 polling (poll denseSearch
                                                 until present/absent, or
                                                 deleteMatching's own
                                                 poll-until-zero-matches),
                                                 a real, not-a-bare-sleep
                                                 wait, but a DIFFERENT,
                                                 weaker mechanism than LSN
                                                 headers - conflating the
                                                 two was the same
                                                 overclaim shape as the
                                                 lexical-rescue and
                                                 "comfortable headroom"
                                                 corrections above, caught
                                                 before shipping this
                                                 round rather than after.
Pinecone delete/replacement          PASS        §61 - EXECUTED
  physical verification (§61)                   2026-09-01 via
                                                 pineconeLifecycleTest.ts,
                                                 cross-checked two
                                                 independent ways per
                                                 commit: (1) denseSearch no
                                                 longer returns the stale
                                                 vector, (2) store.stats()
                                                 (real describeIndexStats
                                                 record count) dropped by
                                                 EXACTLY the deleted amount
                                                 (3 -> 1 on a 2-vector
                                                 deletion, tightened from
                                                 an initial looser `<=`
                                                 check and re-run to
                                                 confirm the exact
                                                 assertion still passes) -
                                                 not trusting either signal
                                                 alone. Both logical
                                                 authority (search results)
                                                 and physical vector state
                                                 (record count) confirmed
                                                 converged, not just
                                                 filtered.
Pinecone final gate declaration      NOT         §63/64/65 - still cannot
  (§63/§64/§65)                       DETERMINED declare PASS or FAIL, but
                                                 the reason changed
                                                 2026-09-01: §58/§59 (stale
                                                 generation finishing late /
                                                 N-vs-N+1 race) is now
                                                 CLOSED - see those rows
                                                 above - and was the only
                                                 item this row previously
                                                 named. Re-reading §2 in
                                                 full (per this project's
                                                 own instruction not to
                                                 assume that was the only
                                                 remaining item) turns up
                                                 THREE other gates in this
                                                 same table that are still
                                                 open and independently
                                                 block a final PASS/FAIL
                                                 declaration regardless of
                                                 §58/§59: (1) resource
                                                 projection at 2x/3x scale
                                                 (§62, PARTIAL above) -
                                                 Pinecone's payload-only
                                                 floor excludes ANN index
                                                 overhead, plausibly the
                                                 dominant storage term, and
                                                 write/read-unit/latency
                                                 telemetry is not yet
                                                 collected; (2) LSN write-
                                                 visibility polling (§54/§60,
                                                 PARTIAL above) - only
                                                 covers the initial
                                                 full-corpus upload, not the
                                                 lifecycle-test write path.
                                                 UPDATED 2026-09-02: item
                                                 (2) in this list used to be
                                                 "hybrid retrieval quality -
                                                 the unbiased lexical-value
                                                 test is not yet done" -
                                                 that specific test IS NOW
                                                 DONE (see the hybrid-
                                                 retrieval row above and
                                                 report.md §6), so it is
                                                 struck from this blocking
                                                 list, not renumbered around
                                                 - what replaces it as an
                                                 open concern is NOT a
                                                 to-do but a confirmed
                                                 permanent ceiling: 0/50
                                                 labels are HUMAN_VERIFIED
                                                 (confirmed unreachable, not
                                                 pending) and N=23/50 is
                                                 modest even after fixing
                                                 the pool bias (report.md
                                                 §7). This is a decision
                                                 for Agent B/the user, not
                                                 an execution gap: is
                                                 AUTHORITATIVE_SOURCE_MATCH/
                                                 LLM_JUDGED evidence at this
                                                 coverage sufficient to
                                                 certify retrieval quality,
                                                 given no UET Taxila domain
                                                 expert is available? The
                                                 scope of what blocks
                                                 §63/§64/§65 has narrowed to:
                                                 (1) resource projection at
                                                 2x/3x scale, (2) LSN write-
                                                 visibility on the
                                                 lifecycle-test path, and
                                                 (3) the label-provenance-
                                                 sufficiency judgment call
                                                 above - real progress, not
                                                 a formality, but still not
                                                 a PASS.
independent review (this            IN PROGRESS this document
  document, §68/§73)
production cutover to the target    NOT STARTED behind every gate above
  architecture (Pinecone dense +
  Convex lexical composite)
```

## 3. What must NOT be mistaken for "shipped"

The live site currently working (`https://uet-gpt.vercel.app` returns 200,
serves via `rugged-bird-156`) is **not** evidence that the gates above are
satisfied. It is an interim fix, applied with explicit user authorization,
to restore service while the target architecture is built - see `SHIP.md`
§0 for the full record and its own explicitly-flagged unverified risk
(whether `rugged-bird-156` holds real corpus data, which needs Clerk admin
access not available in this environment).

**§44/§56 PASS is Layer A only (2026-08-31 addendum).** A user-reported fee
figure (screenshot of the live Admissions 2026 fee page) prompted a check of
all 10 fee-related queries already in `scripts/eval/golden_set.jsonl` against
the exact dense ground truth (`ground_truth.jsonl`, the same artifact §44/§56
measured). Finding: the itemized fee-table chunks (from `UET-Prospectus-
2024.pdf` and `UET-Prospectus-2025.pdf`, both verified present and correctly
extracted against the source PDF page images) never appear in the top-5
dense-only result for ANY of the 10 queries - for the query closest to the
screenshot ("total tuition cost for a 4-year BS program"), the #1 dense hit
is an unrelated, near-empty "Discover UET Taxila" chunk. This is expected,
not a regression: §44/§56 exhaustively measured dense-cosine recall against
dense-cosine ground truth (mandate Layer A, §45) - a closed loop that cannot,
by construction, say anything about whether hybrid retrieval (Layer C: real
Convex lexical + `hybridRank` 3-way RRF + FAQ fusion + freshness decay, see
`convex/embeddings/search.ts`) surfaces this content.

**Correction to the assumption above, made and then tested same day.** The
first draft of this note assumed BM25/lexical would trivially catch these
queries since they contain exact terms like "Tuition Fee". Tested directly
against the real local Phase-5 lexical-proof deployment (`crawl/lexicalProof
:searchChunksForProof`, a bare `search_text` query - one of the three
channels `hybridRank` fuses, not the full fusion) instead of assumed:
**false**. Raw natural-language phrasing ("what is the tuition fee per
semester") returns an unrelated department's *postgraduate* fee page in the
top 5, not the undergraduate prospectus. Document-vocabulary phrasing
("Table 30.1 Admission Charges", "Fees and other Charges undergraduate")
correctly surfaces the Prospectus 2024/2025 and Rule Book 2023 chunks in the
top 5. So both retrieval channels tested so far - dense (§44/§56's artifact)
and this one lexical channel - fail identically on conversational phrasing
and succeed identically on document-register phrasing. This reframes the
finding: it is a **query-formulation gap shared by both tested channels**,
not a per-channel weakness dense fails and lexical was assumed to cover.

Production's actual query path is not raw text on any channel: `retrieval.ts`
runs `enrichQuery` (HyDE + rewrite) before search, and `searchDocumentsAction`
(`embeddings/search.ts:264-284`) sends the HyDE-expanded `finalQueryText` to
the vector search AND both lexical channels (`fullTextSearch`,
`chunkTextSearch`) - built specifically to bridge conversational-to-document
vocabulary gaps like this one. Attempted to verify this directly: blocked,
not skipped. `hydeQueryAction` needs a working Gemini/Groq key; the local
Phase-5 deployment has these deliberately set to literal placeholder values
(`unused-placeholder-phase5-lexical-proof`, confirmed via `npx convex env
list`) as part of that phase's original, intentional zero-LLM-call
guarantee - not touched, since flipping a guardrail set by earlier work for a
different purpose is a separate call, not implied by this investigation. A
hand-written stand-in for what a HyDE expansion might read like was tried as
a weaker substitute and gave an inconclusive result (one test query: no
improvement; the other: found the right document - the correct Prospectus -
but the wrong section within it). Net: **the mechanism designed to fix this
already exists in shipped code and was never built as part of this
investigation; whether it actually closes the gap is unverified, not
disproven.** §45/46/57 (hybrid, against the REAL production
`hybridRank`/`searchDocumentsAction` code per §46's own rule, including real
HyDE with real keys, not a Python approximation or a hand-written stand-in)
is the correct, already-planned way to settle this, and remains explicitly
PAUSED per the user's own 2026-08-29 decision to invest in real
HUMAN_VERIFIED labels first - this finding does not reopen that decision, it
is a reason §45/46/57 matters, not a substitute finding for it.

**§45/46/57 resumed on all 50 queries, real RRF fusion, 2026-08-31.** The
user could not review from personal knowledge ("most of the answer I dont
know It is very difficult task for me") and, after an initial 11-query fee
subset, explicitly asked the AI to complete all 50 ("fill all the
questions make sure to do it with 100% accuracy"). See
`scripts/eval/label_review.md`'s 2026-08-31 addendum for the full
provenance/labeling-rule disclosure. All 50 queries are now reviewed (15
AUTHORITATIVE_SOURCE_MATCH - single-source judgments where cross-checked
against an independent second source, e.g. two Prospectus editions plus
Discover.php plus a 2013-14 annual report all corroborating the same campus
location; 35 LLM_JUDGED - read against the query directly, no independent
cross-check - never HUMAN_VERIFIED, and `parse_label_review.py` was fixed
to carry real per-query provenance instead of a hardcoded "HUMAN_VERIFIED"
string that would have mislabeled every record). `golden_set_verified.jsonl`
now has all 50 real records - 19 with at least one labeled relevant chunk,
31 explicitly reviewed as having none in the dense/lexical top-10 (not
unreviewed - a real, checked finding, e.g. multiple department pages that
extracted as near-empty nav/header stubs, confirmed by reading full chunk
text, not assumed from the truncated preview).

Ran real hybrid fusion against all 50 - not a Python approximation:
`docs/rag-store-evaluation/hybrid-retrieval-2026-08/fetch_channel_results.py`
fetches real dense (Pinecone `corpus-v1-full`, 44,792 vectors confirmed)
and real lexical (local Convex `search_text`) top-10 per query, then
`fuse_and_score.ts` fuses them with `hybridRank` imported directly from
`convex/embeddings/hybridRank.ts` (extracted verbatim from `search.ts` this
same day - see that file's header - specifically because tsx hangs
indefinitely importing anything that transitively pulls in
`rag/instance.ts`'s module-scope `new RAG(components.rag, ...)`, which only
resolves inside a deployed Convex function; isolated and confirmed by
bisection before concluding this, not assumed). Splitting `hybridRank` out
change production behavior not at all - same function, same call site,
`search.ts` re-exports it.

**2026-09-01 correction to this paragraph (as first written 2026-08-31):**
the claims "lexical never rescued a dense miss anywhere in the full 50" and
"31/50 have [no relevant chunk] in either channel" overclaimed what this
test can show, and are retracted as findings about lexical search.
`label_review.md`'s review candidates come EXCLUSIVELY from
`ground_truth.jsonl`'s dense (exact-cosine) top-5 -
`generate_label_review.py` line 62, `g["top5"]`, itself
`exact_ground_truth.py`'s dense-only output. Lexical's own top-10 was never
shown to the reviewer for judgment. A chunk findable only via lexical
search therefore had zero chance of ever entering `relevantChunkKeys`, by
construction - "lexical never rescues" is a structural artifact of how the
label set was built, not a measured empirical result, and must not be read
as evidence lexical search adds nothing (directly the wrong conclusion for
§31/§66 to draw from this data). "Dense alone already found 18 of 19" is
correspondingly close to tautological, since those 19 labels were
themselves sampled from dense's own candidate list. What the 18/19
HitRate@5 / 0.708 MRR numbers below DO measure honestly and without this
bias: given a chunk already known (via dense) to be the corpus's best
answer, does real `hybridRank` fusion keep it retrievable once lexical's
independently-fetched top-10 is mixed in, or does it get pushed out? That
is an unbiased question, and the one exception found below answers it
concretely - that finding stands. "31/50 have no relevant chunk" is
narrowed to: 31/50 queries had nothing among DENSE's own top-5 candidates
that the reviewer judged relevant - a dense-precision/coverage-as-seen-by-
dense result, not a claim that lexical was independently checked and also
came up empty. The qualitative full-text nav-stub finding (chunks read in
full, not the truncated preview) still independently supports a real
content-thinness problem in the corpus; that read is unaffected, it just
isn't established BY the missing-label count on its own. An unbiased
hybrid-value test would need review candidates pooled from BOTH channels
(dense top-K UNION lexical top-K), not dense only - not done here, a real
open item, not completed as part of this correction.

Result: of all 50, only 19 have a relevant chunk among dense's own top-5
candidates, as judged by the reviewer (see correction above - not the same
claim as "no relevant chunk exists in either channel," which the original
draft of this paragraph wrongly asserted). Of those 19, real `hybridRank`
fusion: **18/19 HitRate@5 (0.947), mean MRR 0.708**, measuring fusion's
effect on content dense already found, not overall hybrid recall against
the true relevant-chunk universe (unmeasured - see correction above). One
real, concrete, unbiased exception worth naming precisely: fusion actively
HURT one query ("eligibility criteria") - dense alone ranked the correct
chunk 5th (a weak, marginal hit), and fusing in lexical's four unrelated
top candidates was enough RRF weight to push it to rank 9, outside the
fused top-5. This still isolates one variable cleanly: real dense + real
lexical + real fusion, raw query text (no HyDE/rewrite - still blocked on
the placeholder-key guardrail, not touched, same reasoning as above). Full
results:
`docs/rag-store-evaluation/hybrid-retrieval-2026-08/hybrid_eval_results.json`.

A separate, real, previously-undiscovered bug was found and fixed while
building this: local Convex deploys (`npx convex dev`) have been failing
outright since `pineconeAdapter.ts` was added to the `convex/` tree - it
imports the Pinecone SDK's Node APIs without the required `"use node"`
directive, so Convex's bundler fails on ANY local deploy attempt,
unrelated to anything in this fee investigation. Fixed by adding the
directive (one line, `convex/knowledgeStore/pineconeAdapter.ts`). A full
`tsc` typecheck across the project also failed to complete within the
checked timeout during this same push; not investigated further (out of
scope for this investigation) and not yet known whether it is pre-existing
or related - flagged, not fixed.

Separately, and NOT yet resolved: three different fee-table editions (Rule
Book 2023, Prospectus 2024, Prospectus 2025) exist in Corpus V1 with
different figures and no freshness signal between them in the *candidate*
pipeline's own chunk metadata - unlike production's
`docMeta.crawledAt`/`freshnessTier`/`isStale`, which the candidate pipeline
(local numpy vectors, no Convex doc metadata attached) does not carry.

**Scope correction per the user (2026-08-31):** whether `rugged-bird-156` (or
any existing Convex deployment) gives a correct fee answer is explicitly OUT
of scope for this evaluation - per the user's own framing, no existing
deployment is considered reliable/production-grade, which is the whole
reason this local-corpus -> Pinecone rebuild exists. The rugged-bird-156
data-verification item earlier in this section is retained as SHIP.md's own
standing record of the interim-fix risk, not as an open task for this
evaluation to chase.

**§58/§59/§61 lifecycle work, 2026-09-01, with explicit user authorization
for real Pinecone writes/deletes in the isolated test namespace.** New
file: `convex/knowledgeStore/pineconeLifecycleTest.ts` (internalAction, no
args, self-cleaning - same `.invalid`-domain/isolated-namespace pattern as
`knowledgeStore/lifecycleTest.ts` and `pineconeAdapter-live-test.ts`).
Deployed to the LOCAL self-hosted Convex backend only (`http://127.0.0.1:3210`)
after setting a real `PINECONE_API_KEY` on that local-only deployment's env
(Pinecone itself is the real cloud service under test, not Convex Cloud -
this does not touch `rugged-bird-156` or any Convex Cloud deployment). Ran
via `npx convex run knowledgeStore/pineconeLifecycleTest:run '{}'` - chosen
over `npx tsx` because a fresh `tsx -e` import of `@pinecone-database/pinecone`
was re-tested this session and confirmed to still hang indefinitely (60s
timeout, no error, no resolution) - the same unresolved tsx/esbuild<->SDK
interop issue found earlier in the hybrid-retrieval work, not re-litigated
here, just routed around the same way (via Convex's own bundler instead of
tsx). Result: **10/10 checks passed**, real writes/deletes against the live
`uetgpt-corpus-v1-qwen1024` index, isolated `adapter-contract-test`
namespace (same one `pineconeAdapter-live-test.ts` already used). Total
write volume: 6 vector upserts + 4 delete/commit operations across the
whole run - well under the 15-30-operation budget given to the user before
starting. Independently verified after the run via a raw
`describe_index_stats()` Python call (bypassing the adapter entirely, a
second, unrelated code path): `adapter-contract-test` namespace shows no
vectors, `corpus-v1-full` (the real corpus) shows exactly 44,792, unchanged.

Before writing this test, the original plan (torture-test the N/N+1 race
directly against `pineconeAdapter.ts` in isolation) was reconsidered after
reading `convex/crawl/mutations.ts`'s generation-fencing logic: that
invariant is enforced by the application mutation layer, not the storage
adapter, so a raw-adapter torture test would have reproduced a known,
by-design adapter property (no fencing) and reported it as a "failure" -
the same class of methodology mistake as the retracted lexical-rescue
claim above, caught before running it rather than after. At the time this
was written, scenario 4 / §59 stayed open, recorded as INFERENCE, not
executed - the right layer to test it (the mutation layer) was identified,
but not yet exercised.

**§59 closed, 2026-09-01, later the same day.** A follow-up plan
(`docs/rag-store-evaluation/concurrent-generation-race-test-2026-09/
PLAN.md`) worked out how to exercise that mutation layer without the
Gemini cost that had been assumed to make it out of scope: `@convex-dev/
rag`'s `add()` accepts a caller-supplied `chunks:[{text,embedding}]`
alongside a real `onComplete` callback in the same call - verified against
the installed package's own type definitions before writing any test code,
then confirmed at the source level (`createChunkArgsBatch` filters a chunk
that already carries an embedding out of the batch that would otherwise be
sent to `embedMany`/Gemini). The resulting test,
`convex/crawlMutationsGenerationRace.test.ts`, uses `convex-test` with the
`@convex-dev/rag` component registered in-memory (via the package's own
`@convex-dev/rag/test` helper, which also registers rag's nested `workpool`
subcomponent) to drive the real `onRagEntryComplete` fencing mutation
through the real component `add()`->`onComplete` chain. One correction to
the plan as written: the plan assumed generation-1's `onComplete` would be
a scheduled callback that could be held open with
`t.finishInProgressScheduledFunctions`; reading
`node_modules/@convex-dev/rag/dist/component/entries.js`'s
`promoteToReadyHandler` showed that for a single-call `add()` with all
chunks supplied up front, `onComplete` fires synchronously inside that same
mutation, so there is no such window. The adversarial ordering was instead
built by patching the document to generation 2 BEFORE calling generation
1's (deliberately delayed) `rag.add()` - the correct analogue of
"generation 1's embeddingWorkpool action was already in flight when
generation 2's crawl round started." Result: PASS, including the positive
control (a real generation-2 completion committing normally in the same
test, so the negative result isn't vacuous), confirmed deterministic across
3 consecutive runs. An external review of this test (before this document
was updated) caught that this first pass only proved the WEAKER half of
§59's own wording - N rejected after N+1 has merely started, not after N+1
has actually committed - so the test now also stages a SECOND, later stale
generation-1 completion after generation 2's row is already committed, and
asserts that row survives completely unchanged. The same review also caught
that `npm run typecheck` never actually checks anything under `convex/`
(the root tsconfig excludes it outright), so the file had never really been
typechecked; `npx tsc --noEmit -p convex/tsconfig.json` is the real gate,
and it initially failed on this file's `vite/client` type reference (pnpm
does not hoist a transitive-only dependency) - fixed by adding `vite` as an
explicit devDependency, not by widening `tsconfig.json`'s `types` array.
See §2's gates table for the full assertion list and reproduction command.

## 4. What a reviewer should re-verify independently, not just re-read

```text
- Run cf_embed_corpus.py's verify_embeddings.py once the corpus finishes;
  do not trust a "done" claim without its exit code.
- Re-run pineconeAdapter-live-test.ts and cloudflareRerank-live-test.ts
  against the live index/API rather than trusting this session's logs.
- Independently confirm the dimension/model/generation-key scheme in
  pineconeAdapter.ts matches convexAdapter.ts's real computeRagVersionKey
  usage, not just this document's claim that it does.
- Check rugged-bird-156's actual document/chunk counts via the Convex
  dashboard (Clerk admin auth was not available in this session) before
  treating the interim fix as safe to leave in place long-term.
- 2026-09-02 additions: independently spot-check a sample of the 15
  chunks the delta review (report.md §6) marked newly-relevant, and the
  10 corroboration upgrades (report.md §7) - both are one AI session's
  judgment calls, documented with reasoning in
  scripts/eval/golden_set_verified.jsonl and delta_label_review.md, but
  not independently verified by a second reviewer. Re-run
  scripts/eval/parse_delta_label_review.py twice against a copy of the
  committed golden set and confirm zero diff (idempotency was fixed and
  verified once already in commit b5eac06 - do not just trust that log,
  reproduce it). Confirm scoredQueryCount/meanHitAt5/meanMrr in
  hybrid_eval_results.json actually match what a fresh
  `npx tsx docs/rag-store-evaluation/hybrid-retrieval-2026-08/fuse_and_score.ts`
  run produces against the committed channel_results.json.
```

## 5. Cloud/cost activity this session (cumulative, for audit)

```text
Cloudflare Workers AI:  under the 10,000/day free allocation every day;
                        hit the daily limit multiple times (expected,
                        by design - the ingest self-limits rather than
                        overrunning)
Pinecone:               1 index created (uetgpt-corpus-v1-qwen1024),
                        test writes fully cleaned up (confirmed 0
                        vectors after every live-test run, including
                        pineconeLifecycleTest.ts's 2026-09-01 run - 6
                        vector upserts + 4 delete/commit ops, verified
                        clean via an independent raw describeIndexStats
                        call after)
Vercel:                 2 env vars changed on production (explicit user
                        authorization, SHIP.md §0), 1 redeploy
Convex Cloud:           0 writes to application data; read-only queries
                        and one already-authorized production repoint
§59 generation-race     0 Gemini / 0 Pinecone / 0 Convex Cloud calls -
  test (2026-09-01):    convex/crawlMutationsGenerationRace.test.ts runs
                        entirely in-memory via convex-test, no deployment
                        of any kind involved. Local dev dependencies only
                        (no cost, but a real change to package.json worth
                        naming plainly, not just inside a gates-table
                        parenthetical): convex-test@0.0.54 (pinned exact -
                        the newer 0.0.56 requires convex ^1.43.0, which
                        this project's installed convex@1.40.0 does not
                        satisfy; whoever upgrades convex past 1.43 should
                        re-evaluate this pin), @edge-runtime/vm@^5.0.0, and
                        vite@^8.0.16 (promoted from a floating transitive
                        dependency of vitest to an explicit devDependency,
                        because pnpm does not hoist transitive-only
                        packages to top-level node_modules, and this
                        test's guidelines-mandated
                        `/// <reference types="vite/client" />` needs it
                        resolvable there).
Hybrid pool-bias fix    0 Gemini / 0 Pinecone / 0 Convex Cloud calls -
  + corroboration pass  the delta-review candidates (fusedTop5) were
  (2026-09-02):          already cached in hybrid_eval_results.json from
                        the 2026-08-31 fetch; the corroboration-pass
                        searches ran a Python regex over the local
                        all_chunks.jsonl file (44,792 chunks), not the
                        Pinecone index. fuse_and_score.ts's re-run reused
                        the same cached dense/lexical channel results,
                        only re-computing the local fusion+scoring logic.
Money spent:            $0
```

## 6. Why the one remaining hard-blocked item is not further actionable
   right now, and what would change that

**2026-08-31 scope correction (user, verbatim intent):** the user
explicitly ruled `rugged-bird-156` data verification OUT OF SCOPE for this
benchmark, not merely credential-blocked: "we dont have any reliable
production grade database with good data.. that [is] the reason we make a
local database then do embedings and then deploy to pinecone." The premise
of this entire local-corpus -> Pinecone rebuild is that no existing Convex
deployment (including `rugged-bird-156`) is trusted as a reliable data
source - so whether it happens to hold real data is not a question this
benchmark needs answered, and this session stopped pursuing it after this
correction. The paragraph below is kept as the historical record of why it
was originally investigated (a Clerk-access blocker) before the user
narrowed the scope; it should not be read as still-open follow-up work.

**`rugged-bird-156` data verification** needs either the user's own Clerk
sign-in to ask the live app a real question, or Clerk admin dashboard
access - both outside what this session has credentials for.

(Corpus embedding was rate-limited by Cloudflare's shared free daily neuron
allocation until 2026-08-29, when it completed - see §2. The three ways to
remove that limit were each explicitly considered and rejected on real
grounds while it was still open, not left unexamined: enabling the paid tier
was explicitly declined by the user ("I cannot spend money") more than once;
using multiple free accounts would be quota-farming, already rejected on the
same principle for a different provider (Gemini/GCP) earlier in this same
session; running a second free provider in parallel would have produced
vectors in a different latent space for the same corpus, structurally
corrupting the index rather than speeding anything up. None of this remains
relevant now that the embed is done - kept here only as the record of why it
took the time it took.)

This document should be re-read, not re-derived. §44/§56/§45-46-57/§62
(exact ground truth, ANN recall, hybrid retrieval, resource projection) are
the active work now that embedding is complete - see §2 for their status.
