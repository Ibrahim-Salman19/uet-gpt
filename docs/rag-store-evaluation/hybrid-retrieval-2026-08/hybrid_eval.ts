#!/usr/bin/env npx tsx
/**
 * Mandate §45/46/57 — hybrid retrieval evaluation for the candidate P2
 * architecture (Pinecone dense + Convex lexical), against the 11
 * AI-reviewed fee-query labels in scripts/eval/golden_set_verified.jsonl
 * (see scripts/eval/label_review.md's 2026-08-31 addendum for provenance
 * and the "corpus's best available answer" labeling rule).
 *
 * Per §46: this reuses the REAL production fusion function (`hybridRank`,
 * imported directly from convex/embeddings/hybridRank.ts - extracted
 * verbatim from search.ts on 2026-08-31 specifically to make this possible,
 * see that file's header comment - not reimplemented) rather than
 * approximating it in Python. Dense results come from the REAL
 * corpus-v1-full Pinecone namespace, queried with the same 5-line
 * `.query()` call pineconeAdapter.ts's denseSearch itself makes (not
 * reimplemented FUSION logic, just the mechanical Pinecone SDK call) -
 * NOT imported from pineconeAdapter.ts directly, because that file now
 * needs a "use node" directive for Convex's own bundler (added 2026-08-31,
 * a real, separate, previously-undiscovered deploy-blocking bug fix - see
 * that file's header comment) and tsx hangs indefinitely importing any
 * file with that directive, confirmed by isolation testing. Lexical
 * results come from the REAL local Convex search_text index via
 * crawl/lexicalProof:searchChunksForProof (the same local self-hosted
 * deployment used for the Phase 5 lexical capacity proof).
 *
 * What this is NOT: production's full searchDocumentsAction. That function
 * also runs HyDE query expansion, query rewriting, IDF-adaptive channel
 * weights, a second lexical channel (chunkTextSearch), FAQ fusion, and
 * freshness decay - none of which run here. HyDE/rewrite specifically could
 * not be exercised: they need a working Gemini/Groq key, and this local
 * deployment's keys are deliberately set to placeholder values from the
 * Phase 5 proof's original zero-LLM-call design (see INDEPENDENT_REVIEW.md
 * §3's 2026-08-31 addendum). This script sends raw query text/embeddings to
 * both channels, exactly what the earlier raw dense-only and raw
 * lexical-only probes did - so it isolates one new variable (real RRF
 * fusion of both real channels) rather than several at once.
 *
 * Run: npx tsx docs/rag-store-evaluation/hybrid-retrieval-2026-08/hybrid_eval.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "fs";
import { Pinecone } from "@pinecone-database/pinecone";
import { hybridRank } from "../../../convex/embeddings/hybridRank";

const INDEX = "uetgpt-corpus-v1-qwen1024";
const NAMESPACE = "corpus-v1-full"; // the real, full 44,792-vector corpus
const CONVEX_LOCAL_URL = "http://127.0.0.1:3210";
const LABELS_PATH = "scripts/eval/golden_set_verified.jsonl";
const QUERY_VECTORS_PATH = "/mnt/d/uetgpt_corpus_v1/embeddings/query_vectors.jsonl";
const TOP_K = 10;
const RRF_K = 60;

const apiKey = process.env.PINECONE_API_KEY;
if (!apiKey) throw new Error("PINECONE_API_KEY is not set");
const pineconeIndex = new Pinecone({ apiKey }).index(INDEX).namespace(NAMESPACE);

async function denseSearch(
  embedding: number[],
  topK: number,
): Promise<Array<{ chunkKey: string; score: number }>> {
  const result = await pineconeIndex.query({ vector: embedding, topK, includeMetadata: true });
  return result.matches
    .filter((m): m is typeof m & { metadata: { chunkKey: string } } => m.metadata !== undefined)
    .map((m) => ({ chunkKey: (m.metadata as { chunkKey: string }).chunkKey, score: m.score ?? 0 }));
}

type Label = {
  queryId: string;
  query: string;
  relevantChunkKeys: string[];
  provenance: string;
  note: string | null;
};

type QueryVector = { queryId: string; embedding: number[] };

function loadJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf-8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as T);
}

async function lexicalSearch(query: string, limit: number): Promise<Array<{ id: string }>> {
  const resp = await fetch(`${CONVEX_LOCAL_URL}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "crawl/lexicalProof:searchChunksForProof",
      args: { query, limit },
      format: "json",
    }),
  });
  const body = await resp.json();
  if (body.status !== "success") {
    throw new Error(`lexical search failed: ${JSON.stringify(body)}`);
  }
  return (body.value as Array<{ chunkKey: string }>).map((r) => ({ id: r.chunkKey }));
}

function hitRateAtK(rankedIds: string[], relevant: Set<string>, k: number): number {
  if (relevant.size === 0) return NaN; // no relevant chunk exists in-corpus per this label - metric undefined, not 0
  return rankedIds.slice(0, k).some((id) => relevant.has(id)) ? 1 : 0;
}

function reciprocalRank(rankedIds: string[], relevant: Set<string>): number {
  if (relevant.size === 0) return NaN;
  const idx = rankedIds.findIndex((id) => relevant.has(id));
  return idx === -1 ? 0 : 1 / (idx + 1);
}

async function main() {
  console.error("[debug] main() started");
  const labels = loadJsonl<Label>(LABELS_PATH);
  console.error(`[debug] loaded ${labels.length} labels`);
  const queryVectors = loadJsonl<QueryVector>(QUERY_VECTORS_PATH);
  console.error(`[debug] loaded ${queryVectors.length} query vectors`);
  const vecById = new Map(queryVectors.map((q) => [q.queryId, q.embedding]));

  console.error("[debug] checking pinecone index stats");
  const stats = await pineconeIndex.describeIndexStats();
  console.log(`Pinecone namespace record count: ${JSON.stringify(stats.namespaces?.[NAMESPACE])}`);

  const results: Array<{
    queryId: string;
    query: string;
    relevantChunkKeys: string[];
    denseTop: string[];
    lexicalTop: string[];
    fusedTop: string[];
    hitAt5: number;
    mrr: number;
  }> = [];

  for (const label of labels) {
    const embedding = vecById.get(label.queryId);
    if (!embedding) {
      console.warn(`No query embedding for ${label.queryId} (${label.query}) - skipping`);
      continue;
    }

    const denseRaw = await denseSearch(embedding, TOP_K);
    const denseRanked = denseRaw.map((r) => ({ id: r.chunkKey, score: r.score }));

    const lexicalRanked = (await lexicalSearch(label.query, TOP_K)).map((r) => ({
      id: r.id,
      score: 0, // hybridRank's RRF math uses array rank order, not this field
    }));

    const fused = hybridRank(denseRanked, lexicalRanked, RRF_K, { vector: 1.0, text: 1.0 });
    const fusedIds = fused.map((f) => f.id);
    const relevant = new Set(label.relevantChunkKeys);

    results.push({
      queryId: label.queryId,
      query: label.query,
      relevantChunkKeys: label.relevantChunkKeys,
      denseTop: denseRanked.slice(0, 5).map((d) => d.id),
      lexicalTop: lexicalRanked.slice(0, 5).map((d) => d.id),
      fusedTop: fusedIds.slice(0, 5),
      hitAt5: hitRateAtK(fusedIds, relevant, 5),
      mrr: reciprocalRank(fusedIds, relevant),
    });
  }

  console.log("\n=== per-query results (fused = real hybridRank(dense, lexical)) ===");
  for (const r of results) {
    const denseHit = r.denseTop.some((id) => r.relevantChunkKeys.includes(id));
    const lexicalHit = r.lexicalTop.some((id) => r.relevantChunkKeys.includes(id));
    const fusedHit = r.fusedTop.some((id) => r.relevantChunkKeys.includes(id));
    console.log(
      `${r.relevantChunkKeys.length === 0 ? "[no labeled answer]" : fusedHit ? "[FUSED HIT]" : "[fused miss]"} ` +
        `dense=${denseHit ? "hit" : "miss"} lexical=${lexicalHit ? "hit" : "miss"} - ${r.query}`,
    );
  }

  const withLabels = results.filter((r) => r.relevantChunkKeys.length > 0);
  const meanHitAt5 = withLabels.reduce((s, r) => s + r.hitAt5, 0) / withLabels.length;
  const meanMrr = withLabels.reduce((s, r) => s + r.mrr, 0) / withLabels.length;

  console.log(`\n=== summary (over the ${withLabels.length} queries with a labeled relevant chunk) ===`);
  console.log(`mean HitRate@5 (fused): ${meanHitAt5.toFixed(3)}`);
  console.log(`mean MRR (fused): ${meanMrr.toFixed(3)}`);

  const outPath = "docs/rag-store-evaluation/hybrid-retrieval-2026-08/hybrid_eval_results.json";
  await import("fs").then((fs) =>
    fs.writeFileSync(outPath, JSON.stringify({ results, meanHitAt5, meanMrr }, null, 2)),
  );
  console.log(`\nwrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
