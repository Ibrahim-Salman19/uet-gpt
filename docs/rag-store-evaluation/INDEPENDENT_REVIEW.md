# Independent review package (Agent B) - status as of 2026-08-26

Prepared per mandate §68/§73: a passing benchmark does not authorize
production cutover, and the agent who built the system must not self-certify
it. This document is the entry point for that review - what to check, where
the evidence lives, and what is explicitly NOT yet ready to be checked. It is
written now, before the gated items finish, so review readiness is a matter
of re-reading this file once they do, not a fresh engineering task.

## 0. One-line status

**NOT READY for production cutover.** Two hard gates remain open, both
correctly time/access-bound rather than engineering-bound (§6). Everything
that can be prepared and tested in isolation from those two gates has been.

## 1. What is verified and can be checked right now

```text
[x] Embedding backend selection    docs/rag-store-evaluation/cloudflare-
                                   workers-ai-2026-08/report.md - measured
                                   bake-off (bge-m3 vs qwen3-0.6b) on this
                                   corpus, not vendor reputation. Two models
                                   disqualified by a truncation test, not
                                   assumed safe.

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
corpus embedding COMPLETE           PENDING     7,324/44,792 (16.4%) as
  (§40 embed-exactly-once)                      of this writing. Rate-
                                                 limited by Cloudflare's
                                                 free daily allocation;
                                                 cron resumes every 3h.
                                                 No ethical acceleration
                                                 path available (see §6).
exact dense ground truth (§44)      BLOCKED     needs the full embedded
                                                 set - a ground truth
                                                 computed against a
                                                 partial corpus would
                                                 misidentify true nearest
                                                 neighbors that live in
                                                 the unembedded 84%.
ANN Recall@10 >= 0.98 vs exact      BLOCKED     needs the above
  ground truth (§56)
hybrid retrieval evaluated with     BLOCKED     needs full corpus AND a
  REAL Convex lexical +                         working production
  hybridRank, not reimplemented                 Convex deployment for
  (§45/§46/§57)                                 the lexical side - the
                                                 interim rugged-bird-156
                                                 fix technically unblocks
                                                 the SECOND half of this,
                                                 but running it against
                                                 an unfinished corpus
                                                 would not be meaningful
resource projection at 2x/3x        BLOCKED     needs real full-corpus
  scale (§62)                                   numbers, not projected
                                                 from a 16% sample
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
```

## 5. Cloud/cost activity this session (cumulative, for audit)

```text
Cloudflare Workers AI:  under the 10,000/day free allocation every day;
                        hit the daily limit multiple times (expected,
                        by design - the ingest self-limits rather than
                        overrunning)
Pinecone:               1 index created (uetgpt-corpus-v1-qwen1024),
                        test writes fully cleaned up (confirmed 0
                        vectors after every live-test run)
Vercel:                 2 env vars changed on production (explicit user
                        authorization, SHIP.md §0), 1 redeploy
Convex Cloud:           0 writes to application data; read-only queries
                        and one already-authorized production repoint
Money spent:            $0
```

## 6. Why the two remaining PENDING/BLOCKED items are not further
   actionable right now, and what would change that

**Embedding completion** is rate-limited by Cloudflare's shared free daily
neuron allocation. The three ways to remove that limit were each explicitly
considered and rejected on real grounds, not left unexamined:

```text
enable paid tier            explicitly declined by the user ("I cannot
                             spend money"), stated more than once
use multiple free accounts  quota-farming across accounts - already
                             rejected on the same principle for a
                             different provider (Gemini/GCP) earlier in
                             this same session; applying a different
                             standard to Cloudflare would be inconsistent
run a second free provider  would produce vectors in a different latent
  in parallel                space for the SAME corpus - structurally
                             corrupts one Pinecone index rather than
                             speeding it up (this is why the project
                             moved off Gemini for this corpus in the
                             first place, not something to reconsider)
```

**`rugged-bird-156` data verification** needs either the user's own Clerk
sign-in to ask the live app a real question, or Clerk admin dashboard
access - both outside what this session has credentials for.

This document should be re-read, not re-derived, once the embed finishes -
that is the entire point of writing it now.
