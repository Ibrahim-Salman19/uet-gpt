import { describe, expect, it } from "vitest";
import { EMBEDDING_DIMENSION } from "../../convex/embeddings/dimension";
import type { KnowledgeChunkInput, KnowledgeStore } from "../../convex/knowledgeStore/types";

// Shared, backend-agnostic contract test suite (migration brief §7: "deterministic
// contract tests shared by both [adapters]"). Called once per adapter with a
// factory that hands back a fresh, isolated store instance per test. `ctx` is
// passed straight through untouched — the Turso adapter ignores it, a future
// Convex-adapter test file passes a real ActionCtx from its own test harness.

function embedding(seed: number, dim = EMBEDDING_DIMENSION): Float32Array {
  // Deterministic, distinguishable-by-seed vectors - not meant to resemble
  // real Gemini embeddings, just distinct enough for nearest-neighbor checks.
  // Dimension defaults to the REAL production dimension, not an arbitrary
  // small one - Turso/Convex never enforced the declared vector dimension
  // so an earlier, smaller default (8) went unnoticed there for a long
  // time, but Zilliz's schema does enforce it strictly and silently
  // rejects (no thrown exception - a mutation-result error status the
  // adapter wasn't checking) any row whose vector length doesn't match,
  // which surfaced as every downstream read of that chunk correctly
  // reporting "not found" - the chunk was simply never written. Confirmed
  // directly: upserting an 8-dim vector into Zilliz's 768-dim field
  // returns error_code "IllegalArgument", "the length(8) of float data
  // should divide the dim(768)".
  const v = new Float32Array(dim);
  v[seed % dim] = 1;
  return v;
}

function chunk(overrides: Partial<KnowledgeChunkInput> & { chunkKey: string }): KnowledgeChunkInput {
  return {
    ordinalWithinHeading: 0,
    headingPath: ["Overview"],
    text: "default chunk text",
    embedding: embedding(0),
    ...overrides,
  };
}

