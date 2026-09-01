// @vitest-environment edge-runtime
/// <reference types="vite/client" />
//
// Deterministic, controlled-ordering proof of Mandate §59: a stale ("N")
// generation's RAG-entry completion must never become authoritative after a
// newer ("N+1") generation has already committed. See
// docs/rag-store-evaluation/concurrent-generation-race-test-2026-09/PLAN.md
// for the full rationale and why a real timing race was rejected in favor of
// this approach.
//
// This exercises the REAL onRagEntryComplete fencing logic
// (convex/crawl/mutations.ts:812-935) through the REAL @convex-dev/rag
// component's add()->promoteToReady->onComplete chain, registered in-memory
// via convex-test. It never calls the real embedding model: every chunk
// supplies its own synthetic embedding vector, which
// createChunkArgsBatch (node_modules/@convex-dev/rag/dist/client/index.js)
// filters out of the "missing embeddings" batch before it would ever call
// embedMany/doEmbed - source-verified, not assumed.
//
// Ordering note: reading node_modules/@convex-dev/rag/dist/component/entries.js
// (promoteToReadyHandler) shows that for a single-call add() with all chunks
// supplied up front, onComplete fires SYNCHRONOUSLY inside the same add()
// mutation - there is no scheduled/deferred callback to hold open here. The
// adversarial ordering is therefore built by bumping the document to
// generation 2 BEFORE calling generation 1's rag.add(), which is the correct
// analogue of "generation 1's embeddingWorkpool action was already in flight
// when generation 2's crawl round started, and only now reaches the point of
// writing to RAG."
//
// This file lives at the convex/ ROOT (not convex/crawl/), deliberately -
// import.meta.glob("../**/*.ts") issued from a file inside convex/crawl/
// silently excludes convex/crawl/ itself from the match (verified
// empirically: a debug probe showed 0 "crawl/*" keys from that pattern, vs.
// 25 keys from "../crawl/*.ts" issued directly, and merging both globs in
// one file did not reliably fix it either). import.meta.glob("./**/*.ts")
// from convex/ root - the pattern used in this project's own
// convex/_generated/ai/guidelines.md testing example - does not hit this.

import { convexTest } from "convex-test";
import { register as registerRag } from "@convex-dev/rag/test";
import { expect, test } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { rag } from "./rag/instance";
import { computeRagVersionKey } from "./crawl/chunkKey";

const modules = import.meta.glob("./**/*.ts");

function syntheticEmbedding(seed: number): number[] {
  return Array.from({ length: 768 }, (_, i) => Math.sin(seed * 7919 + i));
}

async function insertSyntheticDocument(
  t: ReturnType<typeof convexTest>,
): Promise<Id<"documents">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("documents", {
      url: "https://example.com/uetgpt-generation-race-test",
      title: "Generation race synthetic document",
      source: "test",
      category: "crawled",
      status: "processing",
      crawledAt: now,
      updatedAt: now,
      ingestionGeneration: 1,
      chunkCount: 1,
      chunksEmbedded: 0,
    });
  });
}

