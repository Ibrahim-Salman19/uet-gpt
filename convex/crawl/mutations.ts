import { vOnCompleteArgs } from "@convex-dev/workpool";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import { rag } from "../rag/instance";
import { isPdfVirtualUrl, sha256 } from "./chunking";
import { computeIndexingFingerprint, EMBEDDING_MODEL_ID } from "./chunkKey";
import { embeddingPool } from "./workpools";

// Phase 6.21A Part 10: every real or synthetic document observed in this
// corpus's sizing reconciliation tops out at a few hundred chunks (see
// docs referenced in the Phase 6.21A final report). 5000 is a generous
// ceiling - reaching it would require a single document producing an order
// of magnitude more chunks than anything this pipeline has ever chunked.
// Guards the accumulation below rather than the surrounding mutation's total
// transaction budget, which Convex enforces independently regardless of how
// the rows are read.
const MAX_CHUNKS_PER_DOCUMENT_SYNC = 5000;

async function getAllChunksByDocumentId(
  ctx: MutationCtx,
  documentId: Id<"documents">,
): Promise<Doc<"crawledChunks">[]> {
  // Phase 6.21A Part 10: replaced a manual `while (!done) { .paginate() }`
  // accumulation loop with the Convex-recommended `for await` async
  // iteration (convex/_generated/ai/guidelines.md, "Query guidelines": don't
  // manually drive .collect()/.take() via repeated calls in async
  // iteration - use `for await`). The explicit ceiling below turns runaway
  // growth into a loud, immediate error instead of an ever-growing
  // in-memory accumulation with no bound.
  const chunks: Doc<"crawledChunks">[] = [];
  const query = ctx.db
    .query("crawledChunks")
    .withIndex("by_documentId", (q) => q.eq("documentId", documentId));
  for await (const chunk of query) {
    chunks.push(chunk);
    if (chunks.length > MAX_CHUNKS_PER_DOCUMENT_SYNC) {
      throw new Error(
        `Document ${documentId} has more than ${MAX_CHUNKS_PER_DOCUMENT_SYNC} crawledChunks ` +
          "rows; synchronous diff/replace is unsafe at this scale and exceeds every real or " +
          "synthetic document size observed in this corpus. Investigate before raising this ceiling.",
      );
    }
  }
  return chunks;
}

/**
 * Bounded count of crawledChunks rows currently stored for a document.
 * Used only at the moment a generation's expected chunk count has
 * apparently been reached (Phase 6.21A Part 6 completion contract), as an
 * independent cross-check against the chunksEmbedded counter before
 * committing to "indexed". Shares the same ceiling/rationale as
 * getAllChunksByDocumentId above; a document that trips the ceiling here
 * throws rather than silently under-counting.
 */
async function countChunksByDocumentId(
  ctx: MutationCtx,
  documentId: Id<"documents">,
): Promise<number> {
  let count = 0;
  const query = ctx.db
    .query("crawledChunks")
    .withIndex("by_documentId", (q) => q.eq("documentId", documentId));
  for await (const _chunk of query) {
    count++;
    if (count > MAX_CHUNKS_PER_DOCUMENT_SYNC) {
      throw new Error(
        `Document ${documentId} has more than ${MAX_CHUNKS_PER_DOCUMENT_SYNC} crawledChunks rows.`,
      );
    }
  }
  return count;
}

function buildMetadataPatch(
  lastModified?: string,
  etag?: string,
): Record<string, string> | undefined {
  const meta: Record<string, string> = {};
  if (lastModified !== undefined) meta.lastModified = lastModified;
  if (etag !== undefined) meta.etag = etag;
  return Object.keys(meta).length > 0 ? meta : undefined;
}

type ChunkInput = {
  text: string;
  contentHash: string;
  chunkKey: string;
  parentContentHash?: string;
  parentId?: Id<"chunkParents">;
  headingPath?: string[];
};

type ParentInput = {
  contentHash: string;
  text: string;
};

// WS-1: upsert each distinct parent ONCE into chunkParents (dedup by
// documentId + contentHash) and resolve each child's parentContentHash → parentId.
// Returns a map from parent contentHash → chunkParents id so children can be
// built with a normalized reference instead of duplicated parentText.
async function upsertParentsAndResolve(
  ctx: MutationCtx,
  docId: Id<"documents">,
  parents: ParentInput[],
): Promise<Map<string, Id<"chunkParents">>> {
  const parentIdByHash = new Map<string, Id<"chunkParents">>();
  // Dedup parents by contentHash within this call (a doc may repeat parents).
  const distinct = new Map<string, string>(parents.map((p) => [p.contentHash, p.text]));
  for (const [contentHash, text] of distinct) {
    const existing = await ctx.db
      .query("chunkParents")
      .withIndex("by_documentId_and_contentHash", (q) =>
        q.eq("documentId", docId).eq("contentHash", contentHash),
      )
      .first();
    if (existing) {
      parentIdByHash.set(contentHash, existing._id);
    } else {
      const id = await ctx.db.insert("chunkParents", {
        documentId: docId,
        contentHash,
        text,
      });
      parentIdByHash.set(contentHash, id);
    }
  }
  return parentIdByHash;
}

// WS-1: delete chunkParents rows whose contentHash no longer appears in any
// new child for this document (i.e. the parent itself was dropped on re-crawl).
// Scoped by documentId so it stays cheap. Called after the child diff.
async function deleteStaleParents(
  ctx: MutationCtx,
  docId: Id<"documents">,
  survivingParentHashes: Set<string>,
): Promise<number> {
  let deleted = 0;
  const existingParents = await ctx.db
    .query("chunkParents")
    .withIndex("by_documentId", (q) => q.eq("documentId", docId))
    .collect();
  for (const parent of existingParents) {
    if (!survivingParentHashes.has(parent.contentHash)) {
      await ctx.db.delete(parent._id);
      deleted++;
    }
  }
  return deleted;
}

/**
 * Phase 6.21A Part 2/8: diffs by chunkKey (structural position), not
 * contentHash. A chunkKey present in both old and new sets with the SAME
 * contentHash is genuinely unchanged (pre-credited, never re-embedded). A
 * chunkKey present in both with a DIFFERENT contentHash is a same-position
 * edit - queued for embedding, and saveEmbedding patches the existing row
 * in place rather than leaking an orphan. A chunkKey with no prior row is a
 * new position. An old row whose chunkKey no longer appears is stale and
 * deleted (its RAG entry AND its crawledChunks row).
 *
 * Legacy rows written before chunkKey existed (chunkKey === undefined) can't
 * be matched positionally; they are treated as stale so a real re-crawl
 * naturally migrates the document off contentHash-only identity, without a
 * forced backfill (same convention as parentText's lazy migration below).
 */
