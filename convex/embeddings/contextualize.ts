import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";

export const getChunkContext = internalQuery({
  args: { chunkId: v.id("crawledChunks") },
  handler: async (ctx, args) => {
    const chunk = await ctx.db.get(args.chunkId);
    if (!chunk) return null;
    const doc = await ctx.db.get(chunk.documentId);
    if (!doc) return null;
    return {
      chunkId: chunk._id,
      text: chunk.text,
      headingPath: chunk.headingPath ?? [],
      title: doc.title,
    };
  },
});

export const getChunksPendingContext = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const chunks = await ctx.db
      .query("crawledChunks")
      .filter((q) => q.eq(q.field("contextualizedText"), undefined))
      .order("desc")
      .take(args.limit);
    return chunks.map((c) => c._id);
  },
});

export const getContextualizeProgress = internalQuery({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "contextualize_progress"))
      .first();
    return (setting?.value as number) ?? 0;
  },
});

export const getChunkByDocAndHash = internalQuery({
  args: { documentId: v.id("documents"), contentHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crawledChunks")
      .withIndex("by_documentId_and_contentHash", (q) =>
        q.eq("documentId", args.documentId).eq("contentHash", args.contentHash),
      )
      .first();
  },
});

export const saveContextualizedText = internalMutation({
  args: {
    chunkId: v.id("crawledChunks"),
    contextualizedText: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.chunkId, {
      contextualizedText: args.contextualizedText,
    });
  },
});

export const upsertContextualizeProgress = internalMutation({
  args: { totalProcessed: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "contextualize_progress"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.totalProcessed,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("appSettings", {
        key: "contextualize_progress",
        value: args.totalProcessed,
        section: "contextualization",
        updatedAt: Date.now(),
      });
    }
  },
});

async function callGeminiContextualize(
  text: string,
  title: string,
  headingPath: string[],
): Promise<string | null> {
  try {
    const headingStr = headingPath.length > 0 ? headingPath.join(" > ") : "General";
    const prompt = `Given the document title '${title}' and section '${headingStr}', here is a chunk from that document: '${text}'. Briefly provide context for this chunk — what broader topic does it belong to, and what key information does it contain?`;

    const { generateText } = await import("ai");
    const { google } = await import("@ai-sdk/google");

    const result = await generateText({
      model: google("gemini-2.0-flash"),
      prompt,
    });

    return result.text;
  } catch (err) {
    console.warn(`Gemini contextualization failed for chunk in '${title}':`, err);
    return null;
  }
}

export const contextualizeChunks = internalAction({
  args: {
    chunkIds: v.array(v.id("crawledChunks")),
  },
  handler: async (ctx, args) => {
    const batch = args.chunkIds.slice(0, 5);
    const results = await Promise.allSettled(
      batch.map(async (chunkId) => {
        const chunk = await ctx.runQuery(internal.embeddings.contextualize.getChunkContext, {
          chunkId,
        });
        if (!chunk) return;

        const contextualized = await callGeminiContextualize(
          chunk.text,
          chunk.title,
          chunk.headingPath,
        );

        if (contextualized !== null) {
          await ctx.runMutation(internal.embeddings.contextualize.saveContextualizedText, {
            chunkId,
            contextualizedText: contextualized,
          });
        }
      }),
    );

    const successes = results.filter((r) => r.status === "fulfilled").length;
    const failures = results.filter((r) => r.status === "rejected").length;
    if (failures > 0) {
      console.warn(`Contextualize batch: ${successes} ok, ${failures} failed`);
    }
    return { processed: batch.length, successes, failures };
  },
});

export const contextualizeNewChunk = internalAction({
  args: {
    documentId: v.id("documents"),
    contentHash: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const chunk = await ctx.runQuery(internal.embeddings.contextualize.getChunkByDocAndHash, {
        documentId: args.documentId,
        contentHash: args.contentHash,
      });
      if (!chunk) return;

      await ctx.runAction(internal.embeddings.contextualize.contextualizeChunks, {
        chunkIds: [chunk._id],
      });
    } catch (err) {
      console.warn("Immediate contextualization failed:", err);
    }
  },
});