test("§59: a stale generation-1 RAG completion must never become authoritative - neither before nor after generation 2 has actually committed - and generation 2's own completion must commit normally", async () => {
  const t = convexTest(schema, modules);
  registerRag(t);

  const documentId = await insertSyntheticDocument(t);
  const baseChunkKey = "synthetic-chunk-position-0";

  const gen1RagVersionKey = await computeRagVersionKey(baseChunkKey, documentId, 1);
  const gen2RagVersionKey = await computeRagVersionKey(baseChunkKey, documentId, 2);

  // Mirror embedSingleChunk's own sequence: stage the raw chunk text before
  // calling rag.add() for generation 1.
  await t.mutation(internal.crawl.mutations.stagePendingChunkText, {
    ragVersionKey: gen1RagVersionKey,
    chunkText: "generation 1 chunk text (must never be committed)",
  });

  // THE adversarial ordering: bump the document to generation 2 - exactly
  // what a real second queueChunksForEmbedding call does
  // (convex/crawl/mutations.ts:476-528) - BEFORE generation 1's in-flight
  // rag.add() reaches the point of writing to RAG and firing onComplete.
  await t.run(async (ctx) => {
    await ctx.db.patch(documentId, {
      ingestionGeneration: 2,
      chunkCount: 1,
      chunksEmbedded: 0,
      status: "processing",
    });
  });

  // NOW generation 1's stale rag.add() finally runs. onComplete
  // (onRagEntryComplete) fires synchronously inside this same call.
  const gen1Add = await t.run(async (ctx) => {
    return await rag.add(ctx, {
      namespace: "uet-global",
      key: gen1RagVersionKey,
      contentHash: "gen1-content-hash",
      chunks: [
        {
          text: "generation 1 chunk text (must never be committed)",
          embedding: syntheticEmbedding(1),
        },
      ],
      filterValues: [
        { name: "category", value: "crawled" },
        { name: "source", value: "test" },
      ],
      metadata: {
        documentId,
        baseChunkKey,
        ingestionGeneration: 1,
        parentId: "",
        headingPath: [],
        createdAtMs: Date.now(),
      },
      onComplete: internal.crawl.mutations.onRagEntryComplete,
    });
  });

  // In case any part of the stale-path cleanup (rag.deleteAsync) scheduled
  // further work rather than completing synchronously, drain it before
  // asserting - verified, not assumed, per the plan's own instruction.
  await t.finishAllScheduledFunctions(() => {});

  // Guard against a vacuous pass: if this add() had taken the entryIsSame
  // contentHash-dedup short-circuit (entries.js's add handler, "existing
  // ready entry with matching contentHash") it would return created:false
  // and never call onComplete at all - every assertion below would then
  // pass for the wrong reason. Assert the real path was taken rather than
  // reasoning about it from the (deliberately distinct) contentHash value.
  expect(gen1Add.created).toBe(true);

  // --- §4f: assert the invariant, each independently ---

  // No crawledChunks row exists for this position at all yet (generation 1
  // must not have committed one, and generation 2 hasn't run yet either).
  const crawledChunksAfterStale = await t.run(async (ctx) => {
    return await ctx.db
      .query("crawledChunks")
      .withIndex("by_documentId_and_chunkKey", (q) =>
        q.eq("documentId", documentId).eq("chunkKey", baseChunkKey),
      )
      .collect();
  });
  expect(crawledChunksAfterStale).toHaveLength(0);

  // The document's ingestionGeneration is still 2 - not reverted or
  // corrupted by the stale completion.
  const docAfterStale = await t.run(async (ctx) => ctx.db.get(documentId));
  expect(docAfterStale?.ingestionGeneration).toBe(2);

  // The generation-1 RAG entry was deleted, not left retrievable.
  const gen1Entry = await t.run(async (ctx) => rag.getEntry(ctx, { entryId: gen1Add.entryId }));
  expect(gen1Entry).toBeNull();

  // pendingChunkText for generation 1's ragVersionKey was cleaned up.
  const gen1Staged = await t.run(async (ctx) => {
    return await ctx.db
      .query("pendingChunkText")
      .withIndex("by_ragVersionKey", (q) => q.eq("ragVersionKey", gen1RagVersionKey))
      .collect();
  });
  expect(gen1Staged).toHaveLength(0);

  // --- §4g: positive control - a real generation-2 completion must commit
  // normally. If this fails, the negative result above is not trustworthy. ---

  await t.mutation(internal.crawl.mutations.stagePendingChunkText, {
    ragVersionKey: gen2RagVersionKey,
    chunkText: "generation 2 chunk text (must be committed)",
  });

  const gen2Add = await t.run(async (ctx) => {
    return await rag.add(ctx, {
      namespace: "uet-global",
      key: gen2RagVersionKey,
      contentHash: "gen2-content-hash",
      chunks: [
        {
          text: "generation 2 chunk text (must be committed)",
          embedding: syntheticEmbedding(2),
        },
      ],
      filterValues: [
        { name: "category", value: "crawled" },
        { name: "source", value: "test" },
      ],
      metadata: {
        documentId,
        baseChunkKey,
        ingestionGeneration: 2,
        parentId: "",
        headingPath: [],
        createdAtMs: Date.now(),
      },
      onComplete: internal.crawl.mutations.onRagEntryComplete,
    });
  });
  await t.finishAllScheduledFunctions(() => {});

  const crawledChunksAfterGen2 = await t.run(async (ctx) => {
    return await ctx.db
      .query("crawledChunks")
      .withIndex("by_documentId_and_chunkKey", (q) =>
        q.eq("documentId", documentId).eq("chunkKey", baseChunkKey),
      )
      .collect();
  });
  expect(crawledChunksAfterGen2).toHaveLength(1);
  expect(crawledChunksAfterGen2[0]).toMatchObject({
    ingestionGeneration: 2,
    text: "generation 2 chunk text (must be committed)",
    ragId: gen2Add.entryId,
  });

  const docAfterGen2 = await t.run(async (ctx) => ctx.db.get(documentId));
  expect(docAfterGen2?.chunksEmbedded).toBe(1);
  expect(docAfterGen2?.status).toBe("indexed");

  // Zero-cost guard (§5 checklist), not just a source-read assertion: if a
  // future @convex-dev/rag version ever changed createChunkArgsBatch's
  // embedding-skip logic, embedMany/doEmbed would run and usage.tokens
  // would be nonzero - this fails loudly rather than silently spending
  // Gemini quota.
  expect(gen1Add.usage.tokens).toBe(0);
  expect(gen2Add.usage.tokens).toBe(0);

  // --- The invariant's STRONGER half, which §4f/§4g alone do not cover: a
  // stale generation-1 completion arriving AFTER generation 2 has already
  // COMMITTED (not merely started) must not clobber it. The negative case
  // above only proves generation 1 loses to a generation-2 bump that
  // hasn't written anything yet - it does not yet prove generation 1 can't
  // overwrite an already-committed generation-2 row. Reusing
  // gen1RagVersionKey is safe: the stale path already deleted that RAG
  // entry, so the key is free for a new (still generation-1-tagged) entry. ---

  await t.mutation(internal.crawl.mutations.stagePendingChunkText, {
    ragVersionKey: gen1RagVersionKey,
    chunkText: "generation 1 chunk text, arriving even later (must still never be committed)",
  });

  const gen1AddAfterGen2Committed = await t.run(async (ctx) => {
    return await rag.add(ctx, {
      namespace: "uet-global",
      key: gen1RagVersionKey,
      contentHash: "gen1-content-hash-late",
      chunks: [
        {
          text: "generation 1 chunk text, arriving even later (must still never be committed)",
          embedding: syntheticEmbedding(3),
        },
      ],
      filterValues: [
        { name: "category", value: "crawled" },
        { name: "source", value: "test" },
      ],
      metadata: {
        documentId,
        baseChunkKey,
        ingestionGeneration: 1,
        parentId: "",
        headingPath: [],
        createdAtMs: Date.now(),
      },
      onComplete: internal.crawl.mutations.onRagEntryComplete,
    });
  });
  await t.finishAllScheduledFunctions(() => {});

  // Same vacuous-pass guard as above: confirm this add() actually created a
  // new pending->ready entry (and therefore actually called onComplete)
  // rather than deduplicating onto something else.
  expect(gen1AddAfterGen2Committed.created).toBe(true);

  // The already-committed generation-2 row must survive UNCHANGED.
  const crawledChunksAfterLateStale = await t.run(async (ctx) => {
    return await ctx.db
      .query("crawledChunks")
      .withIndex("by_documentId_and_chunkKey", (q) =>
        q.eq("documentId", documentId).eq("chunkKey", baseChunkKey),
      )
      .collect();
  });
  expect(crawledChunksAfterLateStale).toHaveLength(1);
  expect(crawledChunksAfterLateStale[0]).toMatchObject({
    ingestionGeneration: 2,
    text: "generation 2 chunk text (must be committed)",
    ragId: gen2Add.entryId,
  });

  const docAfterLateStale = await t.run(async (ctx) => ctx.db.get(documentId));
  expect(docAfterLateStale?.ingestionGeneration).toBe(2);
  expect(docAfterLateStale?.chunksEmbedded).toBe(1);
  expect(docAfterLateStale?.status).toBe("indexed");

  const gen1EntryAfterGen2Committed = await t.run(async (ctx) =>
    rag.getEntry(ctx, { entryId: gen1AddAfterGen2Committed.entryId }),
  );
  expect(gen1EntryAfterGen2Committed).toBeNull();
});