async function diffAndDeleteStaleChunks(
  ctx: MutationCtx,
  existingChunks: Doc<"crawledChunks">[],
  chunks: ChunkInput[],
  url: string,
): Promise<{
  chunksToEmbed: ChunkInput[];
  chunksToDelete: Doc<"crawledChunks">[];
  unchangedCount: number;
}> {
  const existingByKey = new Map(
    existingChunks.filter((c) => c.chunkKey !== undefined).map((c) => [c.chunkKey!, c]),
  );
  const newKeySet = new Set(chunks.map((c) => c.chunkKey));
  const legacyRows = existingChunks.filter((c) => c.chunkKey === undefined);

  const chunksToEmbed = chunks.filter((nc) => {
    const existingRow = existingByKey.get(nc.chunkKey);
    return !existingRow || existingRow.contentHash !== nc.contentHash;
  });
  const unchangedCount = chunks.length - chunksToEmbed.length;
  const chunksToDelete = [
    ...legacyRows,
    ...existingChunks.filter((ec) => ec.chunkKey !== undefined && !newKeySet.has(ec.chunkKey)),
  ];

  await Promise.all(
    chunksToDelete.map(async (staleChunk) => {
      try {
        await rag.deleteAsync(ctx, {
          entryId: staleChunk.ragId as unknown as import("@convex-dev/rag").EntryId,
        });
        await ctx.db.delete(staleChunk._id);
      } catch (err) {
        console.warn(`Failed to delete vector ${staleChunk.ragId} from RAG during re-embed:`, err);
      }
    }),
  );

  console.log(
    `Chunk Diff for ${url}: ${chunksToEmbed.length} new/changed chunks, ` +
      `${unchangedCount} unchanged (pre-credited), ${chunksToDelete.length} deleted chunks`,
  );

  return { chunksToEmbed, chunksToDelete, unchangedCount };
}

async function enqueueNewChunks(
  ctx: MutationCtx,
  docId: Id<"documents">,
  url: string,
  chunksToEmbed: ChunkInput[],
  jobId: string,
  ingestionGeneration: number,
): Promise<void> {
  if (chunksToEmbed.length === 0) return;

  const { namespaceId } = await rag.getOrCreateNamespace(ctx, {
    namespace: "uet-global",
  });
  const namespaceIdStr = namespaceId as unknown as string;

  const argsArray = chunksToEmbed.map((chunk) => ({
    documentId: docId,
    url,
    chunkText: chunk.text,
    contentHash: chunk.contentHash,
    chunkKey: chunk.chunkKey,
    ingestionGeneration,
    jobId,
    parentId: chunk.parentId,
    headingPath: chunk.headingPath,
    namespaceId: namespaceIdStr,
  }));

  await embeddingPool.enqueueActionBatch(ctx, internal.crawl.actions.embedSingleChunk, argsArray, {
    onComplete: internal.crawl.mutations.onChunkEmbedded,
    context: { jobId, documentId: docId, url, ingestionGeneration },
  });
}

async function upsertDocumentForCrawl(
  ctx: MutationCtx,
  url: string,
  title: string,
  contentHash: string,
  indexingFingerprint: string,
  ingestionGeneration: number,
  freshnessTier: "high" | "medium" | "low" | undefined,
  lastModified: string | undefined,
  etag: string | undefined,
  existing: Doc<"documents"> | null,
): Promise<Id<"documents">> {
  if (existing) {
    const metadataPatch = buildMetadataPatch(lastModified, etag);
    await ctx.db.patch(existing._id, {
      contentHash,
      indexingFingerprint,
      ingestionGeneration,
      crawledAt: Date.now(),
      updatedAt: Date.now(),
      status: "processing",
      // chunksEmbedded is intentionally NOT reset here - the caller
      // (queueChunksForEmbedding) sets it once, after the diff is known, to
      // the correct pre-credited value (Phase 6.21A Part 2's "unchanged-chunk
      // progress pre-credit"). Writing 0 here first would just be overwritten.
      ...(metadataPatch ? { metadata: { ...existing.metadata, ...metadataPatch } } : {}),
    });
    return existing._id;
  }

  let sourceHost: string;
  try {
    sourceHost = isPdfVirtualUrl(url) ? "pdf" : new URL(url).hostname;
  } catch {
    sourceHost = "unknown";
  }
  const metadata = buildMetadataPatch(lastModified, etag);
  return await ctx.db.insert("documents", {
    url,
    title,
    source: sourceHost,
    category: "crawled",
    contentHash,
    indexingFingerprint,
    ingestionGeneration,
    freshnessTier,
    status: "processing",
    crawledAt: Date.now(),
    updatedAt: Date.now(),
    ...(metadata ? { metadata } : {}),
  });
}

export const getProcessedWebhook = internalQuery({
  args: { jobId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("processedWebhooks")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .first();
  },
});

