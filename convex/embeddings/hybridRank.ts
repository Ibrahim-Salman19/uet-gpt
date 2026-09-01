import type { AdaptiveWeights } from "./idf";

// Extracted verbatim from search.ts (2026-08-31): this is a pure function
// with no Convex-runtime dependency, but it previously lived in a file
// (embeddings/search.ts) that imports rag/instance.ts, which constructs a
// `new RAG(components.rag, ...)` component client at MODULE LOAD TIME -
// that only resolves inside a deployed Convex function's runtime, so any
// attempt to import hybridRank from search.ts in a plain Node/tsx script
// (e.g. a controlled §46 evaluation entrypoint) hangs indefinitely on
// import, never resolving or rejecting. Moved here so the real fusion
// logic can be imported and exercised outside Convex without dragging in
// that runtime coupling. search.ts re-exports this for its own use -
// production behavior is unchanged, same function, same call sites.
export function hybridRank(
  vectorResults: Array<{ id: string; score: number }>,
  textResults: Array<{ id: string; score: number }>,
  k = 60,
  weights: AdaptiveWeights = { vector: 1.0, text: 1.0 },
  decayStrategy: "linear" | "reciprocal" = "reciprocal",
  extraResults?: Array<{
    results: Array<{ id: string; score: number }>;
    weight: number;
  }>,
): Array<{ id: string; score: number }> {
  const scores = new Map<string, number>();

  const decay = (rank: number, total: number): number => {
    if (decayStrategy === "linear") {
      return Math.max(0.001, total > 0 ? (total - rank) / total : 0);
    }
    return 1 / (k + rank);
  };

  const addSet = (results: Array<{ id: string; score: number }>, weight: number): void => {
    results.forEach((res, rank) => {
      scores.set(res.id, (scores.get(res.id) ?? 0) + weight * decay(rank, results.length));
    });
  };

  addSet(vectorResults, weights.vector);
  addSet(textResults, weights.text);

  if (extraResults) {
    for (const extra of extraResults) {
      addSet(extra.results, extra.weight);
    }
  }

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
