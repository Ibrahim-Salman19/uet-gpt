import { RAG } from "@convex-dev/rag";
import type { EmbeddingModel } from "ai";
import { components } from "../_generated/api";

// Resilient custom embedding model wrapping our multi-key rotation and fallback client
const resilientEmbeddingModel: EmbeddingModel = {
  specificationVersion: "v3",
  maxEmbeddingsPerCall: 2048,
  supportsParallelCalls: true,
  modelId: "gemini-embedding-001",
  doEmbed: async (options: { values: string[] }) => {
    // Dynamic import avoids circular dependencies at startup
    const { generateEmbeddingsInternal } = await import("../embeddings/generate.js");
    const embeddings = await generateEmbeddingsInternal(options.values);
    return { embeddings };
  },
} as any;

export const rag = new RAG(components.rag as any, {
  embeddingDimension: 3072,
  textEmbeddingModel: resilientEmbeddingModel,
  filterNames: ["category", "source"],
});
