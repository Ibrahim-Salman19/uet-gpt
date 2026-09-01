"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { createPineconeKnowledgeStore } from "./pineconeAdapter";

// Mandate §58/§61 lifecycle coverage for pineconeAdapter.ts, run against the
// LIVE uetgpt-corpus-v1-qwen1024 index in the same isolated namespace
// docs/rag-store-evaluation/cloudflare-workers-ai-2026-08/pineconeAdapter-live-test.ts
// already used and cleaned - never the real corpus-v1-full namespace.
//
// pineconeAdapter-live-test.ts already covers §58 scenario 1 (initial
// ingest) and part of scenario 3 (generation replacement). This file adds
// scenario 2 (same-generation idempotent retry), scenario 5 (a round left
// uncommitted, standing in for partial failure without inducing a real
// one), and scenario 7 (re-add after deletion), plus an explicit physical
// (not just query-filtered) verification step for §61.
//
// §59 (the N/N+1 concurrent-generation torture test) is deliberately NOT
// exercised here. Reading convex/crawl/mutations.ts (the generation-fencing
// around ~line 669, comparing a call's generation against
// doc.ingestionGeneration) shows that invariant is enforced by the
// application mutation layer before it ever calls into a KnowledgeStore,
// not by the storage adapters themselves - pineconeAdapter.upsertChunks has
// no fencing by design (see its module header) and will happily "resurrect"
// a stale generation's vectors if called out of order. Simulating that
// directly against this adapter would reproduce a known, by-design adapter
// property, not test the real system invariant, which lives one layer up
// and would require exercising the mutation layer (which unconditionally
// calls Gemini for embedding - out of scope for this local/no-LLM-calls
// proof). This is recorded as an INFERENCE finding in the evidence doc, not
// claimed as tested here.
//
// internalAction (not action, unlike lexicalProof.ts's HTTP-driven
// endpoints): this test takes no arguments and returns a small JSON object,
// comfortably under the CLI arg-size ceiling found during Phase 5 - no need
// for the /api/action HTTP workaround. Invoke with:
//   npx convex run knowledgeStore/pineconeLifecycleTest:run '{}' --url http://127.0.0.1:3210 --admin-key <key>

const INDEX = "uetgpt-corpus-v1-qwen1024";
const NAMESPACE = "adapter-contract-test"; // isolated - never mixed with real corpus data
const DIM = 1024;

function vec(seed: number): Float32Array {
  const v2 = new Float32Array(DIM);
  v2[seed % DIM] = 1;
  return v2;
}

type StepResult = { name: string; ok: boolean; detail: string };

async function pollUntil(fn: () => Promise<boolean>, attempts: number, intervalMs: number): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

