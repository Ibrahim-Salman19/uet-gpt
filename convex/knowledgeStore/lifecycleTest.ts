import type { EntryId } from "@convex-dev/rag";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalQuery, type ActionCtx } from "../_generated/server";
import { EMBEDDING_DIMENSION } from "../embeddings/dimension";
import { rag } from "../rag/instance";
import { convexKnowledgeStore } from "./convexAdapter";

// Executed regression test for the cross-generation RAG-entry orphan-leak fix
// (convexMutations.ts's upsertChunkRow + convexAdapter.ts's upsertChunks —
// see the fix's rationale comments there). Exercises the real, deployed
// KnowledgeStore Convex adapter end-to-end against this dev deployment,
// including the actual @convex-dev/rag component (not mockable locally -
// there is no local/offline Convex backend in this project's test setup).
//
// Self-contained and self-cleaning: generates its own uniquely-namespaced
// test document under a reserved-invalid TLD (RFC 2606 ".invalid" - cannot
// collide with a real crawlable UET domain) and deletes it before returning,
// regardless of pass/fail. Takes no arguments, so it cannot be pointed at
// real UET documents even by a careless or malicious caller.
//
// internalAction, not action: taking no arguments and only ever touching its
// own disposable test document is not the same as being safe to leave
// publicly callable. A public action is reachable by anyone with the
// deployment URL, no auth required, and would still let an anonymous caller
// spam real writes/deletes against this deployment for free. internalAction
// removes it from the public client API entirely - Convex enforces this
// server-side, it is never exposed to ConvexHttpClient/api.*, only reachable
// via other Convex functions or `npx convex run` (CLI, deploy-key-authenticated,
// not the public API - see docs.convex.dev/cli/reference/run). Invoke with:
//   npx convex run knowledgeStore/lifecycleTest:runCrossGenerationLifecycleTest '{}'

const TEST_URL_PREFIX = "https://knowledgestore-lifecycle-test.invalid/";

/** Test-only escape hatch into crawledChunks' ragId - deliberately not part
 * of convexQueries.ts, whose queries back the real adapter and intentionally
 * never expose ragId past the KnowledgeStore boundary (see types.ts). */
export const _getRawChunkRagId = internalQuery({
  args: { documentId: v.string(), chunkKey: v.string() },
  returns: v.union(v.object({ ragId: v.string(), ingestionGeneration: v.number() }), v.null()),
  handler: async (ctx, args) => {
    const chunk = await ctx.db
      .query("crawledChunks")
      .withIndex("by_documentId_and_chunkKey", (q) =>
        q.eq("documentId", args.documentId as Id<"documents">).eq("chunkKey", args.chunkKey),
      )
      .first();
    if (!chunk) return null;
    return { ragId: chunk.ragId, ingestionGeneration: chunk.ingestionGeneration ?? 0 };
  },
});

type StepResult = { name: string; ok: boolean; detail: string };

function embeddingFor(n: number): Float32Array {
  // Must match EMBEDDING_DIMENSION (embeddings/dimension.ts) - unlike the
  // local contract suite's toy 8-dim vectors, the real @convex-dev/rag
  // component validates embeddings against its configured model's actual
  // dimension and rejects anything else (validateVectorDimension).
  const vec = new Float32Array(EMBEDDING_DIMENSION);
  vec[n % EMBEDDING_DIMENSION] = 1;
  return vec;
}

