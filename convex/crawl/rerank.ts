"use node";

import { pipeline } from "@xenova/transformers";

// Use singleton pattern so the model is only loaded once per isolate
let rerankerPipeline: any = null;

async function getReranker() {
  if (!rerankerPipeline) {
    // Cross-encoder for reranking
    rerankerPipeline = await pipeline("text-classification", "Xenova/ms-marco-MiniLM-L-6-v2");
  }
  return rerankerPipeline;
}

export async function rerankResults(
  query: string,
  documents: Array<{ entryId: string; content: string; url: string; title: string; relevanceScore: number }>,
  topK = 4
) {
  if (documents.length === 0) return [];
  
  const reranker = await getReranker();
  
  // Format inputs as pairs: [query, document]
  const pairs = documents.map(doc => [query, doc.content]);
  
  // Rerank using cross-encoder
  // By default, text-classification pipeline on pairs will return an array of { label, score }
  const results = await reranker(pairs);
  
  // If results is array of arrays or flat array
  // we assume it maps 1:1 with input pairs
  const scoredDocs = documents.map((doc, i) => {
    // Extract score from the result
    const res = Array.isArray(results[i]) ? results[i][0] : results[i];
    const score = res && typeof res.score === 'number' ? res.score : doc.relevanceScore;
    
    return {
      ...doc,
      rerankScore: score
    };
  });
  
  return scoredDocs
    .sort((a, b) => b.rerankScore - a.rerankScore)
    .slice(0, topK);
}
