# Plan: verify the §59 concurrent-generation race invariant for $0, with no live crawl

**Status when written:** 2026-09-01. Written for a fresh AI agent with no memory of
the conversation that produced it - everything needed to execute is below or
cited by exact file/line. Do not re-derive facts already established here;
verify them (they were verified once, by reading the actual code, not
assumed) and proceed.

## 1. The problem, precisely

Mandate §59 requires proving: **a stale ("N") generation's write must never
become authoritative after a newer ("N+1") generation has already committed.**

This is NOT yet tested anywhere in this repo, for a specific, verified reason:

- `convex/knowledgeStore/lifecycleTest.ts` and the newer
  `convex/knowledgeStore/pineconeLifecycleTest.ts` both drive
  `KnowledgeStore.upsertChunks`/`commitGeneration` - a **synchronous** path
  (see `convex/knowledgeStore/convexAdapter.ts:79-100`, `rag.add(ctx, {...,
  chunks: [{text, embedding}]})` followed immediately by a direct
  `upsertChunkRow` mutation, no `onComplete`, no staleness check of any kind).
  This path structurally cannot race, so testing it (already done) proves
  nothing about §59.
- The REAL production write path
  (`convex/crawl/mutations.ts`'s `queueChunksForEmbedding` →
  `convex/crawl/actions.ts`'s `embedSingleChunk`, an `internalAction`) is
  **asynchronous**: each chunk's embedding is queued into `@convex-dev/rag`'s
  own workpool, and completion arrives LATER via a callback,
  `convex/crawl/mutations.ts:812`, `export const onRagEntryComplete =
  rag.defineOnComplete(...)`. This callback contains the actual §59 fencing
  logic, at `convex/crawl/mutations.ts:879-897`:
  ```
  const doc = await ctx.db.get(documentId);
  const currentGeneration = doc?.ingestionGeneration ?? 0;
  if (!doc || ingestionGeneration !== currentGeneration) {
    // stale path: delete this entry, do NOT commit, do NOT bump progress
    ...
    return;
  }
  ```
  This is the ONLY place in the codebase that can resurrect-or-correctly-
  reject a late-arriving stale generation. It has zero test coverage today.
  That is the actual gap. Everything below exists to close it.

**Why the two obvious approaches were rejected (do not retry them):**

1. *Run a real crawl and try to make it race.* Rejected: `embedSingleChunk`
   unconditionally calls into `@convex-dev/rag`'s embedding pipeline, which
   (per `convex/crawl/actions.ts:392-529`) is a real, metered external call
   for any invocation that does not supply a pre-computed embedding. Also
   rejected on principle even if it were free: a *real* timing race is
   flaky and non-reproducible - see §2 below for why that is the wrong tool
   even when cost is not the constraint.
2. *Test `pineconeAdapter.ts` directly with an out-of-order call sequence.*
   Already attempted and deliberately abandoned (see
   `docs/rag-store-evaluation/INDEPENDENT_REVIEW.md`, §2's `Pinecone
   concurrent-generation torture test (§59)` row, and the 2026-09-01 §3
   addendum). Reading `pineconeAdapter.ts`'s own module header confirms it
   has NO generation fencing by design - a test against it in isolation
   would just reproduce a known, documented adapter property and report it
   as a "failure," which is not a real finding.

## 2. The correct approach: deterministic, controlled ordering - not a real race

Industry practice for testing race conditions is to **not** rely on real
timing at all. Real concurrent races are flaky, expensive, and irreproducible.
The established alternative - used by tools ranging from `frontrun` (Python)
to TigerBeetle's own "deterministic simulation testing" - is to **directly
control the order in which operations execute** and assert the invariant
holds for that exact, chosen ordering. If the ordering is the adversarial one
("N+1 commits, then N's stale completion arrives"), and the invariant holds,
you have proven the same thing a real race would have demonstrated, without
depending on timing luck at all - and the test is 100% reproducible on every
run.

Sources (fetched 2026-09-01, cited per this project's own web-search
citation requirement):
- [Making race condition tests deterministic with Concurrent::CyclicBarrier and seam](https://blog.arkency.com/making-race-condition-tests-deterministic-with-cyclicbarrier-and-seam) - the "hold until a specific state, then release in a controlled order" pattern.
- [GitHub - lucaswiman/frontrun](https://github.com/lucaswiman/frontrun) - "a controlled scheduler... when an interleaving breaks your invariant, provide a deterministic, replayable counterexample."
- [Protocol-Aware Deterministic Simulation Testing (TigerBeetle)](https://tigerbeetle.com/blog/2026-08-20-protocol-aware-dst/) - the production-grade version of the same idea: replace real time/network with a controllable simulation so the same interleaving replays identically every run.

**This project already has the right tool for exactly this, and already
endorses it as the standard way to test Convex functions** -
`convex/_generated/ai/guidelines.md:401-424` ("Testing guidelines"):
> Use `convex-test` with `vitest` and `@edge-runtime/vm` to test Convex
> functions... Configure vitest with `environment: "edge-runtime"`.

`convex-test` runs the entire Convex function graph in-memory, in a single
process, with **explicit, on-demand control over when scheduled/async work
runs** - `t.finishInProgressScheduledFunctions` / `t.finishAllScheduledFunctions`
combined with `vi.useFakeTimers()`. It also supports registering and testing
Convex **components** (which `@convex-dev/rag` is) - confirmed 2026-09-01 via
[convex-test docs](https://docs.convex.dev/testing/convex-test) and the
[convex-test scheduler test source](https://github.com/get-convex/convex-test/blob/main/convex/scheduler.test.ts).
This means the exact adversarial ordering §59 needs - "start N's embed, do
NOT let its completion run yet, advance the document to N+1, THEN let N's
completion run" - is directly and deterministically expressible, with zero
network calls, zero external services, and a full re-run every time in a
few hundred milliseconds. This is a stronger, cheaper, more repeatable proof
than a real crawl race would ever be, not a compromise forced by the
budget constraint.

## 3. Zero-cost embedding: how to avoid Gemini entirely

`@convex-dev/rag`'s `add()` supports a caller-supplied embedding instead of
computing one from raw text - already proven safe and in production test use
in this exact repo:
```ts
// convex/knowledgeStore/convexAdapter.ts:79-87
const added = await rag.add(ctx, {
  namespace: NAMESPACE,
  key: ragVersionKey,
  filterValues: [...],
  chunks: [{ text: chunk.text, embedding: Array.from(chunk.embedding) }],
});
```
versus the REAL production call in `convex/crawl/actions.ts:498-529`, which
omits `chunks:` and passes a bare `text:` field (letting the component embed
internally - the real, metered call site), but DOES pass `metadata` and
`onComplete`, which `convexAdapter.ts`'s call does not.

**First verification step for the agent, before writing any test:** confirm
`chunks: [{text, embedding}]` can be combined with `metadata` + `onComplete`
in a single `rag.add()` call. Check the installed package's own type
definitions directly - do not assume:
```
find node_modules/@convex-dev/rag -iname "*.d.ts" | xargs grep -n "onComplete\|metadata\|chunks" 
```
If combining them is supported (expected, since they are independent
optional fields on the same args object, but VERIFY, do not assume), use:
```ts
await rag.add(ctx, {
  namespaceId: <the real namespaceId, see rag/instance.ts and
               actions.ts:499 for how it's obtained/typed>,
  key: ragVersionKey,               // computeRagVersionKey(baseChunkKey, documentId, generation)
  chunks: [{ text: "synthetic chunk text", embedding: syntheticVector }],
  filterValues: [
    { name: "category", value: "crawled" },
    { name: "source", value: "test" },
  ],
  metadata: {
    documentId, baseChunkKey, ingestionGeneration,
    parentId: "", headingPath: [], createdAtMs: Date.now(),
  },
  onComplete: internal.crawl.mutations.onRagEntryComplete,
});
```
This calls the REAL `onRagEntryComplete` fencing logic through the REAL
component machinery, with a synthetic vector - zero embedding-model calls,
by construction (the component only computes an embedding itself when no
`chunks[].embedding` is supplied).

**If combining them is NOT supported** (a real possibility - do not force
it): fall back to unit-testing `onRagEntryComplete` directly, bypassing
`rag.add()` entirely. Hand-construct the `args: {entry, replacedEntry,
error}` shape it expects (see `convex/crawl/mutations.ts:812-813` for the
exact destructured shape) with a fabricated `entry.metadata` object matching
what `embedSingleChunk` would have attached. This is weaker (it tests the
fencing function directly rather than through the component's real
add-then-complete cycle) but is still zero-cost, deterministic, and directly
exercises the exact code at risk. If you use this fallback, say so explicitly
in the writeup - do not present it as equivalent to the full-pipeline test.

## 4. The test itself - step by step

1. **Confirm/install tooling.** Check `package.json` for `convex-test` and
   `@edge-runtime/vm` - as of 2026-09-01 neither is present (`vitest` is,
   `^4.1.7`). Install both at their latest versions:
   ```
   npm install -D convex-test @edge-runtime/vm
   ```
   Do NOT change `vitest.config.ts`'s top-level `environment: "node"` -
   the rest of this repo's tests (frontend, DOM) depend on it, and the
   guidelines file's `environment: "edge-runtime"` instruction is scoped to
   Convex function tests specifically. Scope the edge-runtime environment to
   ONLY the new test file, either via a per-file pragma comment
   (`// @vitest-environment edge-runtime` as the first line of the new test
   file) or `test.environmentMatchGlob` in `vitest.config.ts` scoped to
   `convex/**/*.test.ts` - check current `convex-test` docs for which vitest
   version supports which mechanism, since `vitest` here is pinned to
   `^4.1.7`. Verify the REST of the test suite (`npx vitest run`) still
   passes after this change, before writing the new test - a regression
   here would be a new, self-inflicted problem, not progress on §59.

2. **New test file:**
   `convex/crawl/mutations.generationRace.test.ts`, co-located with the
   source it tests. There is no existing precedent to match either way -
   `find convex -iname "*.test.ts"` returns nothing, and
   `vitest.config.ts` only excludes `tests/e2e/**` - this will be the first
   Convex-function test in the repo. Do not go looking for a convention
   that doesn't exist.

3. **Register `@convex-dev/rag` as a component** with `convexTest()` per
   current convex-test component-testing docs (fetch
   https://docs.convex.dev/testing/convex-test at execution time - do not
   trust this plan's paraphrase of an evolving library's exact API surface).

4. **Build the scenario, in this exact order** (this ordering IS the test -
   do not "randomize" or add real `setTimeout`/`sleep` anywhere):
   a. Insert a synthetic `documents` row directly via `t.run(async (ctx) =>
      ctx.db.insert("documents", {...minimal required fields per
      `convex/schema.ts`'s `documents` table, ingestionGeneration: 1, ...}))`
      - bypassing `queueChunksForEmbedding` entirely (that mutation's own
      side effects are not what's under test here, and pulling it in only
      adds surface area).
   b. Call `rag.add(...)` (via a small test-only `internalMutation` or
      `internalAction` you add for this purpose, OR by calling the
      component's client directly inside `t.run`/`t.action` - check which is
      possible for a component-registered client in `convex-test`) for
      **generation 1**, with a synthetic embedding, real metadata
      (`ingestionGeneration: 1`), and `onComplete:
      internal.crawl.mutations.onRagEntryComplete`. Also call
      `stagePendingChunkText` (already an exported `internalMutation`,
      `convex/crawl/mutations.ts:579`) for this `ragVersionKey`, matching
      what `embedSingleChunk` does before calling `rag.add` - required for
      `onRagEntryComplete`'s current-generation commit path to have
      something to commit, even though this specific scenario expects the
      STALE path to fire instead (line 897's early return happens before
      the staged-text check, so this step is about matching the real
      sequence precisely, not a strict dependency for THIS scenario to be
      meaningful).
   c. **Do NOT call `t.finishInProgressScheduledFunctions` yet.** This is the
      crux of the deterministic ordering: the component has scheduled
      generation-1's completion callback but you are choosing not to let it
      run.
   d. Directly patch the SAME document to simulate "a newer crawl round
      started and is now current" - exactly what a real second
      `queueChunksForEmbedding` call does
      (`convex/crawl/mutations.ts:476-528`), without needing to actually run
      that mutation or embed anything for round 2 yet. **Before writing
      this patch, read `queueChunksForEmbedding` (lines 476-535) and
      `bumpDocumentProgress` (lines 549-577) in full and enumerate every
      `documents` field either the stale path (line 879-897) or the
      positive-control commit path (§4g, which flows through
      `bumpDocumentProgress`) actually reads.** At minimum this is
      `ingestionGeneration`, but `bumpDocumentProgress` also reads
      `doc.chunkCount` and `doc.chunksEmbedded` to decide whether to
      transition `status` to `"indexed"` - if the positive control in §4g
      is going to exercise that transition, the document needs
      `chunkCount`/`chunksEmbedded`/`status` set to values consistent with
      a real round-2 crawl of one chunk (i.e. `chunkCount: 1,
      chunksEmbedded: 0, status: "processing"` before gen 2's completion,
      matching what `queueChunksForEmbedding`'s own patch at line 524-528
      would have written), not left over from generation 1 or merely
      absent. A bare `ctx.db.patch(documentId, {ingestionGeneration: 2})`
      that ignores this will produce a document state no real crawl ever
      reaches - if §4g's positive control then passes or fails, it may be
      for reasons unrelated to generation fencing at all. Get this right
      before trusting any assertion below it.
   e. NOW let generation 1's scheduled completion run: `vi.useFakeTimers()`
      + `await t.finishInProgressScheduledFunctions()` (or
      `finishAllScheduledFunctions` if the component schedules recursively -
      check which applies).
   f. **Assert the invariant**, each independently. Check `crawledChunks`
      only, not Pinecone: the §61 lifecycle work already established that
      `pineconeAdapter.denseSearch` returns bare `(documentId, chunkKey,
      score)` pointers with empty text, and the actual content - what a
      reader would call "authoritative" - is resolved through Convex's
      `crawledChunks` rows. §59's invariant is about authority, and
      authority lives in Convex, not the vector store; do not spend any of
      this plan's writes re-checking Pinecone, and do not treat "should I
      also check Pinecone" as an open question - it was already answered
      before this plan was written.
      - No `crawledChunks` row exists for `(documentId, baseChunkKey)` with
        `ingestionGeneration === 1` (query `crawledChunks` directly via
        `t.run`).
      - The document's `ingestionGeneration` is STILL `2` (was not reverted
        or corrupted by the stale completion).
      - The generation-1 RAG entry was deleted, not left retrievable
        (`rag.getEntry` for its `entryId` returns null/gone - the stale path
        at `mutations.ts:891-895` calls `rag.deleteAsync`, so this may need
        its own `finishInProgressScheduledFunctions` pass if that delete is
        itself scheduled - verify, don't assume it's synchronous).
      - `pendingChunkText` for this `ragVersionKey` was cleaned up
        (`deletePendingChunkTextImpl` at `mutations.ts:896`).
   g. **Positive control - do not skip this.** A test that only checks "the
      stale write didn't win" could pass vacuously if the whole mechanism is
      silently broken (e.g. if `onComplete` never fires at all in this
      harness). Follow up by actually completing round 2 for real in the
      same test: call `rag.add` for generation 2 with `ingestionGeneration:
      2`, stage its text, let ITS completion run, and assert it DOES commit
      normally (a real `crawledChunks` row appears with
      `ingestionGeneration === 2`, document status/progress updates as
      expected). If this positive control doesn't pass, the negative result
      above is not trustworthy - fix the harness, not the assertions.

