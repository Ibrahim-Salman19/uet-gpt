import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

const cacheEntryValidator = v.object({
  _id: v.id("semanticCache"),
  _creationTime: v.number(),
  queryText: v.string(),
  queryEmbedding: v.array(v.float64()),
  response: v.string(),
  sources: v.array(
    v.object({
      entryId: v.string(),
      url: v.string(),
      title: v.string(),
      relevanceScore: v.number(),
      excerpt: v.string(),
      headingPath: v.optional(v.array(v.string())),
    }),
  ),
  model: v.string(),
  tokenCount: v.optional(
    v.object({
      prompt: v.number(),
      completion: v.number(),
      total: v.number(),
    }),
  ),
  hits: v.number(),
  expiresAt: v.number(),
  createdAt: v.number(),
  embeddingModel: v.optional(v.string()),
  sourceEntryIds: v.optional(v.array(v.string())),
  alternateQueryTexts: v.optional(v.array(v.string())),
  alternateEmbeddings: v.optional(v.array(v.array(v.float64()))),
  maxDocumentUpdatedAt: v.optional(v.number()),
});

export const getCacheEntry = internalQuery({
  args: { id: v.id("semanticCache") },
  returns: v.union(cacheEntryValidator, v.null()),
  handler: async (ctx, args) => {
    return (await ctx.db.get(args.id)) as Doc<"semanticCache"> | null;
  },
});

// Lightweight projection used by the read path to check alternate-embedding
// matches without hauling the full row (response, sources, primary queryEmbedding)
// across the action/query boundary for every vector-search candidate.
export const getCacheEntryAlternates = internalQuery({
  args: { id: v.id("semanticCache") },
  returns: v.union(
    v.object({
      expiresAt: v.number(),
      alternateEmbeddings: v.optional(v.array(v.array(v.float64()))),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (!entry) return null;
    return {
      expiresAt: entry.expiresAt,
      alternateEmbeddings: entry.alternateEmbeddings,
    };
  },
});

export const incrementHits = internalMutation({
  args: { id: v.id("semanticCache") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (entry) {
      const currentHits = typeof entry.hits === "number" ? entry.hits : 0;
      await ctx.db.patch(args.id, { hits: currentHits + 1 });
    }
    return null;
  },
});

export const getDocsByEntryIds = internalQuery({
  args: { entryIds: v.array(v.string()) },
  returns: v.array(
    v.object({
      entryId: v.string(),
      doc: v.union(
        v.object({
          updatedAt: v.number(),
          crawledAt: v.number(),
        }),
        v.null(),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    if (args.entryIds.length > 100)
      throw new ConvexError("Cannot query more than 100 entry IDs at a time");
    const chunks = await Promise.all(
      args.entryIds.map((entryId) =>
        ctx.db
          .query("crawledChunks")
          .withIndex("by_ragId", (q) => q.eq("ragId", entryId))
          .first(),
      ),
    );

    const docIds = [...new Set(chunks.filter(Boolean).map((c) => c!.documentId))];
    const docs = await Promise.all(docIds.map((id) => ctx.db.get(id)));
    const docsById = new Map(docs.filter(Boolean).map((d) => [d!._id, d!]));

    return args.entryIds.map((entryId, i) => {
      const chunk = chunks[i];
      if (!chunk) return { entryId, doc: null };
      const doc = docsById.get(chunk.documentId);
      if (!doc) return { entryId, doc: null };
      return { entryId, doc: { updatedAt: doc.updatedAt, crawledAt: doc.crawledAt } };
    });
  },
});

export const getDocByEntryId = internalQuery({
  args: { entryId: v.string() },
  returns: v.union(
    v.object({
      updatedAt: v.number(),
      crawledAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    // sourceEntryIds in the semantic cache refer to the ragId of crawledChunks
    const chunk = await ctx.db
      .query("crawledChunks")
      .withIndex("by_ragId", (q) => q.eq("ragId", args.entryId))
      .first();

    if (!chunk) return null;

    const doc = await ctx.db.get(chunk.documentId);
    if (!doc) return null;
    return { updatedAt: doc.updatedAt, crawledAt: doc.crawledAt };
  },
});

export const chunksExistByRagIds = internalQuery({
  args: { ragIds: v.array(v.string()) },
  returns: v.array(v.boolean()),
  handler: async (ctx, args) => {
    if (args.ragIds.length > 100)
      throw new ConvexError("Cannot check more than 100 rag IDs at a time");
    const chunks = await Promise.all(
      args.ragIds.map((ragId) =>
        ctx.db
          .query("crawledChunks")
          .withIndex("by_ragId", (q) => q.eq("ragId", ragId))
          .first(),
      ),
    );
    return chunks.map(Boolean);
  },
});

export const deleteCacheEntry = internalMutation({
  args: { id: v.id("semanticCache") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});

export const cleanupExpired = internalMutation({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const maxToDelete = args.limit ?? 50;
    const now = Date.now();

    const expired = await ctx.db
      .query("semanticCache")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(maxToDelete);

    await Promise.all(expired.map((entry) => ctx.db.delete(entry._id as Id<"semanticCache">)));

    return expired.length;
  },
});
