export type ConfidenceTier = "refuse" | "hedge" | "cite" | "normal";

export const INJECTION_RE = new RegExp(
  [
    String.raw`ignore\s+previous\s+instructions?`,
    String.raw`(?:system|role)\s*:`,
    String.raw`\[INST\]`,
    String.raw`<\/s>`,
    String.raw`<\|im_(?:start|end)\|>`,
    String.raw`###\s*[Ii]nstruction`,
    String.raw`<\s*script[\s>]`,
    String.raw`from\s+now\s+on\s+`,
    String.raw`you\s+are\s+(?:now|an?)\s+`,
    String.raw`disregard\s+`,
    String.raw`override\s+`,
    String.raw`do\s+not\s+follow\s+`,
  ].join("|"),
  "i",
);

export const MAX_QUERY_LEN = 2_000;

export const CRAG_CONFIG = {
  batchSize: 4,
  highConfidenceThreshold: 0.7,
  // When the reranker's top score is already at/above the "normal" confidence
  // tier (see determineConfidenceTier), the rerank ordering is trusted and the
  // (expensive, often redundant) CRAG LLM judge is skipped. Borderline/low
  // results still go through CRAG.
  skipThreshold: 0.6,
} as const;

// NOTE: model selection moved to convex/rag/modelRegistry.ts (Track C).
// The dying llama models were previously configured here; the registry now
// centralizes Groq-primary → Gemini-fallback selection with strict schemas.

export const CASCADE_CONFIG = {
  minWordOverlap: 0.1,
  overlapWeight: 0.6,
  positionWeight: 0.4,
  tier2CandidateCount: 15,
  cohereModel: "rerank-english-v3.0",
  cohereEndpoint: "https://api.cohere.ai/v1/rerank",
} as const;
