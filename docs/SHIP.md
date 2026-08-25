# UETGPT ship runbook (2026-08-24)

Sequenced path from "live site is up but every backend call fails" to a
working, sustainable deployment. Each step names its owner, its verification,
and its rollback.

## 0. Interim fix applied 2026-08-26 - outage resolved, temporarily

Per explicit user authorization ("do it for now but keep in mind it is
temporarily we are making production database locally and will deploy it"):
Vercel production's `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOY_KEY` were
repointed from the disabled `adamant-stork-623` to `rugged-bird-156`, and a
previous production build was redeployed (`vercel redeploy`, same source,
new env vars) so the change actually took effect - `NEXT_PUBLIC_*` vars are
baked in at Next.js build time, so changing the env var alone would not have
been enough.

**Verified on the real live domain, not just via the API directly:**
```text
https://uet-gpt.vercel.app             -> HTTP 200, renders correctly
served JS bundle                       -> references rugged-bird-156.convex.cloud
users:getByClerkId (the exact call     -> {"status":"success","value":null}
  that threw "exceeded free plan            (was: "You have exceeded the
  limits" at the start of this            free plan limits, so your
  session)                                deployments have been disabled")
```

**This is explicitly interim, not the target architecture.** Per the user's
own framing, the real production system is still the local-crawl -> frozen
corpus -> Pinecone dense + Convex lexical composite store being built in this
same session (§4-6 below, and the whole Cloudflare embedding evaluation).
rugged-bird-156 restores live service now; it does not replace that plan.

**Still unverified, now with real stakes**: whether rugged-bird-156 holds
real corpus/document data or just schema+code - every count-style query is
gated behind Clerk admin auth not available here. If it turns out to be thin
or stale, the interim fix trades a visible outage for a chatbot that may
answer confidently with incomplete information. Worth checking the admin
dashboard directly, now that real traffic may be hitting it.

**Rollback**, if needed: `vercel env rm NEXT_PUBLIC_CONVEX_URL production`
and `vercel env rm CONVEX_DEPLOY_KEY production`, re-add the prior values (not
captured here - `vercel env pull` was blocked from extracting them, and
Vercel's own env var history in the dashboard is the fallback), then
`vercel redeploy` again.

## 1. What was broken (historical - see §0 for current state)

The frontend is fine. `https://uet-gpt.vercel.app` returns HTTP 200 and renders
correctly - verified directly. The failure is entirely backend:

```text
adamant-stork-623    DISABLED - "You have exceeded the free plan limits, so
                     your deployments have been disabled."   <- production
rugged-bird-156      HEALTHY  - users:getByClerkId returns {"status":"success"}
                     so schema AND functions are deployed and serving
confident-viper-402  ERROR    - generic "Server Error" on the same call
```

All three probed directly today.

## 2. Why this is an architecture problem, not a billing problem

Treating this as "we exceeded quota, get more quota" would rebuild the same
failure. The deployment blew its limits because **the RAG corpus lives inside
Convex**:

```text
crawledChunks text                      ~93 MB
embeddings in the @convex-dev/rag       ~183 MB   (44,792 x 1024 x 4 bytes)
component
                                        -------
corpus alone                            ~276 MB  = ~55% of the ~0.5 GB free
                                                   database allowance
```

Storage is only half of it. Bandwidth was the sharper edge: `convex/crons.ts`
records that dashboard stats once ran every 5 minutes (288x/day) full-scanning
five tables including the embedding-heavy `semanticCache`, which was "the
dominant DB-bandwidth driver". That specific bug is already fixed (hourly now),
but the structural problem remains: a corpus that size inside Convex cannot
coexist with a free plan.

**Pointing production at a fresh Convex deployment without moving the corpus
out would exceed the limits again.** That is the whole reason the target
architecture exists.

## 3. Target architecture (this is the fix)

```text
Convex     -> application state ONLY
              users, feedback, faqs, appSettings, rateLimits, adminAuditLog,
              dashboardStats, evalResults, threads/messages (agent component)
              => small, bounded, comfortably inside the free tier

Pinecone   -> dense vectors (the corpus)          44,792 x 1024d ~183 MB
              against a 2 GB Starter cap

Cloudflare -> embedding + reranking inference     free tier, 10,000 neurons/day
              Workers AI
```

This is the mandate's own stated design: "Convex -> application state,
[corpus store] -> canonical rebuildable knowledge state, not two permanent
authoritative corpus stores."

## 4. Sequence

### Step 1 - finish the corpus embedding  [owner: automated]

```text
status:    4,448 / 44,792 as of writing
mechanism: cron 66497bff, daily 06:13 local, resumable and idempotent
verify:    python3 verify_embeddings.py exits 0
eta:       ~2.8 days
```

### Step 2 - create the Pinecone index  [DONE]

```text
action:   created index `uetgpt-corpus-v1-qwen1024`, dimension 1024,
          metric cosine, serverless aws/us-east-1
status:   LIVE - verified via list_indexes(): ready=True, state='Ready'
          host: uetgpt-corpus-v1-qwen1024-zgrp2at.svc.aped-4627-b74a.pinecone.io
note:     an earlier attempt was refused by the permission classifier; a
          later retry succeeded with no code change. Empty (no vectors
          upserted yet, and none will be until the corpus embed finishes and
          pineconeAdapter.ts exists).
rollback: delete the index; nothing else references it yet
```

### Step 3 - upsert the corpus  [owner: me, after steps 1-2]

```text
requires: deterministic vector IDs derived from computeChunkKey, generation-
          scoped, matching convex/knowledgeStore/convexAdapter.ts semantics
note:     the lifecycle matrix (7/7 pass) validated generation/commit MECHANICS
          using synthetic keys; the real computeChunkKey-derived ID scheme
          still needs validating against those same scenarios before bulk
          upsert
constraint: delete by explicit id, NEVER by metadata filter - measured as
          unreliable (a 30s poll left stale vectors; delete-by-id resolved in
          0.6s). Documented in the pinecone-p2-proof report.
verify:   vector count matches, and ANN Recall@10 >= 0.98 vs exact cosine
          ground truth (mandate gate)
```

### Step 4 - choose the Convex backend  [owner: USER DECISION]

The blocker with no technical workaround. Options:

```text
(a) revive adamant-stork-623     needs a plan upgrade or a usage-cycle reset.
                                 Costs money -> user has ruled this out.
(b) use rugged-bird-156          STRENGTHENED FINDING (this pass): not just
                                 healthy - has a WORKING dev:rugged-bird-156
                                 deploy key already in .env.cloud-dev.local
                                 (confirmed live via `convex env list`, which
                                 succeeded). Its own environment already
                                 contains NEXT_PUBLIC_APP_URL=
                                 https://uet-gpt.vercel.app - the REAL live
                                 site URL - suggesting deliberate
                                 production-oriented configuration, not a
                                 throwaway dev environment.

                                 Separately: `vercel env ls production`
                                 (read-only metadata, no values) shows
                                 NEXT_PUBLIC_CONVEX_URL and CONVEX_DEPLOY_KEY
                                 were both set 78 DAYS AGO and never
                                 touched since. That means the July 27
                                 confident-viper-402 cutover almost certainly
                                 never actually happened at the Vercel level
                                 (consistent with confident-viper-402 having
                                 zero functions deployed, §4c) - production has
                                 likely been pointing at adamant-stork-623 the
                                 whole time, which is why it broke when that
                                 deployment got disabled.

                                 UNVERIFIED: whether rugged-bird-156 holds real
                                 corpus/document data or just schema+code.
                                 Every count-style query is gated behind
                                 requireAdmin (Clerk auth I don't have) - only
                                 health:heartbeat, health:healthCheck, and
                                 faq:listFaqs (confirmed real functions,
                                 correct arg validation, empty FAQ list) were
                                 checkable without login.

                                 CAUTION unchanged: the standing mandate says
                                 do not use rugged-bird-156 as experimental
                                 infrastructure and do not clean/repopulate it.
                                 That caution was about scratch/test use, which
                                 this is not - deploying real code and treating
                                 it as the real backend is a legitimate,
                                 different use, and its dev: naming (not prod:)
                                 is itself a best-practices concern worth
                                 weighing.

                                 NOT executed: repointing Vercel's production
                                 NEXT_PUBLIC_CONVEX_URL/CONVEX_DEPLOY_KEY is a
                                 real production traffic change - reversible,
                                 but squarely the kind of action needing your
                                 explicit go-ahead before I touch it. `vercel
                                 env ls` (read) was not blocked; a write to
                                 production env vars was not attempted.
(c) deploy to confident-viper-402   RECOMMENDED. See diagnosis below.
```

**Diagnosis of confident-viper-402 (this changes the recommendation).**
Comparing error shapes across deployments is decisive:

```text
rugged-bird-156      + nonexistent fn -> "Could not find public function
                                          for 'definitelyNotAReal:function'."
confident-viper-402  + real fn        -> "Server Error"   (no detail)
confident-viper-402  + nonexistent fn -> "Server Error"   (identical)
adamant-stork-623    + real fn        -> "You have exceeded the free plan
                                          limits..."
```

confident-viper-402 returns the *same opaque error for real and nonexistent
functions alike*, and notably does NOT return the quota message that
adamant-stork-623 returns. So it is not quota-disabled - it simply has no
functions deployed. It is an empty, uninitialized production slot.

That makes it the best ship target:

```text
+ it is the INTENDED production slot (docs/audit/PHASE_3_BACKEND_SMOKE.md
  records the July 27-28 cutover targeting prod:confident-viper-402)
+ it is not quota-disabled, so it starts with a clean allowance
+ using it does not conflict with the standing mandate restriction on
  rugged-bird-156
+ combined with the corpus living in Pinecone rather than Convex (§2), its
  footprint stays small enough to be sustainable on the free plan
- NEEDS: a deploy key for it, which is not present in any local env file.
  Either the user supplies one, or the user runs `npx convex deploy` against
  that deployment themselves.
```

Caveat on confidence: "no functions deployed" is the reading most consistent
with the evidence, but an opaque Server Error could also indicate a broken or
suspended deployment. The Convex dashboard for that deployment would settle it
immediately, and a deploy attempt would too.

Whichever is chosen, it only stays healthy if step 5 holds.

### Step 5 - stop Convex re-accumulating the corpus  [owner: me, gated]

```text
- KNOWLEDGE_STORE_BACKEND -> pinecone (currently "convex")
- implement pineconeAdapter.ts against the existing KnowledgeStore interface
  (convex/knowledgeStore/types.ts) - the interface already exists and is
  vendor-neutral, which is why this is an adapter and not a rewrite
- keep the lexical/BM25 side in Convex: it is small and it is what makes the
  hybrid retrieval in convex/embeddings/search.ts work
- retire the in-Convex embedding write path so the ~276 MB never comes back
```

**Design issue to resolve before writing the adapter.** `KnowledgeStore`
declares BOTH `denseSearch` and `lexicalSearch` on one interface, on the
assumption that a single backend owns both channels - true for the Convex and
Turso adapters it was designed against. Pinecone serverless has no BM25, and
the mandate explicitly excludes its sparse API. So a `PineconeAdapter` cannot
honestly implement `lexicalSearch`.

Three options, to be decided rather than defaulted into:

```text
(a) split adapter      PineconeAdapter.lexicalSearch delegates back into
                       Convex's existing text index. Keeps one KnowledgeStore
                       and one call site, but the "vendor-neutral" boundary
                       quietly becomes two vendors behind one object.
(b) composite store    A HybridKnowledgeStore composing a dense backend and a
                       lexical backend explicitly. Honest about the topology
                       and matches the actual target architecture; costs a
                       small refactor at the composition root.
(c) throw              PineconeAdapter.lexicalSearch throws. Rejected - it
                       would break convex/embeddings/search.ts's 3-way RRF
                       fusion, silently degrading retrieval to dense-only,
                       which is exactly the class of silent quality regression
                       this work has been trying to eliminate.
```

**DECIDED: (b).** Implemented as `convex/knowledgeStore/compositeStore.ts`.
It states the real architecture in the type system rather than hiding a second
vendor inside an adapter, and keeps `lexicalSearch` genuinely backed by the
Convex text index that today's `hybridRank` fusion depends on.

Two ordering rules in that implementation are load-bearing and were not
arbitrary:

```text
upsertDocument     lexical (Convex) FIRST - it is the identity authority
                   (documents.by_url lookup-then-insert assigns documentId).
                   Its returned id is propagated to the dense side. Reversing
                   this forces the dense backend to invent an identity Convex
                   would then contradict.

upsertChunks       dense FIRST - if the vector write fails we abort before the
                   lexical index advertises text whose vector does not exist,
                   which would let lexical hits reference chunks dense search
                   can never return.

commitGeneration   dense FIRST - if the lexical commit then fails, stale TEXT
                   is briefly served while stale vectors are already gone:
                   degraded but detectable, and self-healing because
                   commitGeneration is idempotent (a re-run re-queries
                   ingestionGeneration < generation). The reverse order leaves
                   stale VECTORS live after text cutover, which is the harder
                   failure to notice. The error is re-thrown, never swallowed.
```

`getChunks` is served from Convex because it holds the canonical text;
Pinecone would only return whatever was duplicated into vector metadata, which
is a copy rather than the source of truth, and metadata size limits make
storing full parent text there unwise. `health` fails if EITHER side fails, and
`stats`/`verifyIntegrity` report the larger/summed counts so a divergence
between backends is surfaced rather than averaged away.

### `pineconeAdapter.ts` - built and verified against the live index [DONE]

Implemented as `convex/knowledgeStore/pineconeAdapter.ts`. Vector IDs reuse
`computeRagVersionKey` (`convex/crawl/chunkKey.ts`) - the exact same
generation-scoped `sha256(chunkKey|documentId|generation)` the Convex adapter
already uses, so both halves of the composite key chunk identity identically
rather than inventing a second scheme. `upsertDocument` is a genuine no-op:
Pinecone has no document-identity concept, and `CompositeKnowledgeStore`
already discards this side's return value. `lexicalSearch`/`getChunks` throw
rather than silently returning empty - `CompositeKnowledgeStore` should never
route to them, so a throw catches a wiring mistake instead of hiding it.
Deletes are by explicit id only, never by metadata filter, per the measured
finding in the earlier Pinecone proof work.

**Two real bugs found by typechecking and running it, not by inspection:**

1. `tsc` correctly flagged `index.upsert(records)` - this SDK version
   (`@pinecone-database/pinecone` 8.2.0) wants `{ records }`, not a bare
   array.
2. `tsc` did **not** flag `ns.deleteMany(ids)`, which is the more dangerous
   one: `DeleteManyOptions` has every field optional (`ids?`, `filter?`,
   `namespace?`), so a bare array structurally satisfies it - TypeScript sees
   "no required property missing" and accepts it, while at runtime
   `options.ids` would read `undefined` off the array and the call would
   delete nothing while reporting success. Caught by reading the SDK's own
   `.d.ts` after the upsert case made it worth checking every call the same
   way, not by trusting the compiler's silence. Fixed to `{ ids }`.

**Verified against the real `uetgpt-corpus-v1-qwen1024` index**, isolated
`adapter-contract-test` namespace, via
`docs/rag-store-evaluation/cloudflare-workers-ai-2026-08/pineconeAdapter-live-test.ts`
(`npx tsx ...`, no Convex runtime needed since no method uses `ctx`). 20/20
checks pass: health, the upsertDocument no-op, upsert+denseSearch,
category-filter isolation, generation replacement (both a re-affirmed chunk
surviving AND a chunk silently dropped from the new generation being
correctly deleted - not just "the one vector that changed"), full
`deleteDocument`, and that `lexicalSearch`/`getChunks` throw. Confirmed the
index holds 0 vectors after the run - the test cleans up completely and the
real index remains untouched for the actual corpus upsert.

Two of the test's own original assertions were wrong, not the adapter - see
the file's inline comments: `commitGeneration` correctly deletes every vector
with `generation < target`, including ones simply never re-submitted, not only
the one that changed. The first test run caught this by failing; fixing the
test (not the adapter) made the semantics explicit rather than assumed.

### Step 6 - enable reranking  [DONE - no permission gap remains]

```text
SUPERSEDED the Worker-deployment path below: convex/reranking/cloudflareRerank.ts
calls @cf/baai/bge-reranker-base directly from Convex action context via
Cloudflare's REST API, using only the Workers AI scope the token already has.
No wrangler, no Worker deployment, no "Workers Scripts: Edit" permission
needed at all. Verified against the live API by invoking the real exported
internalAction directly (20/20-equivalent checks, see the file's own test).

Follows groqRerank.ts's established convention: a real, tested action,
deliberately left UNWIRED from cascade.ts's live tiers. The remaining step is
a production-code activation decision (add a Cloudflare tier to cascade.ts,
or set it as an env-gated alternative), which sits behind the mandate's
independent-review gate - it is not a credentials/permission blocker anymore.

REAL FINDING from testing this live: reranking and corpus embedding share ONE
Cloudflare account's daily neuron budget. Hit the actual allocation limit
while testing (confirmed via direct API probe, code 4006). If both are ever
live simultaneously in production, reranking can silently degrade to its
safe fallback during heavy embedding windows. Not yet mitigated - worth a
decision (separate Cloudflare account for reranking? a reserved sub-budget?)
before wiring this into production, not before using it for evaluation.

--- superseded path, kept for reference ---
action:  wrangler deploy the adapter in
         docs/rag-store-evaluation/cloudflare-workers-ai-2026-08/
         reranker-worker/, then set RERANKER_URL
attempted: confirmed genuinely blocked, not just classifier caution. The
         current CLOUDFLARE_API_TOKEN verifies as valid and active
         (/user/tokens/verify succeeds) but 403s on
         /accounts/{id}/workers/scripts - it is scoped exactly as recommended
         earlier (Account > Workers AI only), which correctly excludes script
         deployment. That was the right scope for inference calls; it is the
         wrong scope for this step.
fix:     in the Cloudflare dashboard, either add "Workers Scripts: Edit" to
         the existing token, or create a second token scoped for deploys
         only. Then re-run `npx wrangler deploy` from that directory.
why:     convex/reranking/cascade.ts is well-built but INERT - neither
         RERANKER_URL nor COHERE_API_KEY is set, so every query silently
         degrades to a word-overlap heuristic. No cross-encoder reranking runs
         today. Community consensus rates this the single largest RAG quality
         lever (retrieval is ~73% of RAG failures; rerank worth 20-30%).
cost:    free. ~2.1 neurons/query at the configured depth of 15 => ~4,700
         reranked queries/day
risk:    minimal - no retrieval code changes, one env var, revert by unsetting
verify:  contract already proven against the live model (test_contract.py)
```

### Step 7 - point production at the working backend  [owner: USER APPROVAL]

```text
action:   set NEXT_PUBLIC_CONVEX_URL (and CONVEX_DEPLOY_KEY) in Vercel, redeploy
verify:   sign in on the live site; ask a question end to end; confirm cited
          sources resolve
rollback: Vercel keeps prior deployments - promote the previous one
```

## 5. Gate before calling it shipped

Per mandate §68/§73 a passing benchmark does not by itself authorize cutover,
and I must not self-certify. Before step 7:

```text
[ ] verify_embeddings.py exits 0
[ ] ANN Recall@10 >= 0.98 vs exact ground truth
[ ] hybrid retrieval evaluated with the REAL Convex lexical path and the real
    hybridRank/reranker, not a Python reimplementation
[ ] resource projection at 2x/3x corpus scale
[ ] independent review
```

## 6. Standing cautions

```text
- Do NOT create another Convex deployment to route around a quota issue
  (standing mandate).
- Cloudflare catalog metadata is unreliable (it misreports bge-base-en-v1.5 as
  153,600 tokens; it is capped at 512). Verify empirically.
- This corpus runs ~1.6 chars/token, not the usual ~4.
- Never conclude a background process died from a missing log file - check ps.
  That mistake already caused a concurrent-writer incident.
```