async function waitForEntryGone(
  ctx: ActionCtx,
  entryId: string,
  maxAttempts: number,
): Promise<{ gone: boolean; attempts: number }> {
  for (let i = 0; i < maxAttempts; i++) {
    const entry = await rag.getEntry(ctx, { entryId: entryId as unknown as EntryId });
    if (!entry) return { gone: true, attempts: i + 1 };
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return { gone: false, attempts: maxAttempts };
}

export const runCrossGenerationLifecycleTest = internalAction({
  args: {},
  returns: v.object({
    ok: v.boolean(),
    steps: v.array(v.object({ name: v.string(), ok: v.boolean(), detail: v.string() })),
  }),
  handler: async (ctx) => {
    const steps: StepResult[] = [];
    const runId = crypto.randomUUID();
    const canonicalUrl = `${TEST_URL_PREFIX}${runId}`;
    const chunkKey = `lifecycle-test-chunk-${runId}`;
    const historicalRagIds: string[] = [];
    let documentId: string | undefined;

    function record(name: string, ok: boolean, detail: string) {
      steps.push({ name, ok, detail });
    }

    try {
      // Generations 1-3: distinct content each round through the SAME
      // baseChunkKey (position-stable, content-changing - the exact shape
      // that leaked before the fix).
      for (let gen = 1; gen <= 3; gen++) {
        const doc = await convexKnowledgeStore.upsertDocument(ctx, {
          canonicalUrl,
          title: `Lifecycle Test`,
          contentHash: `hash-gen-${gen}`,
          indexingFingerprint: "fp-lifecycle-test",
          category: "test",
        });
        documentId = doc.documentId;
        await convexKnowledgeStore.upsertChunks(ctx, doc.documentId, doc.generation, "test", [
          {
            chunkKey,
            ordinalWithinHeading: 0,
            headingPath: ["Test"],
            text: `content for generation ${gen}`,
            embedding: embeddingFor(gen),
          },
        ]);
        await convexKnowledgeStore.commitGeneration(ctx, doc.documentId, doc.generation);

        const raw = await ctx.runQuery(internal.knowledgeStore.lifecycleTest._getRawChunkRagId, {
          documentId: doc.documentId,
          chunkKey,
        });
        record(
          `gen${gen}: commit`,
          raw !== null && raw.ingestionGeneration === doc.generation,
          `documentId=${doc.documentId} generation=${doc.generation} ragId=${raw?.ragId} rowGeneration=${raw?.ingestionGeneration}`,
        );
        if (raw) historicalRagIds.push(raw.ragId);
      }

      // Identical replay: re-submitting generation 3's exact content must
      // hit the fast path and must NOT advance the generation or touch RAG.
      if (documentId) {
        const replay = await convexKnowledgeStore.upsertDocument(ctx, {
          canonicalUrl,
          title: `Lifecycle Test`,
          contentHash: `hash-gen-3`,
          indexingFingerprint: "fp-lifecycle-test",
          category: "test",
        });
        record(
          "replay: identical content hits fast path",
          replay.fastPathEligible === true && replay.generation === 3,
          `fastPathEligible=${replay.fastPathEligible} generation=${replay.generation}`,
        );
      }

      // Generations 4-5: continue advancing past the replay.
      for (let gen = 4; gen <= 5; gen++) {
        const doc = await convexKnowledgeStore.upsertDocument(ctx, {
          canonicalUrl,
          title: `Lifecycle Test`,
          contentHash: `hash-gen-${gen}`,
          indexingFingerprint: "fp-lifecycle-test",
          category: "test",
        });
        documentId = doc.documentId;
        await convexKnowledgeStore.upsertChunks(ctx, doc.documentId, doc.generation, "test", [
          {
            chunkKey,
            ordinalWithinHeading: 0,
            headingPath: ["Test"],
            text: `content for generation ${gen}`,
            embedding: embeddingFor(gen),
          },
        ]);
        await convexKnowledgeStore.commitGeneration(ctx, doc.documentId, doc.generation);

        const raw = await ctx.runQuery(internal.knowledgeStore.lifecycleTest._getRawChunkRagId, {
          documentId: doc.documentId,
          chunkKey,
        });
        record(
          `gen${gen}: commit`,
          raw !== null && raw.ingestionGeneration === doc.generation,
          `documentId=${doc.documentId} generation=${doc.generation} ragId=${raw?.ragId} rowGeneration=${raw?.ingestionGeneration}`,
        );
        if (raw) historicalRagIds.push(raw.ragId);
      }

      // The core assertion: every superseded (non-final) generation's RAG
      // entry must eventually be retired (rag.deleteAsync is workpool-based,
      // not instant - poll with a bounded wait rather than assuming either
      // "already done" or "never done").
      const finalRagId = historicalRagIds[historicalRagIds.length - 1];
      const supersededRagIds = historicalRagIds.slice(0, -1);
      const uniqueSuperseded = [...new Set(supersededRagIds)];
      let allRetired = true;
      for (const oldRagId of uniqueSuperseded) {
        const { gone, attempts } = await waitForEntryGone(ctx, oldRagId, 30);
        if (!gone) allRetired = false;
        record(
          `retirement: superseded ragId ${oldRagId.slice(0, 8)}... is gone`,
          gone,
          `checked after ${attempts} attempt(s) (~${attempts}s)`,
        );
      }
      record(
        "no unbounded growth: distinct ragIds across 5 generations == 5, only the last survives",
        uniqueSuperseded.length === 4 && allRetired,
        `distinctRagIds=${new Set(historicalRagIds).size} superseded=${uniqueSuperseded.length} allRetired=${allRetired}`,
      );

      // The final (still-current) generation's entry must still be alive
      // right up until cleanup - proves retirement only ever targets
      // superseded entries, never the current one.
      const finalEntry = finalRagId ? await rag.getEntry(ctx, { entryId: finalRagId as unknown as EntryId }) : null;
      record(
        "final generation's RAG entry is still alive pre-cleanup",
        finalEntry !== null,
        `entryId=${finalRagId} status=${finalEntry?.status ?? "MISSING"}`,
      );
    } catch (err) {
      const data = (err as { data?: unknown } | undefined)?.data;
      const detail =
        err instanceof Error
          ? `name=${err.name} message=${err.message}${data !== undefined ? ` data=${JSON.stringify(data)}` : ""}\n${err.stack ?? ""}`
          : String(err);
      record("unexpected exception", false, detail);
    } finally {
      // Cleanup: always attempt, regardless of pass/fail above. deleteDocument
      // uses synchronous rag.delete (see commitGeneration's doc comment in
      // types.ts for why), so the final generation's entry should be gone
      // immediately after this call returns, no polling needed.
      if (documentId) {
        try {
          const del = await convexKnowledgeStore.deleteDocument(ctx, documentId);
          const finalRagId = historicalRagIds[historicalRagIds.length - 1];
          const stillThere = finalRagId ? await rag.getEntry(ctx, { entryId: finalRagId as unknown as EntryId }) : null;
          record(
            "cleanup: deleteDocument removes the final generation's entry synchronously",
            del.deletedChunks >= 1 && stillThere === null,
            `deletedChunks=${del.deletedChunks} finalEntryStillPresent=${stillThere !== null}`,
          );
        } catch (err) {
          record("cleanup: deleteDocument", false, err instanceof Error ? err.message : String(err));
        }
      }
    }

    return { ok: steps.every((s) => s.ok), steps };
  },
});
