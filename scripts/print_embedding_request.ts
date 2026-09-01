// Prints the REAL production Gemini embedding request bodies for a given text,
// by importing buildGeminiEmbedContentRequestBody and
// buildGeminiBatchEmbedContentsRequestItem directly from
// convex/embeddings/generate.ts - not a hand-copied reimplementation.
//
// Used by scripts/test_embedding_request_parity.py (retrieval-baseline
// remediation, docs/rag-store-evaluation/retrieval-baseline-2026-08/) to prove
// the Python evaluator constructs a byte-for-byte equivalent request to what
// production actually sends, rather than asserting equality of returned
// floating-point vectors (which the remote model may vary between calls).
//
// Usage: npx tsx scripts/print_embedding_request.ts "<text>" [dimensions]
// Prints one line of JSON to stdout: {"single": ..., "batchItem": ...} -
// "single" is the exact body embedNativeGemini() sends to the single-item
// embedContent endpoint (texts.length < BATCH_THRESHOLD); "batchItem" is the
// exact per-item object it puts into batchEmbedContents' "requests" array
// (texts.length >= BATCH_THRESHOLD). The evaluator always uses the batch
// endpoint (a legitimate implementation choice for embedding thousands of
// corpus chunks - empirically confirmed equivalent to the single endpoint for
// a lone item), so it is compared against "batchItem".

import {
  buildGeminiEmbedContentRequestBody,
  buildGeminiBatchEmbedContentsRequestItem,
} from "../convex/embeddings/generate";
import { EMBEDDING_DIMENSION } from "../convex/embeddings/dimension";

const text = process.argv[2];
if (text === undefined) {
  console.error("usage: print_embedding_request.ts <text> [dimensions]");
  process.exit(2);
}
const dimensions = process.argv[3] ? Number(process.argv[3]) : EMBEDDING_DIMENSION;
if (!Number.isFinite(dimensions) || dimensions <= 0) {
  console.error("dimensions must be a positive finite number");
  process.exit(2);
}

process.stdout.write(
  JSON.stringify({
    single: buildGeminiEmbedContentRequestBody(text, dimensions),
    batchItem: buildGeminiBatchEmbedContentsRequestItem(text, dimensions),
  }),
);
