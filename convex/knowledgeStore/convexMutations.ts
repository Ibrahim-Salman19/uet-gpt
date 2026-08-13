import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";
import { rag } from "../rag/instance";

// Write primitives backing the Convex KnowledgeStore adapter
// (convexAdapter.ts). These are deliberately separate from
// convex/crawl/mutations.ts: that file's upsertDocument/queueChunksForEmbedding
// are the PRODUCTION crawl-webhook ingestion path (raw payloads, async
// Workpool embedding) and are NOT touched by this migration. These mutations
// instead implement the KnowledgeStore contract directly — the caller has
// already computed embeddings and identity (chunkKey, contentHash,
// indexingFingerprint) before calling in, so there is no async embedding
// tail here to coordinate.

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const upsertDocumentRow = internalMutation({
  args: {
    canonicalUrl: v.string(),
    title: v.string(),
    contentHash: v.string(),
    indexingFingerprint: v.string(),
    category: v.string(),
  },
  returns: v.object({
    documentId: v.string(),
    generation: v.number(),
    fastPathEligible: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_url", (q) => q.eq("url", args.canonicalUrl))
      .first();

    if (existing) {
      const generation = existing.ingestionGeneration ?? 0;
      if (
        existing.contentHash === args.contentHash &&
        existing.indexingFingerprint === args.indexingFingerprint
      ) {
        return { documentId: existing._id, generation, fastPathEligible: true };
      }
      const newGeneration = generation + 1;
      await ctx.db.patch(existing._id, {
        title: args.title,
        contentHash: args.contentHash,
        indexingFingerprint: args.indexingFingerprint,
        category: args.category,
        updatedAt: now,
        ingestionGeneration: newGeneration,
      });
      return { documentId: existing._id, generation: newGeneration, fastPathEligible: false };
    }

    // New document: fields this store doesn't own (status/source) get
    // reasonable, real-schema-valid defaults derived from the input rather
    // than invented ones. "active" mirrors the literal today's
    // isRetrievalEligibleStatus (convex/shared/freshnessPolicy.ts) actually
    // treats as eligible; source mirrors the architecture snapshot's
    // observed `source=<host>` convention.
    let source: string;
    try {
      source = new URL(args.canonicalUrl).host;
    } catch {
      source = "unknown";
    }
    const documentId = await ctx.db.insert("documents", {
      url: args.canonicalUrl,
      title: args.title,
      contentHash: args.contentHash,
      indexingFingerprint: args.indexingFingerprint,
      category: args.category,
      source,
      status: "active",
      crawledAt: now,
      updatedAt: now,
      ingestionGeneration: 1,
    });
    return { documentId, generation: 1, fastPathEligible: false };
  },
});

export const upsertChunkRow = internalMutation({
  args: {
    documentId: v.string(),
    chunkKey: v.string(),
    ragId: v.string(),
    headingPath: v.array(v.string()),
    text: v.string(),
    ingestionGeneration: v.number(),
    parentText: v.optional(v.string()),
    contextualizedText: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const documentId = args.documentId as Id<"documents">;

    let parentId: Id<"chunkParents"> | undefined;
    if (args.parentText !== undefined) {
      const parentContentHash = await sha256Hex(args.parentText);
      const existingParent = await ctx.db
        .query("chunkParents")
        .withIndex("by_documentId_and_contentHash", (q) =>
          q.eq("documentId", documentId).eq("contentHash", parentContentHash),
        )
        .first();
      parentId =
        existingParent?._id ??
        (await ctx.db.insert("chunkParents", {
          documentId,
          contentHash: parentContentHash,
          text: args.parentText,
        }));
    }

    const existing = await ctx.db
      .query("crawledChunks")
      .withIndex("by_documentId_and_chunkKey", (q) =>
        q.eq("documentId", documentId).eq("chunkKey", args.chunkKey),
      )
      .first();

    const contentHash = await sha256Hex(args.text);
    const row = {
      documentId,
      contentHash,
      text: args.text,
      ragId: args.ragId,
      embeddingModel: "gemini-embedding-2",
      parentId,
      headingPath: args.headingPath,
      contextualizedText: args.contextualizedText,
      chunkKey: args.chunkKey,
      ingestionGeneration: args.ingestionGeneration,
    };

    if (existing) {
      await ctx.db.patch(existing._id, row);
      // ragVersionKey is generation-scoped (computeRagVersionKey), so RAG's
      // own (namespace, key) replace mechanism never sees this generation's
      // entry and the previous generation's entry as related - repointing
      // this row from an older generation's ragId to a newer one is
      // therefore not something RAG will ever clean up on its own (mirrors
      // the identical, source-verified reasoning behind
      // retireSupersededCrossGenerationVector in convex/crawl/mutations.ts).
      // Left un-retired, the old entry and its chunk/embedding rows are a
      // permanent orphan - nothing else ever revisits them.
      if (
        existing.ragId !== args.ragId &&
        existing.ingestionGeneration !== args.ingestionGeneration
      ) {
        try {
          await rag.deleteAsync(ctx, {
            entryId: existing.ragId as unknown as import("@convex-dev/rag").EntryId,
          });
        } catch (err) {
          console.warn(`Failed to delete superseded cross-generation vector ${existing.ragId}:`, err);
        }
      }
    } else {
      await ctx.db.insert("crawledChunks", row);
    }
    return null;
  },
});

export const listChunksBelowGeneration = internalQuery({
  args: { documentId: v.string(), beforeGeneration: v.number() },
  returns: v.array(v.object({ _id: v.string(), ragId: v.string() })),
  handler: async (ctx, args) => {
    const documentId = args.documentId as Id<"documents">;
    const chunks = await ctx.db
      .query("crawledChunks")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .collect();
    // Legacy rows with no ingestionGeneration are treated as generation 0 -
    // always stale relative to any real committed generation - matching the
    // convention documented on documents.ingestionGeneration in schema.ts.
    return chunks
      .filter((c) => (c.ingestionGeneration ?? 0) < args.beforeGeneration)
      .map((c) => ({ _id: c._id, ragId: c.ragId }));
  },
});

export const listAllChunksForDocument = internalQuery({
  args: { documentId: v.string() },
  returns: v.array(v.object({ _id: v.string(), ragId: v.string() })),
  handler: async (ctx, args) => {
    const documentId = args.documentId as Id<"documents">;
    const chunks = await ctx.db
      .query("crawledChunks")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .collect();
    return chunks.map((c) => ({ _id: c._id, ragId: c.ragId }));
  },
});

/**
 * Deletes the given (already rag.delete()'d by the caller) chunk rows and
 * advances the document's committed generation, in one mutation. Called
 * after the action-context caller has synchronously confirmed every listed
 * ragId's RAG entry is gone (see commitGeneration in convexAdapter.ts) —
 * ordering RAG deletion before row deletion means a crash here leaves rows
 * pointing at already-gone RAG entries (a visible, re-detectable "dangling
 * row" state that a retry of commitGeneration naturally cleans up), never an
 * untracked RAG entry (an invisible orphan, the failure mode
 * reconciliation.ts exists to catch on the production path).
 */
export const deleteChunkRowsAndAdvanceGeneration = internalMutation({
  args: {
    documentId: v.string(),
    chunkRowIds: v.array(v.string()),
    newGeneration: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    for (const rowId of args.chunkRowIds) {
      await ctx.db.delete(rowId as Id<"crawledChunks">);
    }
    await ctx.db.patch(args.documentId as Id<"documents">, {
      ingestionGeneration: args.newGeneration,
      updatedAt: Date.now(),
    });
    return args.chunkRowIds.length;
  },
});

export const deleteDocumentRowAndChunks = internalMutation({
  args: { documentId: v.string(), chunkRowIds: v.array(v.string()) },
  returns: v.number(),
  handler: async (ctx, args) => {
    for (const rowId of args.chunkRowIds) {
      await ctx.db.delete(rowId as Id<"crawledChunks">);
    }
    await ctx.db.delete(args.documentId as Id<"documents">);
    return args.chunkRowIds.length;
  },
});