5. **Run:** `npx vitest run convex/crawl/mutations.generationRace.test.ts`.
   Confirm it is deterministic - run it 3 times in a row, same result every
   time (no `sleep`, no real timers, no network - it should be automatic,
   but verify rather than assume, per this project's own evidence
   discipline).

## 5. Resource-safety checklist (verify all of these before calling it done)

```text
Gemini calls:            0 (synthetic embeddings only, verified per §3)
Pinecone calls:          0 (this test never touches pineconeAdapter.ts)
Convex Cloud calls:      0 (convex-test is fully in-memory, no deployment
                          of any kind involved - not even the local
                          self-hosted Docker backend used for the §58/§61
                          work)
Live crawl:               0 (no `queueChunksForEmbedding` call, no webhook)
rugged-bird-156 / any
  Convex Cloud deployment: untouched, not applicable
Money spent:              $0
```

## 6. What to update afterward

Regardless of outcome (pass or a real, reproducible failure), update
`docs/rag-store-evaluation/INDEPENDENT_REVIEW.md`:

- §2's gates table: change the `Pinecone concurrent-generation torture test
  (§59)` row from `INFERENCE ONLY, NOT TESTED` to a real `PASS`/`FAIL` with
  the exact assertions from step 4f/4g as evidence, and note explicitly that
  this exercises `onRagEntryComplete` (the mutation-layer fencing), not
  `pineconeAdapter.ts` directly - name the file and the deterministic
  ordering used, per this project's `EXECUTED`/`MEASURED` vs `INFERENCE`
  classification discipline (§71 in the mandate, already followed
  throughout this document).
- If this passes, `§58`'s scenario 4 ("stale older generation finishes
  late") also closes - update that row from "the same gap" to closed, and
  update `§63/§64/§65`'s "final Pinecone gate declaration" row to reflect
  that the one remaining hard gap is gone (re-verify what else, if anything,
  §63's 9-gate checklist still needs before declaring PASS/FAIL - do not
  assume this was the only remaining item without re-reading §2 in full).
- If it FAILS (a real invariant violation is found), do NOT soften it or
  bury it in a footnote - that would be exactly the failure mode this
  document's own corrections (the retracted lexical-rescue claim, the
  "comfortable headroom" walk-back) have been about avoiding. A real §59
  failure is a genuine production-blocking finding and should be reported
  as one, with the exact reproduction steps preserved (this is precisely
  why deterministic/no-sleep is required in step 4 - a real finding here
  must be re-runnable by a reviewer, not a one-time fluke).
- If `convex-test` turns out unable to cleanly test the `@convex-dev/rag`
  component (a real possibility flagged in §3's fallback), and the fallback
  (directly unit-testing `onRagEntryComplete` with hand-built args) was used
  instead, say so explicitly in the gates table - do not let it read as the
  full-pipeline test if it wasn't.

## 7. What the agent should do next (short version)

1. `npm install -D convex-test @edge-runtime/vm`.
2. Verify `@convex-dev/rag`'s `add()` accepts `chunks:[{text,embedding}]` +
   `metadata` + `onComplete` together (read the installed `.d.ts`, don't
   assume) - if not, use the direct-unit-test fallback in §3 instead.
3. Write `convex/crawl/mutations.generationRace.test.ts` per §4: build doc
   at gen 1 → start gen-1's `rag.add` (synthetic embedding, real
   `onComplete`) → **before** letting it complete, bump the document to
   gen 2 → let gen-1's completion run → assert it was correctly rejected as
   stale (§4f) → run a real gen-2 completion as a positive control (§4g).
4. Run it 3x, confirm deterministic pass. Zero Gemini/Pinecone/Convex Cloud
   calls throughout - verify against §5's checklist explicitly, don't just
   assume it because no code path "should" call them.
5. Update `INDEPENDENT_REVIEW.md` per §6, honestly, including if it fails.
6. Report back: what ran, what passed/failed, and the exact commands used
   to reproduce it.
