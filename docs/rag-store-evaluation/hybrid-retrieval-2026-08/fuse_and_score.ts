#!/usr/bin/env npx tsx
/**
 * Mandate §45/46/57 hybrid retrieval evaluation, step 2 of 2.
 *
 * Reads channel_results.json (real dense + real lexical ranked results,
 * fetched by fetch_channel_results.py - see that file's header for why
 * the fetch itself runs in Python) and fuses them with the REAL,
 * unmodified production RRF function, imported directly from
 * convex/embeddings/hybridRank.ts - not reimplemented, per §46. Computes
 * HitRate@5 and MRR against the AI-reviewed labels in
 * scripts/eval/golden_set_verified.jsonl.
 *
 * Run: npx tsx docs/rag-store-evaluation/hybrid-retrieval-2026-08/fuse_and_score.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { hybridRank } from "../../../convex/embeddings/hybridRank";

const IN_PATH = "docs/rag-store-evaluation/hybrid-retrieval-2026-08/channel_results.json";
const OUT_PATH = "docs/rag-store-evaluation/hybrid-retrieval-2026-08/hybrid_eval_results.json";
const RRF_K = 60;

type ChannelResult = {
  queryId: string;
  query: string;
  relevantChunkKeys: string[];
  dense: Array<{ id: string; score: number }>;
  lexical: Array<{ id: string; score: number }>;
};

function hitRateAtK(rankedIds: string[], relevant: Set<string>, k: number): number {
  if (relevant.size === 0) return NaN;
  return rankedIds.slice(0, k).some((id) => relevant.has(id)) ? 1 : 0;
}

function reciprocalRank(rankedIds: string[], relevant: Set<string>): number {
  if (relevant.size === 0) return NaN;
  const idx = rankedIds.findIndex((id) => relevant.has(id));
  return idx === -1 ? 0 : 1 / (idx + 1);
}

function main() {
  const channelResults: ChannelResult[] = JSON.parse(readFileSync(IN_PATH, "utf-8"));

  const results = channelResults.map((r) => {
    const fused = hybridRank(r.dense, r.lexical, RRF_K, { vector: 1.0, text: 1.0 });
    const fusedIds = fused.map((f) => f.id);
    const relevant = new Set(r.relevantChunkKeys);
    return {
      queryId: r.queryId,
      query: r.query,
      relevantChunkKeys: r.relevantChunkKeys,
      denseTop5: r.dense.slice(0, 5).map((d) => d.id),
      lexicalTop5: r.lexical.slice(0, 5).map((d) => d.id),
      fusedTop5: fusedIds.slice(0, 5),
      hitAt5: hitRateAtK(fusedIds, relevant, 5),
      mrr: reciprocalRank(fusedIds, relevant),
    };
  });

  console.log("=== per-query results (fused = real hybridRank(dense, lexical), RRF_K=60, equal weights) ===\n");
  for (const r of results) {
    const denseHit = r.denseTop5.some((id) => r.relevantChunkKeys.includes(id));
    const lexicalHit = r.lexicalTop5.some((id) => r.relevantChunkKeys.includes(id));
    const fusedHit = r.fusedTop5.some((id) => r.relevantChunkKeys.includes(id));
    const label = r.relevantChunkKeys.length === 0 ? "[no labeled answer in top10 of either raw channel]" : fusedHit ? "[FUSED HIT]" : "[fused MISS]";
    console.log(`${label} dense=${denseHit ? "hit" : "miss"} lexical=${lexicalHit ? "hit" : "miss"} :: ${r.query}`);
  }

  const withLabels = results.filter((r) => r.relevantChunkKeys.length > 0);
  const meanHitAt5 = withLabels.reduce((s, r) => s + r.hitAt5, 0) / withLabels.length;
  const meanMrr = withLabels.reduce((s, r) => s + r.mrr, 0) / withLabels.length;
  const fusedHitCount = withLabels.filter((r) => r.hitAt5 === 1).length;

  console.log(`\n=== summary (over the ${withLabels.length}/${results.length} queries with a labeled relevant chunk) ===`);
  console.log(`fused HitRate@5: ${fusedHitCount}/${withLabels.length} = ${meanHitAt5.toFixed(3)}`);
  console.log(`fused mean MRR: ${meanMrr.toFixed(3)}`);
  console.log(
    `\n(${results.length - withLabels.length} of the ${results.length} queries had NO relevant chunk in either raw channel's top10 - ` +
      `no labeled answer exists to score fusion against for those; they are reported above but excluded from the mean.)`,
  );

  writeFileSync(OUT_PATH, JSON.stringify({ results, meanHitAt5, meanMrr, scoredQueryCount: withLabels.length }, null, 2));
  console.log(`\nwrote ${OUT_PATH}`);
}

main();
