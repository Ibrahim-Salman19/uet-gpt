/**
 * TEMPORARY — Phase 3 retrieval smoke action.
 *
 * Purpose: prove the production retrieval pipeline returns the expected smoke
 * document for a distinctive query, WITHOUT adding a public endpoint or Clerk
 * bypass. Required because every public retrieval wrapper (retrieveContext,
 * rag.testing.seed/verify, eval.ts) gates on ctx.auth.getUserIdentity(), and
 * the deploy key alone cannot authenticate against Clerk.
 *
 * Lifecycle: REMOVABLE. Delete this file once Phase 4 UI proof (live chat with
 * admin Clerk session) replaces it. Tracked in docs/audit/PHASE_3_BACKEND_SMOKE.md.
 *
 * Constraints honored (per 2026-07-27 retrieval-path directive):
 *   - internalAction only: NOT callable from any client. No public surface.
 *   - No Clerk bypass, no embeddings exposed, no secrets read.
 *   - Invokes the REAL production retrieval path: searchDocumentsAction (the
 *     same internalAction retrieveContext calls via searchVectorDB at
 *     retrieval.ts:197). That action runs rag.search + fullTextSearch +
 *     chunkTextSearch + 3-way RRF fusion + FAQ fusion + decay scoring.
 *   - Accepts only { query, limit }. limit clamped to [1, 5].
 *   - Returns document/chunk IDs, source URLs, scores, ranks, and SHORT
 *     REDACTED snippets (200 chars). No full content, no unrestricted corpus
 *     access — caller cannot enumerate or dump the index.
 *   - Query is injection-scanned with the production INJECTION_RE and capped
 *     at 200 chars (tighter than the 2000-char production limit, since this
 *     is a smoke probe not a user-facing path).
 */
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { INJECTION_RE } from "./constants";

const SMOKE_MAX_QUERY_LEN = 200;
const SMOKE_MAX_LIMIT = 5;
const SNIPPET_LEN = 200;

// Mirrors the return shape of internal.embeddings.search.searchDocumentsAction
// (embeddings/search.ts:177-186). Defined locally so this probe does not depend
// on the search module's inferred handler type and the deploy-time strict
// typecheck has explicit annotations everywhere (no implicit any).
type SearchHit = {
  entryId: string;
  content: string;
  url: string;
  title: string;
  relevanceScore: number;
  headingPath?: string[];
};

type SmokeResult = {
  rank: number;
  entryId: string;
  url: string;
  title: string;
  relevanceScore: number;
  snippet: string;
};

type SmokeReturn = {
  query: string;
  limit: number;
  resultCount: number;
  results: SmokeResult[];
};

function scanQuery(query: string): string {
  if (typeof query !== "string" || query.length === 0) {
    throw new ConvexError("query must be a non-empty string");
  }
  if (query.length > SMOKE_MAX_QUERY_LEN) {
    throw new ConvexError(
      `query too long (${query.length} > ${SMOKE_MAX_QUERY_LEN}). Smoke probe accepts short distinctive queries only.`,
    );
  }
  if (INJECTION_RE.test(query)) {
    throw new ConvexError("query rejected: injection pattern detected");
  }
  return query.trim();
}

function clampLimit(limit: unknown): number {
  const n = typeof limit === "number" ? limit : 5;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), SMOKE_MAX_LIMIT);
}

function redact(text: string): string {
  // Short snippet only — never return full chunk content from this probe.
  const cleaned = (text ?? "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= SNIPPET_LEN) return cleaned;
  return `${cleaned.slice(0, SNIPPET_LEN)}…`;
}

export const smokeRetrieval = internalAction({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    query: v.string(),
    limit: v.number(),
    resultCount: v.number(),
    results: v.array(
      v.object({
        rank: v.number(),
        entryId: v.string(),
        url: v.string(),
        title: v.string(),
        relevanceScore: v.number(),
        snippet: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args): Promise<SmokeReturn> => {
    const safeQuery = scanQuery(args.query);
    const limit = clampLimit(args.limit);

    // Real production retrieval pipeline — same internal action retrieveContext
    // calls. searchDocumentsAction runs: rag.search (vector) + fullTextSearch
    // (BM25) + chunkTextSearch + 3-way RRF fusion + FAQ fusion + decay scoring.
    const hits: SearchHit[] = await ctx.runAction(
      internal.embeddings.search.searchDocumentsAction,
      {
        queryText: safeQuery,
        limit,
      },
    );

    const results: SmokeResult[] = hits.map((hit: SearchHit, idx: number): SmokeResult => ({
      rank: idx + 1,
      entryId: hit.entryId,
      url: hit.url,
      title: hit.title,
      relevanceScore: hit.relevanceScore,
      snippet: redact(hit.content),
    }));

    return {
      query: safeQuery,
      limit,
      resultCount: results.length,
      results,
    };
  },
});