export function runKnowledgeStoreContractTests(
  backendName: string,
  createStore: () => Promise<{ store: KnowledgeStore; ctx: unknown; cleanup: () => Promise<void> }>,
) {
  describe(`KnowledgeStore contract: ${backendName}`, () => {
    it("fresh ingest: upsertDocument -> upsertChunks -> commitGeneration makes chunks searchable", async () => {
      const { store, ctx, cleanup } = await createStore();
      try {
        const doc = await store.upsertDocument(ctx as never, {
          canonicalUrl: "https://web.uettaxila.edu.pk/admissions",
          title: "Admissions",
          contentHash: "hash-v1",
          indexingFingerprint: "fp-v1",
          category: "crawled",
        });
        expect(doc.fastPathEligible).toBe(false);
        expect(doc.generation).toBe(1);

        await store.upsertChunks(ctx as never, doc.documentId, doc.generation, "crawled", [
          chunk({
            chunkKey: "chunk-fee-structure",
            headingPath: ["Admissions", "Fee Structure"],
            text: "The undergraduate admission fee is 50000 PKR per semester.",
            embedding: embedding(1),
          }),
        ]);
        await store.commitGeneration(ctx as never, doc.documentId, doc.generation);

        const lexical = await store.lexicalSearch(ctx as never, "admission fee", { topK: 5 });
        expect(lexical.some((r) => r.chunkKey === "chunk-fee-structure")).toBe(true);

        const dense = await store.denseSearch(ctx as never, embedding(1), { topK: 5 });
        expect(dense[0]?.chunkKey).toBe("chunk-fee-structure");

        const stats = await store.stats(ctx as never);
        expect(stats.documentCount).toBeGreaterThanOrEqual(1);
        expect(stats.chunkCount).toBeGreaterThanOrEqual(1);
      } finally {
        await cleanup();
      }
    });

    it("identical replay: same contentHash+fingerprint hits the fast path, generation unchanged", async () => {
      const { store, ctx, cleanup } = await createStore();
      try {
        const input = {
          canonicalUrl: "https://web.uettaxila.edu.pk/programs",
          title: "Programs",
          contentHash: "hash-stable",
          indexingFingerprint: "fp-stable",
          category: "crawled",
        };
        const first = await store.upsertDocument(ctx as never, input);
        const second = await store.upsertDocument(ctx as never, input);
        expect(second.fastPathEligible).toBe(true);
        expect(second.documentId).toBe(first.documentId);
        expect(second.generation).toBe(first.generation);
      } finally {
        await cleanup();
      }
    });

    it("changed document: new chunks appear, unchanged-key chunks persist, stale chunks are gone after commitGeneration", async () => {
      const { store, ctx, cleanup } = await createStore();
      try {
        const doc1 = await store.upsertDocument(ctx as never, {
          canonicalUrl: "https://web.uettaxila.edu.pk/faculty",
          title: "Faculty",
          contentHash: "hash-a",
          indexingFingerprint: "fp-v1",
          category: "crawled",
        });
        await store.upsertChunks(ctx as never, doc1.documentId, doc1.generation, "crawled", [
          chunk({ chunkKey: "faculty-stable-slot", text: "unchanged across the edit", embedding: embedding(2) }),
          chunk({ chunkKey: "faculty-removed-slot", text: "this section gets removed", embedding: embedding(3) }),
        ]);
        await store.commitGeneration(ctx as never, doc1.documentId, doc1.generation);

        const doc2 = await store.upsertDocument(ctx as never, {
          canonicalUrl: "https://web.uettaxila.edu.pk/faculty",
          title: "Faculty",
          contentHash: "hash-b", // content changed
          indexingFingerprint: "fp-v1",
          category: "crawled",
        });
        expect(doc2.documentId).toBe(doc1.documentId);
        expect(doc2.generation).toBe(doc1.generation + 1);

        // Re-diff round: same slot key re-upserted (patch in place), removed
        // slot's key is simply not re-upserted, a genuinely new slot is added.
        await store.upsertChunks(ctx as never, doc2.documentId, doc2.generation, "crawled", [
          chunk({ chunkKey: "faculty-stable-slot", text: "unchanged across the edit", embedding: embedding(2) }),
          chunk({ chunkKey: "faculty-new-slot", text: "a newly added section", embedding: embedding(4) }),
        ]);
        const commit = await store.commitGeneration(ctx as never, doc2.documentId, doc2.generation);
        expect(commit.deletedStaleChunks).toBe(1); // faculty-removed-slot

        const remaining = await store.getChunks(ctx as never, [
          { documentId: doc2.documentId, chunkKey: "faculty-stable-slot" },
          { documentId: doc2.documentId, chunkKey: "faculty-removed-slot" },
          { documentId: doc2.documentId, chunkKey: "faculty-new-slot" },
        ]);
        const foundKeys = remaining.map((c) => c.chunkKey).sort();
        expect(foundKeys).toEqual(["faculty-new-slot", "faculty-stable-slot"]);
      } finally {
        await cleanup();
      }
    });

    it("deleteDocument removes chunks from both dense and lexical retrieval", async () => {
      const { store, ctx, cleanup } = await createStore();
      try {
        const doc = await store.upsertDocument(ctx as never, {
          canonicalUrl: "https://web.uettaxila.edu.pk/hostels",
          title: "Hostels",
          contentHash: "hash-1",
          indexingFingerprint: "fp-1",
          category: "crawled",
        });
        await store.upsertChunks(ctx as never, doc.documentId, doc.generation, "crawled", [
          chunk({ chunkKey: "hostel-chunk", text: "hostel transport shuttle schedule", embedding: embedding(5) }),
        ]);
        await store.commitGeneration(ctx as never, doc.documentId, doc.generation);

        const del = await store.deleteDocument(ctx as never, doc.documentId);
        expect(del.deletedChunks).toBe(1);

        const lexical = await store.lexicalSearch(ctx as never, "hostel transport", { topK: 5 });
        expect(lexical.some((r) => r.chunkKey === "hostel-chunk")).toBe(false);
        const dense = await store.denseSearch(ctx as never, embedding(5), { topK: 5 });
        expect(dense.some((r) => r.chunkKey === "hostel-chunk")).toBe(false);
      } finally {
        await cleanup();
      }
    });

    it("chunk keys never collide across two different documents sharing the same heading+ordinal shape", async () => {
      const { store, ctx, cleanup } = await createStore();
      try {
        const docA = await store.upsertDocument(ctx as never, {
          canonicalUrl: "https://web.uettaxila.edu.pk/dept/civil",
          title: "Civil Engineering",
          contentHash: "hash-civil",
          indexingFingerprint: "fp-1",
          category: "crawled",
        });
        const docB = await store.upsertDocument(ctx as never, {
          canonicalUrl: "https://web.uettaxila.edu.pk/dept/electrical",
          title: "Electrical Engineering",
          contentHash: "hash-electrical",
          indexingFingerprint: "fp-1",
          category: "crawled",
        });
        // Real chunk_key derivation (sha256 of chunkingVersion|url|headingPath|ordinal)
        // is the caller's job, not the store's - here we just assert the store
        // itself never conflates two distinct keys even under a generic heading.
        await store.upsertChunks(ctx as never, docA.documentId, docA.generation, "crawled", [
          chunk({ chunkKey: "civil::overview::0", headingPath: ["Overview"], text: "Civil dept overview", embedding: embedding(6) }),
        ]);
        await store.upsertChunks(ctx as never, docB.documentId, docB.generation, "crawled", [
          chunk({ chunkKey: "electrical::overview::0", headingPath: ["Overview"], text: "Electrical dept overview", embedding: embedding(7) }),
        ]);
        await store.commitGeneration(ctx as never, docA.documentId, docA.generation);
        await store.commitGeneration(ctx as never, docB.documentId, docB.generation);

        const integrity = await store.verifyIntegrity(ctx as never);
        expect(integrity.duplicateChunkKeys).toBe(0);
        expect(integrity.crossDocumentChunkKeyCollisions).toBe(0);

        const civilChunk = await store.getChunks(ctx as never, [{ documentId: docA.documentId, chunkKey: "civil::overview::0" }]);
        expect(civilChunk[0]?.documentId).toBe(docA.documentId);
      } finally {
        await cleanup();
      }
    });

    it("lexicalSearch does not throw on FTS operator characters in raw user input", async () => {
      const { store, ctx, cleanup } = await createStore();
      try {
        const doc = await store.upsertDocument(ctx as never, {
          canonicalUrl: "https://web.uettaxila.edu.pk/scholarships",
          title: "Scholarships",
          contentHash: "hash-1",
          indexingFingerprint: "fp-1",
          category: "crawled",
        });
        await store.upsertChunks(ctx as never, doc.documentId, doc.generation, "crawled", [
          chunk({ chunkKey: "scholarship-chunk", text: "need based scholarship eligibility criteria", embedding: embedding(8) }),
        ]);
        await store.commitGeneration(ctx as never, doc.documentId, doc.generation);

        // Raw FTS5 operators (OR, NOT, *, quotes, column filters) must not
        // cause a syntax error or grant query-time operator access.
        for (const hostile of ['scholarship OR NOT *', '"unterminated', "col:injection", "a - b"]) {
          await expect(store.lexicalSearch(ctx as never, hostile, { topK: 5 })).resolves.not.toThrow();
        }
      } finally {
        await cleanup();
      }
    });

    it("denseSearch's category filter excludes chunks from other categories", async () => {
      const { store, ctx, cleanup } = await createStore();
      try {
        const docA = await store.upsertDocument(ctx as never, {
          canonicalUrl: "https://web.uettaxila.edu.pk/filter-test-crawled",
          title: "Filter Test Crawled",
          contentHash: "hash-1",
          indexingFingerprint: "fp-1",
          category: "crawled",
        });
        const docB = await store.upsertDocument(ctx as never, {
          canonicalUrl: "https://web.uettaxila.edu.pk/filter-test-manual",
          title: "Filter Test Manual",
          contentHash: "hash-1",
          indexingFingerprint: "fp-1",
          category: "manual",
        });
        // Same embedding on purpose - without the filter both would tie for
        // first place, so a filter that silently no-ops would still "pass"
        // a weaker test that only checked ordering.
        await store.upsertChunks(ctx as never, docA.documentId, docA.generation, "crawled", [
          chunk({ chunkKey: "filter-test-crawled-chunk", text: "shared searchable content", embedding: embedding(12) }),
        ]);
        await store.upsertChunks(ctx as never, docB.documentId, docB.generation, "manual", [
          chunk({ chunkKey: "filter-test-manual-chunk", text: "shared searchable content", embedding: embedding(12) }),
        ]);
        await store.commitGeneration(ctx as never, docA.documentId, docA.generation);
        await store.commitGeneration(ctx as never, docB.documentId, docB.generation);

        const filtered = await store.denseSearch(ctx as never, embedding(12), {
          topK: 10,
          filter: { category: "crawled" },
        });
        expect(filtered.some((r) => r.chunkKey === "filter-test-crawled-chunk")).toBe(true);
        expect(filtered.some((r) => r.chunkKey === "filter-test-manual-chunk")).toBe(false);

        const unfiltered = await store.denseSearch(ctx as never, embedding(12), { topK: 10 });
        expect(unfiltered.some((r) => r.chunkKey === "filter-test-manual-chunk")).toBe(true);
      } finally {
        await cleanup();
      }
    });

    it("health() reports ok:true against a reachable store", async () => {
      const { store, ctx, cleanup } = await createStore();
      try {
        const result = await store.health(ctx as never);
        expect(result.ok).toBe(true);
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      } finally {
        await cleanup();
      }
    });

    it("interrupted ingest (upsertChunks with no commitGeneration) converges to exactly one authoritative generation after a full retry", async () => {
      const { store, ctx, cleanup } = await createStore();
      try {
        const doc = await store.upsertDocument(ctx as never, {
          canonicalUrl: "https://web.uettaxila.edu.pk/interrupted",
          title: "Interrupted",
          contentHash: "hash-v1",
          indexingFingerprint: "fp-1",
          category: "crawled",
        });
        // Simulates a crash: chunks written for this generation, but the
        // process dies before commitGeneration ever runs - no cleanup, no
        // promotion.
        await store.upsertChunks(ctx as never, doc.documentId, doc.generation, "crawled", [
          chunk({ chunkKey: "interrupted-slot", text: "content from the crashed attempt", embedding: embedding(20) }),
        ]);
        // Never called: await store.commitGeneration(...)

        // Retry from the top, exactly as the real ingestion orchestration
        // would after observing the previous attempt never completed.
        const retryDoc = await store.upsertDocument(ctx as never, {
          canonicalUrl: "https://web.uettaxila.edu.pk/interrupted",
          title: "Interrupted",
          contentHash: "hash-v1", // identical content - this IS what a naive retry re-submits
          indexingFingerprint: "fp-1",
          category: "crawled",
        });
        // Same content as before the crash -> fast path, same generation,
        // no new chunk writes needed; the crashed attempt's chunks (written
        // under this same generation, since upsertDocument never advanced)
        // are simply the authoritative ones already.
        expect(retryDoc.fastPathEligible).toBe(true);
        expect(retryDoc.generation).toBe(doc.generation);

        const chunks = await store.getChunks(ctx as never, [
          { documentId: doc.documentId, chunkKey: "interrupted-slot" },
        ]);
        expect(chunks).toHaveLength(1);
        expect(chunks[0]?.text).toBe("content from the crashed attempt");

        const integrity = await store.verifyIntegrity(ctx as never);
        expect(integrity.duplicateChunkKeys).toBe(0);
      } finally {
        await cleanup();
      }
    });

    it("concurrent re-ingestion of the same changed document never regresses the generation and never leaves a stale-tagged chunk behind", async () => {
      const { store, ctx, cleanup } = await createStore();
      try {
        const initial = await store.upsertDocument(ctx as never, {
          canonicalUrl: "https://web.uettaxila.edu.pk/concurrency-test",
          title: "Concurrency Test",
          contentHash: "hash-v0",
          indexingFingerprint: "fp-1",
          category: "crawled",
        });
        await store.upsertChunks(ctx as never, initial.documentId, initial.generation, "crawled", [
          chunk({ chunkKey: "concurrency-slot", text: "original content", embedding: embedding(9) }),
        ]);
        await store.commitGeneration(ctx as never, initial.documentId, initial.generation);

        // Two concurrent re-ingestion attempts of the SAME document with
        // DIFFERENT new content, raced via Promise.all - exercises
        // upsertDocument's compare-and-swap retry for real, not in isolation.
        const [roundA, roundB] = await Promise.all([
          store.upsertDocument(ctx as never, {
            canonicalUrl: "https://web.uettaxila.edu.pk/concurrency-test",
            title: "Concurrency Test",
            contentHash: "hash-a",
            indexingFingerprint: "fp-1",
            category: "crawled",
          }),
          store.upsertDocument(ctx as never, {
            canonicalUrl: "https://web.uettaxila.edu.pk/concurrency-test",
            title: "Concurrency Test",
            contentHash: "hash-b",
            indexingFingerprint: "fp-1",
            category: "crawled",
          }),
        ]);

        // The core safety property this is testing: two racing rounds must
        // never be assigned the same generation number (that's what would let
        // commitGeneration's fencing conflate two different rounds' chunks).
        expect(roundA.generation).not.toBe(roundB.generation);

        await Promise.all([
          store.upsertChunks(ctx as never, roundA.documentId, roundA.generation, "crawled", [
            chunk({ chunkKey: "concurrency-slot", text: "round A content", embedding: embedding(10) }),
          ]),
          store.upsertChunks(ctx as never, roundB.documentId, roundB.generation, "crawled", [
            chunk({ chunkKey: "concurrency-slot", text: "round B content", embedding: embedding(11) }),
          ]),
        ]);
        await Promise.all([
          store.commitGeneration(ctx as never, roundA.documentId, roundA.generation),
          store.commitGeneration(ctx as never, roundB.documentId, roundB.generation),
        ]);

        // Whichever physically wrote the "concurrency-slot" row last (not
        // necessarily the higher-generation round - upsertChunks itself also
        // raced) is what's left. The guaranteed invariant isn't "which text
        // survives" but that nothing tagged with a stale generation remains
        // searchable, and the generation pointer only ever advanced.
        const finalGeneration = Math.max(roundA.generation, roundB.generation);
        const survivors = await store.getChunks(ctx as never, [
          { documentId: roundA.documentId, chunkKey: "concurrency-slot" },
        ]);
        if (survivors.length > 0) {
          expect(survivors[0]?.ingestionGeneration).toBe(finalGeneration);
        }
        // The original pre-race content must be gone either way.
        const lexical = await store.lexicalSearch(ctx as never, "original content", { topK: 10 });
        expect(lexical.some((r) => r.chunkKey === "concurrency-slot")).toBe(false);

        const integrity = await store.verifyIntegrity(ctx as never);
        expect(integrity.duplicateChunkKeys).toBe(0);
        expect(integrity.crossDocumentChunkKeyCollisions).toBe(0);
      } finally {
        await cleanup();
      }
    });
  });
}
