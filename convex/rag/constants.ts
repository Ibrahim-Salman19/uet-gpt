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
  groqModel: "openai/gpt-oss-20b",
  highConfidenceThreshold: 0.7,
  // When the reranker's top score is already at/above the "normal" confidence
  // tier (see determineConfidenceTier), the rerank ordering is trusted and the
  // (expensive, often redundant) CRAG LLM judge is skipped. Borderline/low
  // results still go through CRAG.
  skipThreshold: 0.6,
} as const;

export const FAITHFULNESS_CONFIG = {
  groqModel: "openai/gpt-oss-20b",
} as const;

export const CASCADE_CONFIG = {
  minWordOverlap: 0.1,
  overlapWeight: 0.6,
  positionWeight: 0.4,
  tier2CandidateCount: 15,
  cohereModel: "rerank-v3.5",
  cohereEndpoint: "https://api.cohere.ai/v1/rerank",
} as const;
