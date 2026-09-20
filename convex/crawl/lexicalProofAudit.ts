import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

// Read-only scoping for audit §15 (F-9): convex/crawl/lexicalProof.ts wrote
// Corpus-V1 rows into this deployment tagged crawlSessionId "phase5-lexical-proof"
// with ragId `lexical-proof:${contentHash}` and NO embedding, and they are being
// retrieved and served. Before anything is deleted or hidden, two things have to be
// known: how many there are, and whether the documents holding them ALSO hold
// properly embedded chunks - because if they do not, excluding these rows would
// remove real answers rather than stale duplicates.
//
// RESULT (2026-09-20, audit §15.5): they do not. 30/30 sampled production documents hold ONLY these
// rows, so they ARE the corpus and must not be excluded. Kept as a bounded, read-only audit tool.
//
// Deliberately bounded. `maxDocuments`/`maxChunksPerDocument` cap the rows read so
// this cannot become an unbounded scan against the Convex Free-plan I/O budget;
// `truncated` reports whether the cap was hit. No mutation, no delete.

const LEXICAL_PROOF_SESSION = "phase5-lexical-proof";
const LEXICAL_PROOF_RAG_PREFIX = "lexical-proof:";

export const scopeLexicalProofRows = internalQuery({
  args: {
    maxDocuments: v.optional(v.number()),
    maxChunksPerDocument: v.optional(v.number()),
  },
  returns: v.object({
    documentsScanned: v.number(),
    truncated: v.boolean(),
    chunksProof: v.number(),
    chunksEmbedded: v.number(),
    documentsWithOnlyProofChunks: v.number(),
    documentsWithBothKinds: v.number(),
    sampleUrls: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const maxDocuments = args.maxDocuments ?? 200;
    const maxChunksPerDocument = args.maxChunksPerDocument ?? 200;

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_session", (q) => q.eq("crawlSessionId", LEXICAL_PROOF_SESSION))
      .take(maxDocuments + 1);

    const truncated = docs.length > maxDocuments;
    const scanned = truncated ? docs.slice(0, maxDocuments) : docs;

    let chunksProof = 0;
    let chunksEmbedded = 0;
    let onlyProof = 0;
    let both = 0;
    const sampleUrls: string[] = [];

    for (const doc of scanned) {
      const chunks = await ctx.db
        .query("crawledChunks")
        .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
        .take(maxChunksPerDocument);

      let proofHere = 0;
      let embeddedHere = 0;
      for (const chunk of chunks) {
        if (chunk.ragId.startsWith(LEXICAL_PROOF_RAG_PREFIX)) proofHere++;
        else embeddedHere++;
      }
      chunksProof += proofHere;
      chunksEmbedded += embeddedHere;
      if (proofHere > 0 && embeddedHere === 0) {
        onlyProof++;
        if (sampleUrls.length < 10) sampleUrls.push(doc.url);
      } else if (proofHere > 0 && embeddedHere > 0) {
        both++;
      }
    }

    return {
      documentsScanned: scanned.length,
      truncated,
      chunksProof,
      chunksEmbedded,
      documentsWithOnlyProofChunks: onlyProof,
      documentsWithBothKinds: both,
      sampleUrls,
    };
  },
});
