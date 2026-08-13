import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTursoKnowledgeStore } from "../../convex/knowledgeStore/tursoAdapter";
import { runKnowledgeStoreContractTests } from "./knowledgeStoreContract";

// Runs the shared KnowledgeStore contract against a real libSQL engine in
// local-file mode. Same engine/SQL dialect as Turso Cloud (see
// scripts/turso-capability-check.mjs and tursoSchema.sql's header comment for
// what that equivalence does and doesn't cover) - this is real SQL execution
// against real files, not a mock.

const schemaSql = readFileSync(
  join(__dirname, "../../convex/knowledgeStore/tursoSchema.sql"),
  "utf-8",
);

runKnowledgeStoreContractTests("turso (local file)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "knowledge-store-turso-test-"));
  const dbPath = join(dir, "test.db");
  const client = createClient({ url: `file:${dbPath}` });
  // executeMultiple does its own comment-aware statement splitting - a naive
  // string .split(";") breaks on semicolons that appear inside this file's
  // own `--` comments (this schema's prose has several), so don't do that.
  await client.executeMultiple(schemaSql);

  const store = createTursoKnowledgeStore(client);
  return {
    store,
    ctx: undefined,
    cleanup: async () => {
      client.close();
      for (const suffix of ["", "-wal", "-shm"]) {
        if (existsSync(dbPath + suffix)) rmSync(dbPath + suffix);
      }
      rmSync(dir, { recursive: true, force: true });
    },
  };
});

// Turso-specific (not part of the shared contract suite: chunk_key is a
// global PRIMARY KEY only on this backend - Convex's crawledChunks scopes by
// a compound (documentId, chunkKey) index instead, so the same string under
// two documentIds there just makes two independent rows, nothing to stress).
//
// computeChunkKey's sha256(chunkingVersion|documentUrl|headingPath|ordinal)
// makes a real cross-document collision cryptographically impossible in
// practice (see tursoSchema.sql's chunk_key comment) - verifyIntegrity
// hardcodes crossDocumentChunkKeyCollisions to 0 "by construction, not by a
// runtime check" for exactly this reason, so it cannot catch a violation
// after the fact. This test instead locks in what upsertChunks itself does
// if that invariant is ever violated (a bug upstream, a truncated/adversarial
// key, etc.): the ON CONFLICT(chunk_key) upsert must move the row's
// document_id along with every other column, not just silently keep the
// first writer's document_id while the row's content flips underneath it.
describe("turso: chunk_key primary-key upsert consistency", () => {
  it("upserting the same chunk_key under a different documentId repoints document_id too, not just the content columns", async () => {
    const dir = mkdtempSync(join(tmpdir(), "knowledge-store-turso-collision-test-"));
    const dbPath = join(dir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(schemaSql);
    try {
      const store = createTursoKnowledgeStore(client);
      const docA = await store.upsertDocument(undefined as never, {
        canonicalUrl: "https://web.uettaxila.edu.pk/collision-a",
        title: "Collision A",
        contentHash: "hash-a",
        indexingFingerprint: "fp-1",
        category: "crawled",
      });
      const docB = await store.upsertDocument(undefined as never, {
        canonicalUrl: "https://web.uettaxila.edu.pk/collision-b",
        title: "Collision B",
        contentHash: "hash-b",
        indexingFingerprint: "fp-1",
        category: "crawled",
      });

      const sharedKey = "deliberately-forced-shared-chunk-key";
      const embedding = new Float32Array(8);
      embedding[1] = 1;
      await store.upsertChunks(undefined as never, docA.documentId, docA.generation, "crawled", [
        { chunkKey: sharedKey, ordinalWithinHeading: 0, headingPath: ["Overview"], text: "from document A", embedding },
      ]);
      // Same primary key, different owning document - the scenario
      // computeChunkKey's hash construction is supposed to make impossible.
      await store.upsertChunks(undefined as never, docB.documentId, docB.generation, "crawled", [
        { chunkKey: sharedKey, ordinalWithinHeading: 0, headingPath: ["Overview"], text: "from document B", embedding },
      ]);

      const rows = await store.getChunks(undefined as never, [
        { documentId: docB.documentId, chunkKey: sharedKey },
      ]);
      expect(rows).toHaveLength(1);
      // The invariant under test: document_id and text must agree on which
      // writer won. A row reporting docB's text but docA's documentId (or
      // vice versa) would mean a caller could show document B's content
      // under document A's citation, or delete document A and silently take
      // document B's chunk with it.
      expect(rows[0]?.text).toBe("from document B");
      expect(rows[0]?.documentId).toBe(docB.documentId);
    } finally {
      client.close();
      for (const suffix of ["", "-wal", "-shm"]) {
        if (existsSync(dbPath + suffix)) rmSync(dbPath + suffix);
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
