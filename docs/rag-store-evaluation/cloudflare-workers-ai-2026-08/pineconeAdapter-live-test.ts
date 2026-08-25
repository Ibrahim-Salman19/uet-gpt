#!/usr/bin/env npx tsx
/**
 * Live integration test for convex/knowledgeStore/pineconeAdapter.ts against
 * the REAL uetgpt-corpus-v1-qwen1024 index, in an isolated namespace never
 * touched by the actual corpus ingest.
 *
 * Why this exists: writing an adapter without exercising it against the real
 * API is exactly the "looks fine, silently wrong" pattern this whole
 * evaluation has been eliminating (see the embeddinggemma-300m truncation
 * finding, and the two composite-store test bugs caught earlier this
 * session). ActionCtx is never used by any pineconeAdapter method (Pinecone
 * calls are plain HTTPS, same as the Turso adapter's own rationale in
 * types.ts), so this can run standalone via `npx tsx` rather than needing a
 * real Convex action context.
 *
 * Run: npx tsx docs/rag-store-evaluation/cloudflare-workers-ai-2026-08/pineconeAdapter-live-test.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createPineconeKnowledgeStore } from "../../../convex/knowledgeStore/pineconeAdapter";
import type { ActionCtx } from "../../../convex/_generated/server";

const INDEX = "uetgpt-corpus-v1-qwen1024";
const NAMESPACE = "adapter-contract-test"; // isolated - never mixed with real corpus data
const DIM = 1024;
const ctx = undefined as unknown as ActionCtx; // unused by every method below

function vec(seed: number): Float32Array {
  const v = new Float32Array(DIM);
  v[seed % DIM] = 1;
  return v;
}

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail !== undefined ? `  (${JSON.stringify(detail)})` : ""}`);
  }
}

async function main() {
  const store = createPineconeKnowledgeStore(INDEX, NAMESPACE);

  console.log(`\n=== 0. cleanup any residue from a prior run ===`);
  await store.deleteDocument(ctx, "adapter-test-doc-1");
  await store.deleteDocument(ctx, "adapter-test-doc-2");

  console.log(`\n=== 1. health() against the live index ===`);
  const h = await store.health(ctx);
  check("health.ok", h.ok === true, h);

  console.log(`\n=== 2. upsertDocument is a genuine no-op ===`);
  const docResult = await store.upsertDocument(ctx, {
    canonicalUrl: "https://example.com/x",
    title: "X",
    contentHash: "h",
    indexingFingerprint: "f",
    category: "crawled",
  });
  check("upsertDocument does not throw", true);
  check("upsertDocument returns a stub, not a real id", docResult.documentId === "");

  console.log(`\n=== 3. upsertChunks then denseSearch finds it ===`);
  await store.upsertChunks(ctx, "adapter-test-doc-1", 1, "crawled", [
    { chunkKey: "chunk-a", ordinalWithinHeading: 0, headingPath: ["A"], text: "text-a", embedding: vec(1) },
    { chunkKey: "chunk-b", ordinalWithinHeading: 1, headingPath: ["B"], text: "text-b", embedding: vec(2) },
  ]);
  // Pinecone serverless is eventually consistent - poll rather than a bare
  // sleep, mirroring the mandate §54/§60 requirement already applied
  // elsewhere in this evaluation (lsn_utils.py's wait_for_write_visibility).
  let found: Awaited<ReturnType<typeof store.denseSearch>> = [];
  for (let attempt = 0; attempt < 20; attempt++) {
    found = await store.denseSearch(ctx, vec(1), { topK: 5 });
    if (found.some((r) => r.chunkKey === "chunk-a")) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  check("denseSearch finds chunk-a by its own vector", found.some((r) => r.chunkKey === "chunk-a"), found);
  check("returned documentId matches", found[0]?.documentId === "adapter-test-doc-1");

  console.log(`\n=== 4. category filter excludes the other category ===`);
  await store.upsertChunks(ctx, "adapter-test-doc-2", 1, "manual", [
    { chunkKey: "chunk-c", ordinalWithinHeading: 0, headingPath: ["C"], text: "text-c", embedding: vec(1) },
  ]);
  let filtered: Awaited<ReturnType<typeof store.denseSearch>> = [];
  for (let attempt = 0; attempt < 20; attempt++) {
    filtered = await store.denseSearch(ctx, vec(1), { topK: 10, filter: { category: "crawled" } });
    if (filtered.length > 0) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  check("filtered results present", filtered.length > 0, filtered);
  check(
    "category filter excludes chunk-c (manual)",
    !filtered.some((r) => r.chunkKey === "chunk-c"),
    filtered,
  );
  check(
    "category filter includes chunk-a (crawled)",
    filtered.some((r) => r.chunkKey === "chunk-a"),
    filtered,
  );

  console.log(`\n=== 5. generation replacement: re-affirmed chunks survive, dropped ones are correctly removed ===`);
  // chunk-a is re-upserted at gen 2 (its content changed) - it must survive.
  // chunk-b is deliberately NOT re-upserted at gen 2, simulating a chunk that
  // no longer exists on a re-crawled page - per the documented contract
  // (commitGeneration deletes every vector with generation < target,
  // regardless of chunkKey) it must be removed too, not merely "the one
  // vector that changed". An earlier version of this test asserted
  // deletedStaleChunks === 1 here and failed against the live index - that
  // was the test's own wrong assumption, not an adapter bug: both
  // chunk-a@gen1 and chunk-b@gen1 are genuinely < gen 2.
  await store.upsertChunks(ctx, "adapter-test-doc-1", 2, "crawled", [
    { chunkKey: "chunk-a", ordinalWithinHeading: 0, headingPath: ["A"], text: "text-a-v2", embedding: vec(3) },
  ]);
  const commit = await store.commitGeneration(ctx, "adapter-test-doc-1", 2);
  check(
    "commitGeneration deleted BOTH stale gen-1 vectors (chunk-a AND untouched chunk-b)",
    commit.deletedStaleChunks === 2,
    commit,
  );

  let staleGone = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    const stillDense = await store.denseSearch(ctx, vec(1), { topK: 10 });
    // The OLD chunk-a vector (seeded on vec(1)) must be gone, replaced by the
    // gen-2 one (seeded on vec(3)). chunk-b is gone too (see comment above) -
    // that is checked separately, right after this loop.
    const oldAStillMatches = stillDense.some(
      (r) => r.chunkKey === "chunk-a" && r.score > 0.99,
    );
    if (!oldAStillMatches) {
      staleGone = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  const chunkBGone = !(await store.denseSearch(ctx, vec(2), { topK: 10 })).some(
    (r) => r.chunkKey === "chunk-b",
  );
  check("untouched chunk-b was correctly removed as stale (not re-affirmed at gen 2)", chunkBGone);
  check("stale gen-1 chunk-a vector is physically gone after commit", staleGone);

  const newAFound = await store.denseSearch(ctx, vec(3), { topK: 5 });
  check("new gen-2 chunk-a vector is present", newAFound.some((r) => r.chunkKey === "chunk-a"), newAFound);

  console.log(`\n=== 6. lexicalSearch/getChunks are structurally unsupported ===`);
  try {
    await store.lexicalSearch(ctx, "anything", { topK: 5 });
    check("lexicalSearch throws", false);
  } catch {
    check("lexicalSearch throws", true);
  }
  try {
    await store.getChunks(ctx, [{ documentId: "d", chunkKey: "k" }]);
    check("getChunks throws", false);
  } catch {
    check("getChunks throws", true);
  }

  console.log(`\n=== 7. deleteDocument removes everything for a document ===`);
  const del = await store.deleteDocument(ctx, "adapter-test-doc-1");
  // Only chunk-a@gen2 remains at this point - chunk-b was already removed by
  // step 5's commitGeneration (it was never re-affirmed at gen 2).
  check("deleteDocument reports 1 deleted (only chunk-a@gen2 remained)", del.deletedChunks === 1, del);

  let allGone = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    const after = await store.denseSearch(ctx, vec(3), { topK: 10 });
    if (!after.some((r) => r.documentId === "adapter-test-doc-1")) {
      allGone = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  check("no adapter-test-doc-1 chunks remain after delete", allGone);

  console.log(`\n=== 8. stats() reflects the live namespace ===`);
  const stats = await store.stats(ctx);
  check("stats.chunkCount is a number >= 0", typeof stats.chunkCount === "number" && stats.chunkCount >= 0, stats);

  console.log(`\n=== cleanup ===`);
  await store.deleteDocument(ctx, "adapter-test-doc-2");

  console.log(`\n${"=".repeat(60)}`);
  if (failures > 0) {
    console.log(`FAILED: ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("ALL CHECKS PASSED against the live Pinecone index.");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
