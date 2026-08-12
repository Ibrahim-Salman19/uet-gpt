// Pure, dependency-free module (mirrors convex/shared/freshnessPolicy.ts): no
// Convex runtime imports, so it is safe to import from queries, mutations,
// actions, chunking.ts, AND unit tests.
//
// Owns two related but distinct identities:
//  - chunkKey: WHERE a chunk lives (structural position). Stable across
//    re-crawls that don't restructure the document, even when the chunk's
//    TEXT changes - so an edit patches the existing crawledChunks row instead
//    of leaking an orphaned one. Two chunks at different positions with
//    byte-identical text get DIFFERENT keys, so duplicate content is stored
//    and retrievable at each position (see Phase 6.21A Part 8: this key is
//    position-stable, not semantic-identity-stable).
//  - indexingFingerprint: WHETHER the pipeline that produced a document's
//    chunks is still current. Two documents with identical source content but
//    different fingerprints (e.g. embedding model changed) must NOT be
//    treated as "unchanged" by the fast path.

import { EMBEDDING_DIMENSION } from "../embeddings/dimension";

// Bump whenever chunkMarkdown's splitting algorithm changes in a way that
// should force existing chunkKeys to be treated as stale, so old positional
// keys never silently collide with keys produced by a different algorithm.
export const CHUNKING_VERSION = 1;

// Parent/child chunk sizing, named so computeIndexingFingerprint hashes the
// real runtime values instead of keeping a second hardcoded copy that could
// drift from what generateChunks (chunking.ts) actually passes to chunkMarkdown.
export const PARENT_CHUNK_SIZE = 3000;
export const PARENT_CHUNK_OVERLAP = 300;
export const CHILD_CHUNK_SIZE = 800;
export const CHILD_CHUNK_OVERLAP = 100;

// Bump whenever buildContextPrefix's TEMPLATE (not its per-document content)
// changes shape, so the fast path knows a pipeline change requires
// reprocessing even though a document's source contentHash is unaffected.
export const CONTEXT_PREFIX_VERSION = 1;

// Must match convex/rag/instance.ts's `modelId` and the literal embeddingModel
// string saveEmbedding stores on crawledChunks. Kept as a separate constant
// (instead of importing rag/instance.ts) so this module stays dependency-free
// - importing the RAG instance would pull in the embedding client + component.
export const EMBEDDING_MODEL_ID = "gemini-embedding-2";

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Structural chunk identity: hash(chunkingVersion | documentUrl | headingPath
 * | ordinal). `ordinalWithinHeading` is the caller-tracked count of chunks
 * already produced under this exact heading breadcrumb, in document order
 * (see generateChunks in chunking.ts).
 *
 * `documentUrl` (the document's canonical URL, stable across re-crawls of
 * the same page and known before generateChunks is called - even for a
 * brand-new document that has no Convex documentId yet) MUST be included.
 * Phase 6.21A's own 199-document real-scale storage run caught this the
 * hard way: an earlier version of this function omitted any document
 * scope, reasoning that crawledChunks' own by_documentId_and_chunkKey
 * compound index would scope it. That reasoning only protects THIS APP'S
 * OWN table - the RAG component's `key` uniqueness (`rag.add({key, ...})`)
 * is scoped to the whole namespace, not per app-level document, so two
 * different documents sharing an identical heading breadcrumb + ordinal
 * (e.g. two pages that both open with "## Overview" as their first
 * section - measured in that run: 664 of 3,906 keys collided this way
 * across just 199 synthetic documents using deliberately generic headings)
 * would silently replace each other's RAG entries: whichever document's
 * embedding landed second would delete the first's vector via the
 * replacedEntry-cleanup path, leaving the first document's crawledChunks
 * row pointing at a ragId that no longer exists. Including documentUrl in
 * the hash makes a same-heading collision between two different documents
 * structurally impossible - the RAG-component key and this app's own
 * (documentId, chunkKey) identity are now scoped consistently.
 */
export async function computeChunkKey(
  documentUrl: string,
  headingPath: string[] | undefined,
  ordinalWithinHeading: number,
): Promise<string> {
  const headingPart = (headingPath ?? []).join(">");
  return sha256Hex(`${CHUNKING_VERSION}|${documentUrl}|${headingPart}|${ordinalWithinHeading}`);
}

/**
 * RAG-component-facing key: chunkKey (the stable structural position, i.e.
 * "baseChunkKey") scoped additionally by document identity and ingestion
 * generation. Two different ingestionGenerations of the SAME logical chunk
 * position get DIFFERENT ragVersionKeys.
 *
 * This closes the stale-generation race that the cross-document collision
 * fix above did not: @convex-dev/rag@0.7.5's own (namespace, key) "replace"
 * semantics - source-verified directly against the installed package
 * (component/entries.js's promoteToReadyHandler and component/helpers.js's
 * getPreviousEntry) - resolve "what entry does a new rag.add() replace"
 * purely by (namespace, key), with NO awareness of which caller is actually
 * newer. Worse, a "ready" entry that later gets replaced fires no
 * onComplete callback to its original owner at all (onComplete only fires
 * during an entry's OWN pending->settled transition), so a stale caller
 * reaching rag.add() after a newer generation has already committed could
 * silently become the canonical entry with no callback ever signaling the
 * newer generation's owner that anything happened. Generation-scoping the
 * key prevents this structurally: a stale generation's rag.add() call can
 * never share a key with a newer generation's entry, so it can never
 * replace it at the RAG-component level, regardless of completion order.
 *
 * documentId is included in addition to baseChunkKey (which already
 * encodes documentUrl - see computeChunkKey above) so that a document
 * deleted and later recreated at the same URL cannot inherit a stale
 * version-key collision window from its previous lifecycle.
 */
export async function computeRagVersionKey(
  baseChunkKey: string,
  documentId: string,
  ingestionGeneration: number,
): Promise<string> {
  return sha256Hex(`${baseChunkKey}|${documentId}|${ingestionGeneration}`);
}

/**
 * Fingerprint of every indexing-pipeline setting whose change requires
 * reprocessing a document even when its source contentHash is unchanged.
 * Deliberately excludes runtime/per-document values (title, URL, crawl
 * timestamp) that must NOT force a rebuild on their own.
 */
export async function computeIndexingFingerprint(): Promise<string> {
  return sha256Hex(
    [
      `chunkingVersion=${CHUNKING_VERSION}`,
      `parentChunkSize=${PARENT_CHUNK_SIZE}`,
      `parentChunkOverlap=${PARENT_CHUNK_OVERLAP}`,
      `childChunkSize=${CHILD_CHUNK_SIZE}`,
      `childChunkOverlap=${CHILD_CHUNK_OVERLAP}`,
      `contextPrefixVersion=${CONTEXT_PREFIX_VERSION}`,
      `embeddingModel=${EMBEDDING_MODEL_ID}`,
      `embeddingDimension=${EMBEDDING_DIMENSION}`,
    ].join("|"),
  );
}
