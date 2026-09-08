"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { createPineconeKnowledgeStore } from "./pineconeAdapter";

// ────────────────────────────────────────────────────────────────────────────
// V8-isolate callable wrapper around pineconeAdapter.denseSearch. Exists
// because pineconeAdapter.ts requires "use node" (the Pinecone SDK), while
// embeddings/search.ts (the caller) runs in the default V8 action runtime -
// same reasoning as embeddings/generate.ts's "use node" split for the
// Gemini embedding call. search.ts calls this via ctx.runAction rather than
// importing pineconeAdapter directly.
//
// Points at the real, live corpus index/namespace this session's evaluation
// already certified (44,792/44,792 vectors, Recall@10=0.98) -
// docs/rag-store-evaluation/pinecone-p2-proof-2026-08/upload_full_corpus.py's
// INDEX_NAME/NAMESPACE constants, not the isolated test namespaces used by
// pineconeAdapter-live-test.ts / pineconeLifecycleTest.ts.
// ────────────────────────────────────────────────────────────────────────────

const INDEX_NAME = "uetgpt-corpus-v1-qwen1024";
const NAMESPACE = "corpus-v1-full";

export const denseSearch = internalAction({
  args: {
    queryEmbedding: v.array(v.float64()),
    topK: v.number(),
    category: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      chunkKey: v.string(),
      documentId: v.string(),
      score: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const store = createPineconeKnowledgeStore(INDEX_NAME, NAMESPACE);
    const results = await store.denseSearch(ctx, new Float32Array(args.queryEmbedding), {
      topK: args.topK,
      filter: args.category ? { category: args.category } : undefined,
    });
    // Dense hits carry no text (pineconeAdapter.denseSearch always returns
    // text: "" - see its own module comment) - only identity + score cross
    // the wire here. The caller resolves text via getRagIdsByChunkRefs +
    // the existing ragId hydration path.
    return results.map((r) => ({ chunkKey: r.chunkKey, documentId: r.documentId, score: r.score }));
  },
});
