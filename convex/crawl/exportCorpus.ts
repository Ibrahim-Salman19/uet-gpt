import { v } from "convex/values";
import { httpAction, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { constantTimeCompare } from "./utils";

/**
 * Internal helper that paginates documents + their stored chunks for the
 * Stage E corpus export. Kept as an internal query so the HTTP action can
 * read from the DB (an httpAction ctx has no direct db handle).
 *
 * GET /api/export/corpus?cursor=...&limit=50
 * Auth: Bearer CONVEX_AUTH_TOKEN (same token as /api/reset and /ingest).
 */
export const corpusPage = internalQuery({
  args: { limit: v.number(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("documents").paginate({
      numItems: args.limit,
      cursor: args.cursor ?? null,
    });

    const documents: Array<Record<string, unknown>> = [];
    for (const document of page.page) {
      const chunks = await ctx.db
        .query("crawledChunks")
        .withIndex("by_documentId", (q) => q.eq("documentId", document._id))
        .order("asc")
        .take(10_000);
      documents.push({
        url: document.url,
        title: document.title ?? "",
        source_url: document.url,
        word_count: document.metadata?.wordCount,
        chunks: chunks.map((chunk, index) => ({
          text: chunk.text,
          chunk_id: chunk._id,
          chunk_index: index,
        })),
      });
    }

    return {
      documents,
      cursor: page.isDone ? null : page.continueCursor,
    };
  },
});

export const exportCorpusWebhook = httpAction(async (ctx, request) => {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    const expectedToken = process.env.CONVEX_AUTH_TOKEN;
    if (!expectedToken) {
      return new Response("Server configuration error", { status: 500 });
    }
    if (!token || !constantTimeCompare(token, expectedToken)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const rawLimit = url.searchParams.get("limit");
    const limit = rawLimit ? Math.min(100, Math.max(1, Number(rawLimit) || 50)) : 50;
    const cursor = url.searchParams.get("cursor");

    const { documents, cursor: nextCursor } = await ctx.runQuery(
      internal.crawl.exportCorpus.corpusPage,
      { limit, cursor: cursor ?? null },
    );

    return new Response(
      JSON.stringify({
        documents,
        cursor: nextCursor,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("Export corpus error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
