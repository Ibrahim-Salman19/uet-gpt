import { api } from "convex/_generated/api";
import type { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { after } from "next/server";
import { assignFreshnessTier } from "../../../convex/crawl/chunking";

/**
 * RAG result type inferred directly from the Convex action's `returns` validator,
 * so any shape drift (renamed/removed fields) is caught at compile time instead
 * of failing silently at runtime in this security/cost-sensitive boundary.
 */
export type RagResult = FunctionReturnType<typeof api.rag.retrieval.retrieveContext>;
export type RagSource = RagResult["sources"][number];

// Cap how much source data we are willing to push through the X-Sources HTTP
// response header. Proxies/runtimes commonly cap total response headers around
// 8-16KB; an oversized header drops the whole response, so we degrade instead.
const MAX_SOURCES_IN_HEADER = 8;
const MAX_EXCERPT_CHARS = 300;
const MAX_HEADER_BYTES = 6000;

/**
 * Serialize sources into a base64 value safe for an HTTP header. Excerpts are
 * truncated and the source count is capped; if the encoded value still exceeds
 * a safe bound we drop progressively more excerpt detail, and finally emit an
 * empty array rather than a header that could break the response.
 */
export function encodeSourcesHeader(sources: RagSource[]): string {
  const capped = sources.slice(0, MAX_SOURCES_IN_HEADER);
  const slim = capped.map((s) => ({
    ...s,
    excerpt: typeof s.excerpt === "string" ? s.excerpt.slice(0, MAX_EXCERPT_CHARS) : s.excerpt,
  }));

  let encoded = base64Json(slim);
  if (encoded.length > MAX_HEADER_BYTES) {
    // Drop excerpts entirely as a second pass before giving up.
    const minimal = capped.map(({ excerpt: _excerpt, ...rest }) => rest);
    encoded = base64Json(minimal);
  }
  if (encoded.length > MAX_HEADER_BYTES) {
    return base64Json([]);
  }
  return encoded;
}

function base64Json(value: unknown): string {
  const jsonString = JSON.stringify(value);
  const bytes = new TextEncoder().encode(jsonString);
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
  return btoa(binString);
}

// Only spend an extra LLM + embedding call generating alternate phrasings for
// queries that are plausibly recurring (short, natural-language questions).
// Long/one-off prompts rarely benefit from alternate-phrasing cache lookups, so
// gating here avoids roughly doubling the steady-state LLM call count per answer.
export function buildCacheWriteCallback(
  question: string,
  ragResult: RagResult,
  convex: ConvexHttpClient,
): (text: string, modelName: string) => void {
  return (text, modelName) => {
    // The cache write must be authorized by the server-trust secret, never by
    // the end user's identity. If INTERNAL_API_SECRET is missing, do NOT fall
    // through to the identity-based admin path (which would silently disable
    // cache writes for all non-admin traffic): skip deliberately and log loudly.
    const secret = process.env.INTERNAL_API_SECRET;
    if (!secret) {
      console.error(
        "INTERNAL_API_SECRET is not set - skipping semantic cache write (server-trust required).",
      );
      return;
    }
    if (ragResult.queryEmbedding && ragResult.queryEmbedding.length > 0) {
      after(async () => {
        try {
          // Multi-vector cache "alternates" are intentionally NOT generated here:
          // generateAlternates is an internalAction and cannot be called from this
          // server-side ConvexHttpClient. If the feature is enabled, generate them
          // inside convex/cache/set.ts:setFromServer (server-side) instead.
          const topSourceUrl = ragResult.sources[0]?.url ?? "";
          const freshnessTier = assignFreshnessTier(topSourceUrl);
          const sourceEntryIds = ragResult.sources.map((s: any) => s.entryId).filter(Boolean);

          await convex.action(api.cache.set.setFromServer, {
            secret,
            queryText: question,
            queryEmbedding: ragResult.queryEmbedding,
            response: text,
            sources: ragResult.sources,
            model: modelName,
            freshnessTier,
            sourceEntryIds,
          });
        } catch (err) {
          console.error("Failed to write to semantic cache:", err);
        }
      });
    }
  };
}
