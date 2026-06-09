import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { rag } from "../rag/instance";
import type { Id } from "../_generated/dataModel";

export const markStaleDocuments = internalMutation({
  args: { crawlSessionId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { crawlSessionId, limit }) => {
    const batchSize = limit ?? 500;
    const statuses = ["active", "pending_embed", "processing", "indexed"] as const;
    let marked = 0;

    for (const status of statuses) {
      const docs = await ctx.db
        .query("documents")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(batchSize);

      for (const doc of docs) {
        if (doc.crawlSessionId !== crawlSessionId) {
          await ctx.db.patch(doc._id, { status: "stale" });
          marked++;
        }
      }
    }
    return { marked, remaining: marked > 0 ? "more" : "done" };
  },
});

async function deleteDocAndChunks(
  ctx: MutationCtx,
  doc: { _id: Id<"documents"> },
): Promise<void> {
  const chunks = await ctx.db
    .query("crawledChunks")
    .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
    .take(200);
  for (const chunk of chunks) {
    try {
      if (chunk.ragId) {
        await rag.delete(ctx, {
          entryId: chunk.ragId as unknown as import("@convex-dev/rag").EntryId,
        });
      }
      await ctx.db.delete(chunk._id);
    } catch (err) {
      console.warn(`Failed to delete vector ${chunk.ragId} from RAG during purge:`, err);
    }
  }
  await ctx.db.delete(doc._id);
}

export const purgeStaleDocuments = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 100;
    let purged = 0;

    const staleDocs = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "stale"))
      .take(batchSize);

    for (const doc of staleDocs) {
      await deleteDocAndChunks(ctx, doc);
      purged++;
    }

    if (purged < batchSize) {
      const isStaleDocs = await ctx.db
        .query("documents")
        .withIndex("by_status", (q) => q.eq("status", "indexed"))
        .take(batchSize);

      for (const doc of isStaleDocs) {
        if (!doc.isStale) continue;

        await deleteDocAndChunks(ctx, doc);
        purged++;
      }
    }

    return { purged, remaining: purged >= batchSize ? "more" : "done" };
  },
});

export const flagExpiredDocuments = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 200;
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    const TTLS = {
      high: 30 * DAY_MS,
      medium: 90 * DAY_MS,
      low: 180 * DAY_MS,
    };

    const indexedDocs = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "indexed"))
      .take(batchSize);

    const activeDocs = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(batchSize);

    const candidates = [...indexedDocs, ...activeDocs];

    let flagged = 0;
    for (const doc of candidates) {
      if (doc.isStale) continue;

      const tier = doc.freshnessTier || "low";
      const ttl = TTLS[tier as keyof typeof TTLS] || TTLS.low;

      if (now - doc.crawledAt > ttl) {
        await ctx.db.patch(doc._id, { isStale: true });
        flagged++;
      }
    }

    return { flagged, remaining: candidates.length === batchSize ? "more" : "done" };
  },
});