export const run = internalAction({
  args: {},
  returns: v.object({ ok: v.boolean(), steps: v.array(v.object({ name: v.string(), ok: v.boolean(), detail: v.string() })) }),
  handler: async (ctx) => {
    const store = createPineconeKnowledgeStore(INDEX, NAMESPACE);
    const steps: StepResult[] = [];
    const runId = crypto.randomUUID().slice(0, 8);
    const docId = `lifecycle2-test-doc-${runId}`;

    function record(name: string, ok: boolean, detail: unknown) {
      steps.push({ name, ok, detail: typeof detail === "string" ? detail : JSON.stringify(detail) });
    }

    async function found(seed: number): Promise<boolean> {
      const res = await store.denseSearch(ctx, vec(seed), { topK: 10 });
      return res.some((r) => r.documentId === docId && r.score > 0.99);
    }

    try {
      // cleanup any residue from a prior failed run under this exact docId
      // (fresh runId per invocation makes this normally a no-op)
      await store.deleteDocument(ctx, docId);

      // ── Scenario 2: same-generation idempotent retry ──────────────────
      const chunksGen1 = [
        { chunkKey: "c1", ordinalWithinHeading: 0, headingPath: ["A"], text: "t1", embedding: vec(1) },
        { chunkKey: "c2", ordinalWithinHeading: 1, headingPath: ["B"], text: "t2", embedding: vec(2) },
      ];
      await store.upsertChunks(ctx, docId, 1, "crawled", chunksGen1);
      // retry: identical generation, identical chunks (e.g. a retried batch after a timeout)
      await store.upsertChunks(ctx, docId, 1, "crawled", chunksGen1);

      const c1Visible = await pollUntil(() => found(1), 20, 500);
      const c2Visible = await pollUntil(() => found(2), 20, 500);
      record("scenario2: both gen-1 chunks visible after a duplicate retry", c1Visible && c2Visible, { c1Visible, c2Visible });

      const statsAfterRetry = await store.stats(ctx);
      const commit1 = await store.commitGeneration(ctx, docId, 1);
      record(
        "scenario2: commitGeneration(gen=1) finds 0 stale - the retry overwrote by deterministic id, it did not duplicate",
        commit1.deletedStaleChunks === 0,
        { commit1, statsAfterRetryChunkCount: statsAfterRetry.chunkCount },
      );

      // ── Scenario 5: a round left uncommitted (partial-failure stand-in) ─
      // c1 changes content at gen 2, c2 is NOT re-upserted (simulates a
      // chunk dropped from the page, or a round that only got partway
      // through before failing).
      await store.upsertChunks(ctx, docId, 2, "crawled", [
        { chunkKey: "c1", ordinalWithinHeading: 0, headingPath: ["A"], text: "t1v2", embedding: vec(3) },
      ]);

      // BEFORE commit: gen-1 vectors must still be live (upsertChunks never
      // deletes) - this is the exact state a crash mid-round would leave.
      const gen1StillLiveC1 = await found(1);
      const gen1StillLiveC2 = await found(2);
      const gen2AlreadyLive = await pollUntil(() => found(3), 20, 500);
      record(
        "scenario5: uncommitted gen-2 write coexists with gen-1 (no premature deletion)",
        gen1StillLiveC1 && gen1StillLiveC2 && gen2AlreadyLive,
        { gen1StillLiveC1, gen1StillLiveC2, gen2AlreadyLive },
      );

      const statsBeforeCommit2 = await store.stats(ctx);
      const commit2 = await store.commitGeneration(ctx, docId, 2);
      record(
        "scenario5: commit converges - both gen-1 vectors (c1 AND untouched c2) reported deleted",
        commit2.deletedStaleChunks === 2,
        commit2,
      );

      // §61 physical (not just query-filtered) verification: deleteMatching
      // already polls its own query to convergence internally and throws if
      // it times out (see pineconeAdapter.ts), so a returned commit2 already
      // means physical convergence - cross-check independently here via two
      // different signals: denseSearch absence AND a stats() record-count
      // drop, not trusting either alone.
      const gen1GoneC1 = !(await found(1));
      const gen1GoneC2 = !(await found(2));
      const gen2Present = await found(3);
      record(
        "scenario5/§61: stale gen-1 vectors are PHYSICALLY gone post-commit (denseSearch no longer finds them)",
        gen1GoneC1 && gen1GoneC2 && gen2Present,
        { gen1GoneC1, gen1GoneC2, gen2Present },
      );
      const statsAfterCommit2 = await store.stats(ctx);
      record(
        "scenario5/§61: stats() record count dropped by exactly the deleted amount (2), independent of denseSearch",
        statsAfterCommit2.chunkCount === statsBeforeCommit2.chunkCount - 2,
        { statsBeforeCommit2: statsBeforeCommit2.chunkCount, statsAfterCommit2: statsAfterCommit2.chunkCount },
      );

      // ── Scenario 7: re-add after deletion ──────────────────────────────
      const del = await store.deleteDocument(ctx, docId);
      record("scenario7: deleteDocument removes the current generation's remaining vector (c1@gen2)", del.deletedChunks === 1, del);

      const goneAfterDelete = await pollUntil(async () => !(await found(3)), 20, 500);
      record("scenario7: fully gone immediately after deleteDocument", goneAfterDelete, { goneAfterDelete });

      // Re-add under the SAME documentId at a fresh generation 1 - the
      // shape of a page being deleted then later re-crawled.
      await store.upsertChunks(ctx, docId, 1, "crawled", [
        { chunkKey: "c1", ordinalWithinHeading: 0, headingPath: ["A"], text: "t1-readded", embedding: vec(5) },
      ]);
      await store.commitGeneration(ctx, docId, 1);

      const readdedVisible = await pollUntil(() => found(5), 20, 500);
      const noGhostFromOldGen2 = !(await found(3)); // old gen-2 content (vec 3) must not reappear
      record(
        "scenario7: re-add after deletion is clean - new content visible, no ghost vectors from the prior lifecycle",
        readdedVisible && noGhostFromOldGen2,
        { readdedVisible, noGhostFromOldGen2 },
      );
    } catch (err) {
      const detail = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ""}` : String(err);
      record("unexpected exception", false, detail);
    } finally {
      try {
        const finalDel = await store.deleteDocument(ctx, docId);
        const cleanupConfirmed = await pollUntil(async () => !(await found(5)), 20, 500);
        record("cleanup: no residue left for this run's docId", cleanupConfirmed, { finalDel, cleanupConfirmed });
      } catch (err) {
        record("cleanup: deleteDocument", false, err instanceof Error ? err.message : String(err));
      }
    }

    return { ok: steps.every((s) => s.ok), steps };
  },
});
