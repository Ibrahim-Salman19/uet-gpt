export type ConfidenceTier = "refuse" | "hedge" | "cite" | "normal";

// A match hard-rejects the question, so every pattern needs an instruction-hijack
// frame. Bare phrases ("you are an", "override", "system:", "from now on") used to
// reject ordinary questions such as "What documents do I need if you are an
// overseas applicant?". The structural context fence in src/lib/prompt.ts is the
// primary injection defense; this list only catches blatant attempts.
const INSTRUCTION_NOUNS = String.raw`(?:instructions?|rules|prompts?|guidelines|directives)`;

export const INJECTION_RE = new RegExp(
  [
    String.raw`ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+${INSTRUCTION_NOUNS}`,
    String.raw`(?:^|\n)\s*(?:system|role)\s*:`,
    String.raw`\[INST\]`,
    String.raw`<\/s>`,
    String.raw`<\|im_(?:start|end)\|>`,
    String.raw`###\s*[Ii]nstruction`,
    String.raw`<\s*script[\s>]`,
    String.raw`from\s+now\s+on\s*,?\s+(?:you\s+(?:are|will|must)|act\s+as|respond\s+as|ignore)`,
    String.raw`you\s+are\s+now\s+(?:an?\s+)?(?:unrestricted|jailbroken|dan\b|evil|uncensored)`,
    String.raw`disregard\s+(?:all\s+|any\s+|the\s+|your\s+)*(?:previous\s+|prior\s+|above\s+|earlier\s+|system\s+)?${INSTRUCTION_NOUNS}`,
    String.raw`override\s+(?:all\s+|any\s+|the\s+|your\s+)*(?:system\s+|safety\s+)?${INSTRUCTION_NOUNS}`,
    String.raw`do\s+not\s+follow\s+(?:the\s+|your\s+|any\s+)*(?:system\s+|previous\s+)?${INSTRUCTION_NOUNS}`,
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
  cohereModel: "rerank-v4.0-fast",
  cohereEndpoint: "https://api.cohere.com/v2/rerank", // v4.0 rerank models are documented on the v2 API
} as const;