export const markWebhookProcessed = internalMutation({
  args: { jobId: v.string(), expiresAt: v.optional(v.number()) },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("processedWebhooks")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .first();
    if (existing) return false;

    await ctx.db.insert("processedWebhooks", {
      jobId: args.jobId,
      processedAt: Date.now(),
      expiresAt: args.expiresAt ?? Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
    return true;
  },
});

/**
 * Compensating action for the webhook dedup marker. If processing fails after the
 * `processedWebhooks` row was inserted, we delete that row so the crawler's retried
 * (at-least-once) delivery is reprocessed instead of being silently swallowed as a
 * duplicate. Per-document/per-chunk content-hash idempotency makes reprocessing safe.
 */
export const unmarkWebhookProcessed = internalMutation({
  args: { jobId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("processedWebhooks")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .first();
    if (!existing) return false;
    await ctx.db.delete(existing._id);
    return true;
  },
});

export const queueChunksForEmbedding = internalMutation({
  args: {
    url: v.string(),
    title: v.string(),
    contentHash: v.string(),
    freshnessTier: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
    jobId: v.string(),
    etag: v.optional(v.string()),
    lastModified: v.optional(v.string()),
    // WS-1: generateChunks now returns parents (stored once) + children (carry
    // parentContentHash). The mutation resolves parentContentHash → parentId.
    parents: v.array(
      v.object({
        contentHash: v.string(),
        text: v.string(),
      }),
    ),
    children: v.array(
      v.object({
        text: v.string(),
        contentHash: v.string(),
        // Phase 6.21A Part 2/8: structural position identity - see
        // computeChunkKey in crawl/chunkKey.ts.
        chunkKey: v.string(),
        parentContentHash: v.string(),
        headingPath: v.optional(v.array(v.string())),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { url, title, contentHash, freshnessTier, etag, lastModified, parents, children } = args;

    const existing = await ctx.db
      .query("documents")
      .withIndex("by_url", (q) => q.eq("url", url))
      .unique();

    // Phase 6.21A Part 7: the fast path requires BOTH contentHash AND
    // indexingFingerprint to match. A pipeline change (chunking version,
    // embedding model/dimensions, context-prefix template, etc.) with
    // unchanged source content must still force a rebuild instead of being
    // silently skipped - a legacy row with no stored fingerprint never
    // matches, so it gets exactly one forced rebuild the first time it is
    // re-ingested under the new code.
    const currentFingerprint = await computeIndexingFingerprint();
    if (
      existing &&
      existing.contentHash === contentHash &&
      existing.indexingFingerprint === currentFingerprint
    ) {
      console.log(`Document unchanged (Fast Path): ${url}`);
      const metadata = buildMetadataPatch(lastModified, etag);
      await ctx.db.patch(existing._id, {
        crawledAt: Date.now(),
        updatedAt: Date.now(),
        status: "indexed",
        ...(metadata ? { metadata } : {}),
      });
      return { status: "unchanged", chunksQueued: 0 };
    }

    // Phase 6.21A Part 4/5: a new ingestion round always begins here,
    // immediately - never deferred or silently dropped, even if a previous
    // round for this same document is still mid-flight
    // (existing?.status === "processing"). The generation number is the
    // single source of truth for "which round is canonical"; saveEmbedding
    // and checkDocumentForFailure fence out any straggling completion from
    // an older generation. This is a deliberate design choice: the installed
    // @convex-dev/workpool has no keyed-serialization primitive (verified
    // against node_modules/@convex-dev/workpool's type definitions), and
    // blocking this mutation/webhook handler on a prior round's async
    // embedding work would be operationally harmful. See the Phase 6.21A
    // final report's "Generation model" section for the full rationale.
    const newGeneration = (existing?.ingestionGeneration ?? 0) + 1;

    const docId = await upsertDocumentForCrawl(
      ctx,
      url,
      title,
      contentHash,
      currentFingerprint,
      newGeneration,
      freshnessTier,
      lastModified,
      etag,
      existing,
    );

    // WS-1: upsert each parent ONCE, resolve parentContentHash → parentId.
    const parentIdByHash = await upsertParentsAndResolve(ctx, docId, parents);
    const resolvedChildren: ChunkInput[] = children.map((c) => ({
      text: c.text,
      contentHash: c.contentHash,
      chunkKey: c.chunkKey,
      parentContentHash: c.parentContentHash,
      parentId: parentIdByHash.get(c.parentContentHash),
      headingPath: c.headingPath,
    }));

    const existingChunks = existing ? await getAllChunksByDocumentId(ctx, existing._id) : [];
    const { chunksToEmbed, chunksToDelete, unchangedCount } = await diffAndDeleteStaleChunks(
      ctx,
      existingChunks,
      resolvedChildren,
      url,
    );

    await enqueueNewChunks(ctx, docId, url, chunksToEmbed, args.jobId, newGeneration);

    // WS-1: drop parents whose contentHash no longer appears among surviving children.
    const survivingParentHashes = new Set(
      resolvedChildren.map((c) => c.parentContentHash).filter((h): h is string => !!h),
    );
    await deleteStaleParents(ctx, docId, survivingParentHashes);

    // Phase 6.21A Part 2: unchanged-chunk progress pre-credit. Chunks whose
    // chunkKey+contentHash both matched need no embedding work this round,
    // so they never flow through saveEmbedding's increment - pre-seed the
    // counter with their count now so a round where every remaining chunk
    // is genuinely unchanged (only the document-level trigger fired, e.g. a
    // metadata-only republish) still reaches "indexed" correctly.
    await ctx.db.patch(docId, {
      chunkCount: children.length,
      chunksEmbedded: unchangedCount,
      status: chunksToEmbed.length === 0 ? "indexed" : "processing",
    });

    return {
      status: "updated",
      chunksQueued: chunksToEmbed.length,
      chunksDeleted: chunksToDelete.length,
    };
  },
});

/**
 * Phase 6.21A Part 6 completion contract. chunksEmbedded is pre-seeded (see
 * queueChunksForEmbedding) with the count of chunks that needed no write
 * this round, then incremented exactly once per DISTINCT chunkKey actually
 * written by saveEmbedding (every early-return path in saveEmbedding
 * returns before reaching this helper, so retries/duplicates/stale
 * generations never double-count - this is what closes the Phase 6.11-6.20
 * chunksEmbedded-overcounting finding). When the running count first
 * reaches chunkCount, this cross-checks against the REAL row count before
 * committing to "indexed" rather than trusting the counter alone.
 */
async function bumpDocumentProgress(
  ctx: MutationCtx,
  documentId: Id<"documents">,
  doc: Doc<"documents">,
  ingestionGeneration: number,
): Promise<void> {
  const newCount = (doc.chunksEmbedded || 0) + 1;
  const updates: Partial<Doc<"documents">> = { chunksEmbedded: newCount };

  if (doc.chunkCount !== undefined && newCount >= doc.chunkCount && doc.status !== "indexed") {
    // Bounded re-verification, not a hot-path scan: this only runs at the
    // moment the counter APPEARS to have reached completion (typically the
    // last one or two chunks of a document), not on every chunk save - a
    // narrower cost than the DLQ-scan pattern deliberately avoided above in
    // checkDocumentForFailure.
    const actualRowCount = await countChunksByDocumentId(ctx, documentId);
    if (actualRowCount === doc.chunkCount) {
      updates.status = "indexed";
      updates.updatedAt = Date.now();
    } else {
      console.warn(
        `Document ${documentId} generation ${ingestionGeneration}: chunksEmbedded counter ` +
          `(${newCount}) reached chunkCount (${doc.chunkCount}) but actual row count is ` +
          `${actualRowCount}; deferring "indexed" transition.`,
      );
    }
  }
  await ctx.db.patch(documentId, updates);
}

export const stagePendingChunkText = internalMutation({
  args: { ragVersionKey: v.string(), chunkText: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("pendingChunkText", args);
  },
});

async function deletePendingChunkTextImpl(ctx: MutationCtx, ragVersionKey: string): Promise<void> {
  const rows = await ctx.db
    .query("pendingChunkText")
    .withIndex("by_ragVersionKey", (q) => q.eq("ragVersionKey", ragVersionKey))
    .collect();
  await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
}

/**
 * The single commit primitive for "this RAG entry is confirmed
 * current-generation, make it the active one for baseChunkKey." Called from
 * exactly two places - onRagEntryComplete's current-generation branch below,
 * and embedSingleChunk's created:false fallback (actions.ts) - both of
 * which have ALREADY established that ingestionGeneration is current and
 * that any replacedEntry was safe to discard (or there was none) before
 * reaching here. This function does no generation checking of its own; by
 * the time it is called that decision has already been made upstream. This
 * replaces the old saveEmbedding, which made BOTH decisions itself - stale
 * generations reached the SAME unconditional replacedEntryId cleanup as
 * current ones, which is exactly the ordering that let a stale generation's
 * rag.add() call physically delete a newer generation's already-committed
 * RAG entry (see chunkKey.ts's computeRagVersionKey for the full
 * source-verified rationale).
 */
async function commitCurrentGenerationChunkImpl(
  ctx: MutationCtx,
  args: {
    documentId: Id<"documents">;
    baseChunkKey: string;
    ingestionGeneration: number;
    contentHash: string;
    chunkText: string;
    ragId: string;
    parentId?: Id<"chunkParents">;
    headingPath?: string[];
  },
): Promise<void> {
  // Idempotency no-op: ragVersionKey's generation-scoping plus RAG's own
  // (namespace, key) contentHash dedup already prevent a genuine duplicate
  // vector from being created for a true retry (source-verified against
  // component/entries.js's findExistingEntry+entryIsSame), but a stray
  // double-call of this primitive for the same already-committed ragId must
  // still not double-write or double-credit progress.
  const existingByRagId = await ctx.db
    .query("crawledChunks")
    .withIndex("by_ragId", (q) => q.eq("ragId", args.ragId))
    .first();
  if (existingByRagId) return;

  const doc = await ctx.db.get(args.documentId);

  // Stale-generation guard: embedSingleChunk's created:false fast-dedup
  // fallback (actions.ts) calls this primitive directly, WITHOUT going
  // through onRagEntryComplete's own generation fence, because created:false
  // never invokes onComplete at all (source-verified against
  // component/entries.js). A caller whose ragVersionKey already has a ready
  // entry from an earlier same-generation commit can therefore reach here
  // for a generation that is no longer current (retry-storm race: Test B,
  // 25 stale + 25 current concurrent retries). args.ragId here is a
  // PRE-EXISTING entry this call does not own - possibly still shared with
  // other same-generation retries in flight - so the correct action on
  // staleness is to touch nothing at all (not even delete args.ragId),
  // mirroring onRagEntryComplete's own "do NOT patch crawledChunks, do NOT
  // bump progress" stale-generation rule.
  if (!doc || doc.ingestionGeneration !== args.ingestionGeneration) {
    console.warn(
      `Stale commitCurrentGenerationChunk ignored for document ${args.documentId}: ` +
        `call generation ${args.ingestionGeneration} != current ${doc?.ingestionGeneration ?? "(deleted)"}.`,
    );
    return;
  }

  // Phase 6.21A Part 2/8 (preserved): chunk identity lookup by structural
  // position (baseChunkKey), not contentHash - two different positions with
  // byte-identical text (T7) must both get their own row.
  const existingByKey = await ctx.db
    .query("crawledChunks")
    .withIndex("by_documentId_and_chunkKey", (q) =>
      q.eq("documentId", args.documentId).eq("chunkKey", args.baseChunkKey),
    )
    .first();

  // Generation-scoped ragVersionKeys mean two DIFFERENT generations' entries
  // never share a RAG-component key, so RAG's own replace-by-key mechanism
  // never sees them as related and never produces a replacedEntry for this
  // case (onRagEntryComplete's replacedEntry cleanup only ever sees a prior
  // attempt at the SAME generation, since only same-generation retries share
  // a key). Whenever this commit is about to repoint an existing row at a
  // DIFFERENT generation's entry, the row's old ragId is therefore an
  // orphan-to-be unless explicitly retired here - nothing else ever will.
  async function retireSupersededCrossGenerationVector(oldRow: Doc<"crawledChunks">) {
    if (oldRow.ragId === args.ragId || oldRow.ingestionGeneration === args.ingestionGeneration) {
      return;
    }
    try {
      await rag.deleteAsync(ctx, {
        entryId: oldRow.ragId as unknown as import("@convex-dev/rag").EntryId,
      });
    } catch (err) {
      console.warn(`Failed to delete superseded cross-generation vector ${oldRow.ragId}:`, err);
    }
  }

  if (existingByKey && existingByKey.contentHash === args.contentHash) {
    if (existingByKey.ingestionGeneration === args.ingestionGeneration) {
      // Already credited THIS generation's progress for this position - but
      // existingByKey.ragId can still be STALE (retry-storm race: many
      // concurrent rag.add() calls at one brand-new ragVersionKey can create
      // several pending entries that chain-promote - RAG's own
      // promoteToReadyHandler unconditionally marks whatever is CURRENTLY
      // ready as replaced with zero awareness of crawledChunks, source-
      // verified against component/entries.js). The row was last patched by
      // an EARLIER entry in that same-generation chain; that entry has since
      // been superseded and deleted via its own onComplete (status:
      // "replaced" branch above), while args.ragId (this call's own entry)
      // is the currently-alive survivor. The existingByRagId check at the
      // top of this function already proves existingByKey.ragId !==
      // args.ragId whenever we reach here, so repoint unconditionally - no
      // retireSupersededCrossGenerationVector call needed, since the OLD
      // same-key entry's cleanup is already guaranteed by its own onComplete
      // independent of this patch, and do NOT bump progress again (this
      // position was already credited earlier in the chain).
      if (existingByKey.ragId !== args.ragId) {
        await ctx.db.patch(existingByKey._id, { ragId: args.ragId });
      }
      return;
    }
    // A DIFFERENT (older) generation already wrote this exact value - this
    // round's diff independently re-derived identical content for this
    // position. Adopt the row into the current generation (and its new
    // ragId) so this position gets credited instead of leaving the counter
    // permanently short of chunkCount.
    await retireSupersededCrossGenerationVector(existingByKey);
    await ctx.db.patch(existingByKey._id, {
      ingestionGeneration: args.ingestionGeneration,
      ragId: args.ragId,
    });
    if (doc) await bumpDocumentProgress(ctx, args.documentId, doc, args.ingestionGeneration);
    return;
  }

  if (existingByKey) {
    // Same position, DIFFERENT value: patch in place instead of leaving the
    // old row and creating a second one at the same logical position.
    await retireSupersededCrossGenerationVector(existingByKey);
    await ctx.db.patch(existingByKey._id, {
      contentHash: args.contentHash,
      text: args.chunkText,
      ragId: args.ragId,
      embeddingModel: EMBEDDING_MODEL_ID,
      parentId: args.parentId,
      headingPath: args.headingPath,
      ingestionGeneration: args.ingestionGeneration,
    });
  } else {
    await ctx.db.insert("crawledChunks", {
      documentId: args.documentId,
      contentHash: args.contentHash,
      text: args.chunkText,
      ragId: args.ragId,
      embeddingModel: EMBEDDING_MODEL_ID,
      parentId: args.parentId,
      headingPath: args.headingPath,
      chunkKey: args.baseChunkKey,
      ingestionGeneration: args.ingestionGeneration,
    });
  }

  if (doc) {
    await bumpDocumentProgress(ctx, args.documentId, doc, args.ingestionGeneration);
  }
}

export const commitCurrentGenerationChunk = internalMutation({
  args: {
    documentId: v.id("documents"),
    baseChunkKey: v.string(),
    ingestionGeneration: v.number(),
    contentHash: v.string(),
    chunkText: v.string(),
    ragId: v.string(),
    parentId: v.optional(v.id("chunkParents")),
    headingPath: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await commitCurrentGenerationChunkImpl(ctx, args);
  },
});

/**
 * The canonical commit boundary for the RAG lifecycle (stale rag.add race
 * remediation). Registered as rag.add()'s onComplete - fires whenever an
 * entry leaves "pending", whether it becomes "ready" or gets "replaced"
 * along the way (see the OnComplete JSDoc in
 * node_modules/@convex-dev/rag/dist/client/index.d.ts) - including for
 * OTHER entries this call's own rag.add() replaces while still pending
 * (source-verified against component/entries.js's promoteToReadyHandler).
 * This is now the ONLY place that decides whether a RAG entry becomes the
 * active one for its baseChunkKey; embedSingleChunk (actions.ts) no longer
 * makes that decision itself except for the contentHash fast-dedup path
 * (created: false), which routes through the SAME commitCurrentGenerationChunk
 * primitive below rather than a competing implementation.
 *
 * Because the RAG-facing key (ragVersionKey - see computeRagVersionKey in
 * chunkKey.ts) is generation-scoped, replacedEntry here can ONLY ever be a
 * prior attempt at THIS SAME generation (a different generation could never
 * have shared this key), and a stale generation's own entry can never be
 * the one crawledChunks currently points at for the CURRENT generation -
 * deleting it is always safe.
 */
export const onRagEntryComplete = rag.defineOnComplete(async (ctx: MutationCtx, args) => {
  const { entry, replacedEntry, error } = args;
  const ragVersionKey = entry.key ?? "";

  if (error) {
    // Error path: never leave a failed entry (and its own vector rows)
    // permanently behind. Deliberately does NOT touch pendingChunkText
    // (retry-storm race): ragVersionKey is shared by every concurrent
    // attempt at this exact (position, generation) - another still-in-flight
    // sibling may be the one that eventually reaches "ready" and needs the
    // SAME staged row to commit from. Only the successful commit path below
    // (which has proven this ragVersionKey is fully settled, since no future
    // commit will ever be attempted again for it) is safe to clean it up.
    try {
      await rag.deleteAsync(ctx, { entryId: entry.entryId });
    } catch (err) {
      console.warn(`Failed to delete errored RAG entry ${entry.entryId}:`, err);
    }
    return;
  }

  if (entry.status === "replaced") {
    // This exact entry lost a same-generation promotion race (a CONCURRENT
    // retry of the identical ragVersionKey got promoted first and swept
    // this one from "pending" straight to "replaced" - source-verified
    // against component/entries.js's promoteToReadyHandler, which fires
    // onComplete for swept pending entries too, with their OWN now-replaced
    // state as `entry` and `replacedEntry: null`). It can never be the
    // entry crawledChunks currently points at (nothing ever committed a
    // not-yet-ready entry), so there is nothing to fence by generation -
    // just retire it. Whichever retry DID win gets its own onComplete call
    // with status "ready", which is what actually commits.
    // Deliberately does NOT touch pendingChunkText - see the error path's
    // comment above for why (the entry that DID win this same-key race may
    // still need the shared staged row to commit from).
    try {
      await rag.deleteAsync(ctx, { entryId: entry.entryId });
    } catch (err) {
      console.warn(`Failed to delete swept same-generation entry ${entry.entryId}:`, err);
    }
    return;
  }

  // Only "ready" remains (onComplete only fires for a pending->ready or
  // pending->replaced transition, never while still "pending").
  const metadata = (entry.metadata ?? {}) as {
    documentId?: Id<"documents">;
    baseChunkKey?: string;
    ingestionGeneration?: number;
    parentId?: Id<"chunkParents"> | "";
    headingPath?: string[];
  };
  const { documentId, baseChunkKey, ingestionGeneration } = metadata;

  if (documentId === undefined || baseChunkKey === undefined || ingestionGeneration === undefined) {
    // Cannot safely act without identity - embedSingleChunk always attaches
    // this metadata before calling rag.add(), so this should never happen.
    // Surface it loudly rather than guessing, and do NOT delete an entry we
    // cannot prove ownership of (Part 8's own caution) - it is "ready" and
    // stays retrievable, just not linked into crawledChunks.
    console.error("onRagEntryComplete: entry missing required identity metadata", {
      entryId: entry.entryId,
      metadata: entry.metadata,
    });
    return;
  }

  const doc = await ctx.db.get(documentId);
  const currentGeneration = doc?.ingestionGeneration ?? 0;

  if (!doc || ingestionGeneration !== currentGeneration) {
    // Stale-generation path. Do NOT patch crawledChunks, do NOT bump
    // progress, do NOT touch document status, do NOT delete anything other
    // than this entry's own (generation-scoped, therefore provably-not-
    // current) vector.
    console.warn(
      `Stale RAG entry completion ignored for document ${documentId}: ` +
        `entry generation ${ingestionGeneration} != current ${currentGeneration}.`,
    );
    try {
      await rag.deleteAsync(ctx, { entryId: entry.entryId });
    } catch (err) {
      console.warn(`Failed to delete stale-generation RAG entry ${entry.entryId}:`, err);
    }
    await deletePendingChunkTextImpl(ctx, ragVersionKey);
    return;
  }

  // Current-generation path: replacedEntry (if any) is provably a prior
  // attempt at this SAME generation - safe to clean up unconditionally.
  if (replacedEntry) {
    try {
      await rag.deleteAsync(ctx, { entryId: replacedEntry.entryId });
    } catch (err) {
      console.warn(`Failed to delete same-generation replacedEntry ${replacedEntry.entryId}:`, err);
    }
  }

  const staged = await ctx.db
    .query("pendingChunkText")
    .withIndex("by_ragVersionKey", (q) => q.eq("ragVersionKey", ragVersionKey))
    .first();
  if (!staged) {
    // embedSingleChunk always stages text before calling rag.add() - without
    // it there is nothing safe to commit (writing empty/wrong chunkText
    // would be worse than not committing). Surface loudly.
    console.error(`onRagEntryComplete: no staged text found for ragVersionKey ${ragVersionKey}`);
    return;
  }

  await commitCurrentGenerationChunkImpl(ctx, {
    documentId,
    baseChunkKey,
    ingestionGeneration,
    contentHash: entry.contentHash ?? "",
    chunkText: staged.chunkText,
    ragId: entry.entryId,
    parentId: metadata.parentId || undefined,
    headingPath: metadata.headingPath,
  });
  // Deliberately does NOT delete the staged row here (retry-storm race): a
  // same-generation chain (many concurrent rag.add() calls at one brand-new
  // ragVersionKey can create several pending entries that successively
  // promote and replace each other - RAG's own promoteToReadyHandler,
  // source-verified against component/entries.js) means a LATER chain link
  // can still need this SAME shared staged row to run its own repoint commit
  // (see commitCurrentGenerationChunkImpl's "already credited this
  // generation" branch) even after an EARLIER link already committed
  // successfully. Deleting here the first time would strand every later
  // link with nothing staged, leaving crawledChunks.ragId pointing at
  // whichever link committed first instead of the actual final survivor.
  // pendingChunkText rows are swept later by reconciliation.ts's GC mode
  // instead, once enough time has passed that no concurrent attempt could
  // still be in flight.
});

async function getDLQEntriesForUrl(ctx: MutationCtx, jobId: string, url: string) {
  return await ctx.db
    .query("crawlDeadLetter")
    .withIndex("by_jobId_and_url", (q) => q.eq("jobId", jobId).eq("url", url))
    .collect();
}

/**
 * Resolve a single chunk's DLQ row for (jobId, url, contentHash). DLQ rows are kept
 * one-per-failed-chunk so completion accounting can count DISTINCT failed chunks; we
 * therefore match on contentHash when available rather than collapsing all chunks of
 * a URL into one row.
 */
async function getDLQEntry(ctx: MutationCtx, jobId: string, url: string, contentHash?: string) {
  const entries = await getDLQEntriesForUrl(ctx, jobId, url);
  if (contentHash !== undefined) {
    return entries.find((e) => e.payload?.contentHash === contentHash) ?? null;
  }
  return entries[0] ?? null;
}

async function clearDLQEntry(ctx: MutationCtx, jobId: string, url: string, contentHash?: string) {
  // Clear only the row for the specific chunk that just succeeded when we know its
  // contentHash; otherwise (legacy callers) clear every row for the (jobId, url).
  if (contentHash !== undefined) {
    const dlqEntry = await getDLQEntry(ctx, jobId, url, contentHash);
    if (dlqEntry) await ctx.db.delete(dlqEntry._id);
    return;
  }
  const entries = await getDLQEntriesForUrl(ctx, jobId, url);
  for (const entry of entries) {
    await ctx.db.delete(entry._id);
  }
}

const ACTIVE_DLQ_STATUSES = new Set(["pending_retry", "processing", "abandoned"]);

/**
 * Count DISTINCT failed chunks for the current job + URL. Each failed chunk has its
 * own DLQ row (keyed by contentHash), so the number of active rows equals the number
 * of distinct chunks that have failed for this document in this job. Scoping to jobId
 * avoids conflating stale rows from earlier re-crawls of the same URL.
 */
async function countFailedChunks(ctx: MutationCtx, jobId: string, url: string): Promise<number> {
  const entries = await getDLQEntriesForUrl(ctx, jobId, url);
  const failedHashes = new Set<string>();
  let unhashed = 0;
  for (const entry of entries) {
    if (!ACTIVE_DLQ_STATUSES.has(entry.status)) continue;
    const hash = entry.payload?.contentHash;
    if (hash) failedHashes.add(hash);
    else unhashed++;
  }
  return failedHashes.size + unhashed;
}

function getEmbeddingErrorDetails(
  result: { kind: string; error?: string },
  returnValue: { skipped?: boolean } | null,
): { errorMsg: string; isSkipped: boolean } {
  if (result.kind === "success" && returnValue?.skipped) {
    return { errorMsg: "Skipped malformed content", isSkipped: true };
  }
  if (result.kind === "failed") {
    return { errorMsg: result.error ?? "Unknown embedding error", isSkipped: false };
  }
  if (result.kind === "canceled") {
    return { errorMsg: "Job canceled", isSkipped: false };
  }
  return { errorMsg: "Unknown embedding error", isSkipped: false };
}

async function updateOrCreateDLQEntry(
  ctx: MutationCtx,
  jobId: string,
  url: string,
  documentId: Id<"documents">,
  contentHash: string | undefined,
  errorMsg: string,
  chunkText?: string,
  chunkKey?: string,
  ingestionGeneration?: number,
) {
  const MAX_RETRIES = 5;
  // One DLQ row per failed chunk (jobId, url, contentHash) so completion accounting
  // can count distinct failed chunks rather than collapsing all chunks of a URL.
  const dlqEntry = await getDLQEntry(ctx, jobId, url, contentHash);

  if (dlqEntry) {
    const newFailureCount = (dlqEntry.failureCount ?? 0) + 1;
    const newStatus = newFailureCount >= MAX_RETRIES ? "abandoned" : "pending_retry";
    await ctx.db.patch(dlqEntry._id, {
      status: newStatus,
      failureCount: newFailureCount,
      lastAttemptAt: Date.now(),
      failureReason: errorMsg,
    });
  } else {
    await ctx.db.insert("crawlDeadLetter", {
      url,
      jobId,
      failureReason: errorMsg,
      failureCount: 1,
      lastAttemptAt: Date.now(),
      payload: { documentId, url, contentHash, jobId, chunkText, chunkKey, ingestionGeneration },
      status: "pending_retry",
    });
  }
}

async function checkDocumentForFailure(
  ctx: MutationCtx,
  documentId: Id<"documents">,
  url: string,
  jobId: string,
  errorMsg: string,
  ingestionGeneration: number | undefined,
) {
  const doc = await ctx.db.get(documentId);
  if (!doc || doc.status === "failed") return;

  // Phase 6.21A Part 5: a failure belonging to a superseded ingestion round
  // must never affect the CURRENT round's status - the failing chunk's
  // position has already been re-diffed under the new generation (it is
  // either unchanged, or has its own independent in-flight replacement).
  // Mixing a stale generation's failure count into the current generation's
  // chunkCount/chunksEmbedded math would corrupt its completion decision.
  const currentGeneration = doc.ingestionGeneration ?? 0;
  if (ingestionGeneration !== undefined && ingestionGeneration !== currentGeneration) {
    console.warn(
      `Stale generation failure ignored for document ${documentId}: ` +
        `work item generation ${ingestionGeneration} != current ${currentGeneration}.`,
    );
    return;
  }

  const chunkCount = doc.chunkCount ?? 1;
  if (chunkCount <= 1) {
    await ctx.db.patch(documentId, {
      status: "failed",
      error: errorMsg,
      updatedAt: Date.now(),
    });
  } else {
    // Count DISTINCT failed chunks scoped to THIS job + URL (one DLQ row per
    // failed chunk). Using by_url across all jobs/statuses previously both
    // under-counted multi-chunk failures and over-counted stale re-crawl rows.
    const failedCount = await countFailedChunks(ctx, jobId, url);
    const embeddedCount = doc.chunksEmbedded || 0;

    if (failedCount + embeddedCount >= chunkCount) {
      if (embeddedCount === 0) {
        await ctx.db.patch(documentId, {
          status: "failed",
          error: `All ${chunkCount} chunks failed. Last error: ${errorMsg}`,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.patch(documentId, {
          status: "indexed",
          error: `Completed with ${failedCount} failed chunks. Last error: ${errorMsg}`,
          updatedAt: Date.now(),
        });
      }
    } else {
      console.warn(
        `Chunk ${failedCount}/${chunkCount} failed for ${url} - document stays in processing`,
      );
    }
  }
}

async function handleEmbeddingFailure(
  ctx: MutationCtx,
  jobId: string,
  url: string,
  documentId: Id<"documents">,
  result: { kind: string; error?: string },
  returnValue: {
    contentHash?: string;
    skipped?: boolean;
    chunkText?: string;
    chunkKey?: string;
  } | null,
  ingestionGeneration: number | undefined,
) {
  const { errorMsg, isSkipped } = getEmbeddingErrorDetails(result, returnValue);

  console.warn(`Embedding failed/skipped for chunk on URL ${url}: ${errorMsg}`);

  if (!isSkipped) {
    await updateOrCreateDLQEntry(
      ctx,
      jobId,
      url,
      documentId,
      returnValue?.contentHash,
      errorMsg,
      returnValue?.chunkText,
      returnValue?.chunkKey,
      ingestionGeneration,
    );
  }

  await checkDocumentForFailure(ctx, documentId, url, jobId, errorMsg, ingestionGeneration);
}

async function routeChunkResult(
  ctx: MutationCtx,
  context: { jobId: string; url?: string; documentId?: string; ingestionGeneration?: number },
  result: { kind: string; returnValue?: Record<string, unknown>; error?: string },
) {
  const returnValue = result.kind === "success" ? result.returnValue : null;
  const url = (returnValue?.url as string | undefined) ?? context.url;
  const documentId =
    (returnValue?.documentId as Id<"documents"> | undefined) ??
    (context.documentId as Id<"documents"> | undefined);
  const contentHash = returnValue?.contentHash as string | undefined;
  // Prefer the jobId the chunk itself reports. The DLQ-retry path enqueues a batch of
  // entries that may belong to MANY different jobs under a single onComplete context
  // jobId; routing DLQ updates by the batch-level context jobId would clear/insert rows
  // under the wrong (jobId, url), corrupting failure accounting. Fall back to the context
  // jobId only when the chunk did not report one (e.g. a hard failure with no returnValue).
  const chunkJobId = (returnValue?.jobId as string | undefined) ?? context.jobId;
  // Phase 6.21A Part 5: prefer the generation the chunk itself reports
  // (present on success/skip returnValues); a hard-thrown failure has no
  // returnValue at all, so fall back to the batch-level enqueue-time
  // context, which every work item in the batch shares and which is always
  // present regardless of outcome.
  const ingestionGeneration =
    (returnValue?.ingestionGeneration as number | undefined) ?? context.ingestionGeneration;

  if (result.kind === "success" && returnValue?.success && returnValue.ragId && url) {
    // Clear only the specific chunk's DLQ row that just succeeded (per-chunk rows).
    await clearDLQEntry(ctx, chunkJobId, url, contentHash);
  } else if (url && documentId) {
    await handleEmbeddingFailure(
      ctx,
      chunkJobId,
      url,
      documentId,
      result,
      (returnValue || null) as any,
      ingestionGeneration,
    );
  }
}

export const onChunkEmbedded = internalMutation({
  args: vOnCompleteArgs(
    v.object({
      jobId: v.string(),
      url: v.optional(v.string()),
      documentId: v.optional(v.string()),
      ingestionGeneration: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    await routeChunkResult(ctx, args.context, args.result);
  },
});

export const resetStuckDLQEntries = internalMutation({
  args: { timeoutMs: v.optional(v.number()) },
  handler: async (ctx, { timeoutMs }) => {
    const timeout = timeoutMs ?? 30 * 60 * 1000; // 30 minutes default
    const cutoff = Date.now() - timeout;

    const stuckEntries = await ctx.db
      .query("crawlDeadLetter")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .take(100);

    let reset = 0;
    for (const entry of stuckEntries) {
      if ((entry.lastAttemptAt ?? 0) < cutoff) {
        await ctx.db.patch(entry._id, {
          status: "pending_retry",
          lastAttemptAt: Date.now(),
        });
        reset++;
      }
    }
    return { reset };
  },
});

export const retryDeadLetterQueue = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 20;

    // Idempotency is enforced PER ENTRY, not globally: we only ever fetch
    // "pending_retry" rows below and atomically flip each to "processing" within this
    // transaction before enqueuing. Convex mutations are serializable, so a concurrent
    // run cannot re-grab the same rows. We therefore do NOT gate the whole queue on the
    // existence of any single "processing" row - one permanently-stuck entry would
    // otherwise stall recovery of every other failed chunk for up to 30 minutes
    // (resetStuckDLQEntries still recovers genuinely stuck "processing" rows on its own
    // cron cycle).
    const pendingDLQ = await ctx.db
      .query("crawlDeadLetter")
      .withIndex("by_status", (q) => q.eq("status", "pending_retry"))
      .take(batchSize);

    const invalidDLQ: (typeof pendingDLQ)[number][] = [];
    const validDLQ = pendingDLQ.filter((dlq) => {
      if (!dlq.payload?.chunkText) {
        console.warn(`Skipping DLQ entry ${dlq._id} - no chunk text available for retry.`);
        invalidDLQ.push(dlq);
        return false;
      }
      // Phase 6.21A Part 2/5: a DLQ row written before chunkKey/
      // ingestionGeneration existed can't be safely retried under the new
      // structural-identity + generation-fencing contract - it would either
      // fail saveEmbedding's required args or retry with no generation to
      // fence against. Same disposition as the pre-existing missing-chunkText
      // case: abandon rather than retry incorrectly.
      if (!dlq.payload?.chunkKey) {
        console.warn(
          `Skipping DLQ entry ${dlq._id} - no chunkKey available for retry (legacy row).`,
        );
        invalidDLQ.push(dlq);
        return false;
      }
      return true;
    });

    await Promise.all(
      invalidDLQ.map((dlq) =>
        ctx.db.patch(dlq._id, {
          status: "abandoned",
          failureReason: !dlq.payload?.chunkText
            ? "No chunk text payload for retry (context was minimized to save bandwidth)."
            : "No chunkKey payload for retry (legacy pre-Phase-6.21A DLQ row).",
          lastAttemptAt: Date.now(),
        }),
      ),
    );

    if (validDLQ.length > 0) {
      await Promise.all(
        validDLQ.map((dlq) =>
          ctx.db.patch(dlq._id, {
            status: "processing",
            lastAttemptAt: Date.now(),
          }),
        ),
      );

      const { namespaceId } = await rag.getOrCreateNamespace(ctx, {
        namespace: "uet-global",
      });
      const namespaceIdStr = namespaceId as unknown as string;

      const argsArray = validDLQ.map((dlq) => ({
        documentId: dlq.payload.documentId,
        url: dlq.payload.url,
        chunkText: dlq.payload.chunkText,
        contentHash: dlq.payload.contentHash,
        chunkKey: dlq.payload.chunkKey!,
        ingestionGeneration: dlq.payload.ingestionGeneration ?? 0,
        jobId: dlq.payload.jobId,
        namespaceId: namespaceIdStr,
      }));

      await embeddingPool.enqueueActionBatch(
        ctx,
        internal.crawl.actions.embedSingleChunk,
        argsArray,
        {
          onComplete: internal.crawl.mutations.onChunkEmbedded,
          // NOTE (pre-existing limitation, unchanged by Phase 6.21A): this
          // context is shared across the WHOLE retry batch, which may span
          // many different documents/generations (see routeChunkResult's
          // jobId comment for the same caveat). It is only a fallback for
          // the no-returnValue hard-failure case; the per-chunk
          // ingestionGeneration above (echoed back via returnValue on
          // success/skip) is the primary source routeChunkResult uses.
          context: {
            jobId: validDLQ[0]!.payload.jobId,
            ingestionGeneration: validDLQ[0]!.payload.ingestionGeneration,
          },
        },
      );
    }

    return {
      // Report only entries actually re-enqueued (not abandoned/invalid ones) so the
      // metric reflects real reprocessing. The pagination flag is based on whether the
      // fetched batch was full (more pending rows may remain), independent of how many
      // were valid.
      reprocessed: validDLQ.length,
      abandoned: invalidDLQ.length,
      remaining: pendingDLQ.length === batchSize ? "more" : "done",
    };
  },
});

function classifyDocument(url: string, title: string): "faculty" | "staff" | "admin" | null {
  const FACULTY_PATTERNS = ["faculty", "professor", "dr.", "prof."];
  const STAFF_PATTERNS = ["staff"];
  const ADMIN_PATTERNS = ["admin", "head", "registrar", "chancellor"];
  const text = `${url} ${title}`.toLowerCase();
  if (FACULTY_PATTERNS.some((p) => text.includes(p))) return "faculty";
  if (STAFF_PATTERNS.some((p) => text.includes(p))) return "staff";
  if (ADMIN_PATTERNS.some((p) => text.includes(p))) return "admin";
  return null;
}

export const upsertDocument = internalMutation({
  args: {
    url: v.string(),
    markdown: v.string(),
    contentHash: v.string(),
    crawlSessionId: v.string(),
    title: v.optional(v.string()),
    sourceType: v.string(),
    freshnessTier: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
  },
  handler: async (ctx, args) => {
    if (!isPdfVirtualUrl(args.url)) {
      new URL(args.url); // validate URL, throws TypeError if invalid
    }

    const existing = await ctx.db
      .query("documents")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .first();

    const title = args.title ?? args.url;
    const personType = classifyDocument(args.url, title) ?? undefined;
    // Phase 6.21A Part 7: same fast-path contract as queueChunksForEmbedding
    // - both contentHash AND indexingFingerprint must match for "unchanged".
    const currentFingerprint = await computeIndexingFingerprint();

    if (existing) {
      if (
        existing.contentHash === args.contentHash &&
        existing.indexingFingerprint === currentFingerprint
      ) {
        await ctx.db.patch(existing._id, {
          crawlSessionId: args.crawlSessionId,
          status: "active",
          updatedAt: Date.now(),
          freshnessTier: args.freshnessTier,
          metadata: { ...existing.metadata, sourceType: args.sourceType },
          personType,
        });
        return { action: "skipped", documentId: existing._id };
      }

      // Phase 6.21A Part 4/5: new ingestion round - see
      // queueChunksForEmbedding's Part 4/5 comment for the full rationale
      // (accept immediately, fence stale completions rather than block).
      const newGeneration = (existing.ingestionGeneration ?? 0) + 1;

      const oldChunks = await getAllChunksByDocumentId(ctx, existing._id);
      const BATCH_SIZE = 50;
      for (let i = 0; i < oldChunks.length; i += BATCH_SIZE) {
        const batch = oldChunks.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (chunk) => {
            try {
              await rag.deleteAsync(ctx, {
                entryId: chunk.ragId as unknown as import("@convex-dev/rag").EntryId,
              });
              await ctx.db.delete(chunk._id);
            } catch (err) {
              console.warn(
                `Failed to delete vector ${chunk.ragId} from RAG during content update:`,
                err,
              );
            }
          }),
        );
      }

      await ctx.db.patch(existing._id, {
        contentHash: args.contentHash,
        indexingFingerprint: currentFingerprint,
        ingestionGeneration: newGeneration,
        crawlSessionId: args.crawlSessionId,
        title,
        status: "pending_embed",
        updatedAt: Date.now(),
        freshnessTier: args.freshnessTier,
        metadata: { ...existing.metadata, sourceType: args.sourceType },
        personType,
      });
      return { action: "updated", documentId: existing._id };
    }

    let source = "unknown";
    if (isPdfVirtualUrl(args.url)) {
      source = "pdf";
    } else {
      try {
        source = new URL(args.url).hostname;
      } catch {
        source = "unknown";
      }
    }

    const id = await ctx.db.insert("documents", {
      url: args.url,
      source,
      category: "crawled",
      contentHash: args.contentHash,
      indexingFingerprint: currentFingerprint,
      ingestionGeneration: 1,
      crawlSessionId: args.crawlSessionId,
      title: title,
      status: "pending_embed",
      crawledAt: Date.now(),
      updatedAt: Date.now(),
      freshnessTier: args.freshnessTier,
      metadata: { sourceType: args.sourceType },
      personType,
    });
    return { action: "inserted", documentId: id };
  },
});

export const enqueueDocumentChunks = internalMutation({
  args: {
    documentId: v.id("documents"),
    url: v.string(),
    parents: v.array(
      v.object({
        contentHash: v.string(),
        text: v.string(),
      }),
    ),
    children: v.array(
      v.object({
        text: v.string(),
        contentHash: v.string(),
        chunkKey: v.string(),
        parentContentHash: v.string(),
        headingPath: v.optional(v.array(v.string())),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { documentId, url, parents, children } = args;

    // Phase 6.21A Part 4/5: read the CURRENT generation directly rather than
    // threading it through upsertDocument's return value - this mutation
    // always runs immediately after upsertDocument bumped it (see
    // webhook.ts's ingestWebhook/processIngestContent), so the document's
    // own field is the authoritative, always-correct source.
    const doc = await ctx.db.get(documentId);
    const ingestionGeneration = doc?.ingestionGeneration ?? 0;

    // WS-1: upsert parents once + resolve parentId for each child.
    const parentIdByHash = await upsertParentsAndResolve(ctx, documentId, parents);

    if (children.length > 0) {
      const { namespaceId } = await rag.getOrCreateNamespace(ctx, {
        namespace: "uet-global",
      });
      const namespaceIdStr = namespaceId as unknown as string;

      const argsArray = children.map((chunk) => ({
        documentId,
        url,
        chunkText: chunk.text,
        contentHash: chunk.contentHash,
        chunkKey: chunk.chunkKey,
        ingestionGeneration,
        jobId: "ingest-job",
        parentId: parentIdByHash.get(chunk.parentContentHash),
        headingPath: chunk.headingPath,
        namespaceId: namespaceIdStr,
      }));

      await embeddingPool.enqueueActionBatch(
        ctx,
        internal.crawl.actions.embedSingleChunk,
        argsArray,
        {
          onComplete: internal.crawl.mutations.onChunkEmbedded,
          context: {
            jobId: "ingest-job",
            documentId: documentId as unknown as string,
            url,
            ingestionGeneration,
          },
        },
      );
    }

    await ctx.db.patch(documentId, {
      chunkCount: children.length,
      // upsertDocument's full delete-then-reinsert means every child this
      // round is genuinely new to saveEmbedding's per-chunkKey lookup (no
      // prior row survives) - there is no "unchanged, pre-credited" set to
      // seed here, unlike queueChunksForEmbedding's diff-based path.
      chunksEmbedded: 0,
      status: children.length === 0 ? "indexed" : "processing",
    });
  },
});

/**
 * WS-1f migration: normalize legacy crawledChunks.parentText into the
 * chunkParents table, then clear the duplicated inline parentText to reclaim
 * storage. Run ONCE manually after deploy (admin-triggered); repeat-safe.
 *
 * For each chunk that still carries inline `parentText` (pre-WS-1 rows) and has
 * no `parentId` yet: hash the parent text, upsert into chunkParents (dedup by
 * documentId + contentHash so siblings share one row), set the chunk's parentId,
 * then clear parentText. Bounded per call via `limit` (default 500); the caller
 * re-invokes until `remaining === "done"`.
 *
 * This is the ONLY way to reclaim the already-stored parentText duplication -
 * new writes already use parentId (WS-1), but existing rows keep their inline
 * copy until this runs. Retrieval is unchanged throughout (doc_queries.ts
 * resolves parentText via parentId when present, falling back to the inline
 * field), so this can run lazily without a maintenance window.
 */
export const migrateParentTextToTable = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    migrated: v.number(),
    remaining: v.string(),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 500;
    // Chunks that still have inline parentText and no parentId reference yet.
    // There is no index on parentText (it's an optional string field), so this
    // scans via the table order; bounded by `limit`. Re-running picks up the
    // next batch until none remain.
    const chunks = await ctx.db
      .query("crawledChunks")
      .filter((q) =>
        q.and(q.eq(q.field("parentId"), undefined), q.neq(q.field("parentText"), undefined)),
      )
      .take(limit);

    let migrated = 0;
    for (const chunk of chunks) {
      const parentText = chunk.parentText;
      if (!parentText) continue;
      const contentHash = await sha256(parentText);
      const existing = await ctx.db
        .query("chunkParents")
        .withIndex("by_documentId_and_contentHash", (q) =>
          q.eq("documentId", chunk.documentId).eq("contentHash", contentHash),
        )
        .first();
      const parentId = existing
        ? existing._id
        : await ctx.db.insert("chunkParents", {
            documentId: chunk.documentId,
            contentHash,
            text: parentText,
          });
      // Set parentId then clear the inline copy in one patch - reclaims the
      // duplicated storage immediately for this row.
      await ctx.db.patch(chunk._id, { parentId, parentText: undefined });
      migrated++;
    }

    return {
      migrated,
      remaining: chunks.length === limit ? "more" : "done",
    };
  },
});
