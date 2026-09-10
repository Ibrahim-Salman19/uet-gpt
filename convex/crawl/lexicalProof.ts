import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import {
  buildContextPrefix,
  generateChunks,
  isPdfVirtualUrl,
  normalizeContent,
} from "./chunking";

// Phase 5 (mandate): local Convex minimal lexical capacity proof. Loads the
// frozen Corpus V1 (docs/rag-store-evaluation/local-corpus-v1-freeze-2026-08/)
// into this local dev deployment's `documents` + `crawledChunks` tables and
// proves the `search_text` full-text index can handle real corpus-scale
// keyword search - with ZERO embedding/Gemini calls.
//
// Deliberately does NOT reuse mutations.ts's enqueueDocumentChunks: that
// mutation unconditionally calls embeddingPool.enqueueActionBatch(...,
// embedSingleChunk, ...) for every child chunk, which is a real Gemini call
// site - exactly what this phase must not trigger. upsertDocument itself has
// no such side effect (verified by reading its body) and is reused as-is;
// only the chunk-write path is reimplemented here, writing directly into
// crawledChunks with a locally-generated ragId placeholder (the field is a
// plain v.string(), not a v.id() reference into the external @convex-dev/rag
// component, so this is a legitimate value for a row that deliberately has
// no vector embedding).
//
// The two entry points (ingestBatchForLexicalProof, searchChunksForProof) are
// `internalAction`. They were originally plain `action` so the Phase 5 proof
// scripts could POST large payloads to Convex's HTTP API directly, bypassing
// `npx convex run`'s CLI argument-size limit - safe only as long as this ran
// against a local loopback deployment. That assumption no longer holds once
// this code is deployed to real production, so both were switched back to
// internal-only; re-run future large-payload proofs against a local dev
// deployment instead. Both mutations they call into (insertChunksNoEmbedding,
// upsertDocument) remain internal-only.

export const ingestBatchForLexicalProof = internalAction({
  args: {
    documents: v.array(
      v.object({
        url: v.string(),
        title: v.optional(v.string()),
        markdown: v.string(),
        contentHash: v.string(),
        sourceType: v.string(),
      }),
    ),
  },
  handler: async (ctx, { documents }) => {
    let documentsWritten = 0;
    let chunksWritten = 0;
    for (const doc of documents) {
      const result = await ctx.runMutation(internal.crawl.mutations.upsertDocument, {
        url: doc.url,
        markdown: doc.markdown,
        contentHash: doc.contentHash,
        crawlSessionId: "phase5-lexical-proof",
        title: doc.title,
        sourceType: doc.sourceType,
      });
      if (result.action === "skipped") {
        // upsertDocument's skip decision is purely content-hash-based, not
        // chunk-completion-based - if a previous batch failed (e.g. this
        // deployment's write-rate limit) between writing the document and
        // writing its chunks, this document exists with unchanged content
        // but chunkCount 0. Retrying the same batch must still finish
        // chunking it, or it would silently and permanently stay
        // unsearchable.
        const chunkCount: number = await ctx.runQuery(
          internal.crawl.lexicalProof._getDocumentChunkCount,
          { documentId: result.documentId },
        );
        if (chunkCount > 0) continue;
      }

      const normalized = normalizeContent(doc.markdown);
      const contextPrefix = buildContextPrefix(
        doc.title || doc.url,
        doc.url,
        isPdfVirtualUrl(doc.url),
      );
      const { children } = await generateChunks(normalized, contextPrefix, doc.url);

      await ctx.runMutation(internal.crawl.lexicalProof.insertChunksNoEmbedding, {
        documentId: result.documentId,
        chunks: children.map((c) => ({
          text: c.text,
          contentHash: c.contentHash,
          chunkKey: c.chunkKey,
          headingPath: c.headingPath,
        })),
      });
      documentsWritten += 1;
      chunksWritten += children.length;
    }
    return { documentsWritten, chunksWritten };
  },
});

export const _getDocumentChunkCount = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const doc = await ctx.db.get(documentId);
    return doc?.chunkCount ?? 0;
  },
});

export const insertChunksNoEmbedding = internalMutation({
  args: {
    documentId: v.id("documents"),
    chunks: v.array(
      v.object({
        text: v.string(),
        contentHash: v.string(),
        chunkKey: v.string(),
        headingPath: v.optional(v.array(v.string())),
      }),
    ),
  },
  handler: async (ctx, { documentId, chunks }) => {
    for (const chunk of chunks) {
      await ctx.db.insert("crawledChunks", {
        documentId,
        contentHash: chunk.contentHash,
        text: chunk.text,
        ragId: `lexical-proof:${chunk.contentHash}`,
        chunkKey: chunk.chunkKey,
        headingPath: chunk.headingPath,
      });
    }
    await ctx.db.patch(documentId, {
      chunkCount: chunks.length,
      status: "indexed" as const,
    });
  },
});

// Read-only proof queries - full-text search over the real chunk corpus.
export const searchChunksForProof = internalAction({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { query, limit }): Promise<unknown> => {
    return await ctx.runQuery(internal.crawl.lexicalProof._searchChunks, {
      query,
      limit: limit ?? 10,
    });
  },
});

export const _searchChunks = internalQuery({
  args: { query: v.string(), limit: v.number() },
  handler: async (ctx, { query, limit }) => {
    const results = await ctx.db
      .query("crawledChunks")
      .withSearchIndex("search_text", (q) => q.search("text", query))
      .take(limit);
    return results.map((r) => ({
      documentId: r.documentId,
      contentHash: r.contentHash,
      chunkKey: r.chunkKey,
      textPreview: r.text.slice(0, 200),
      headingPath: r.headingPath,
    }));
  },
});
