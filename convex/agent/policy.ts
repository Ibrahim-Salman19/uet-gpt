export const UETGPT_EXECUTION_POLICY = {
  mode: "read_only_grounded_qa",

  maxModelTurns: 3,
  maxToolCalls: 5,
  maxQueryVariants: 3,
  maxRetrievalCandidates: 256,
  maxRerankCandidates: 30,
  maxEvidenceItemsInContext: 12,

  maxRequestCharacters: 2_000,
  maxContextTokens: 24_000,
  maxAnswerTokens: 1_200,

  overallDeadlineMs: 12_000,
  rerankingDeadlineMs: 2_500,
  liveVerificationDeadlineMs: 4_000,

  allowWriteTools: false,
  requireOfficialSources: true,

  version: "2026.07.28-v1",
} as const;

export type AgentRunState =
  | "received"
  | "security_checked"
  | "classified"
  | "cache_checked"
  | "query_expanded"
  | "retrieved"
  | "temporally_governed"
  | "live_verified"
  | "reranked"
  | "evidence_evaluated"
  | "generation_allowed"
  | "generated"
  | "validated"
  | "completed"
  | "abstained"
  | "refused"
  | "failed";

export type LifecycleStatus =
  | "active"
  | "superseded"
  | "withdrawn"
  | "explicitly_stale"
  | "quarantined"
  | "deleted";

export type FreshnessState = "fresh" | "aged" | "unknown";

export type Applicability =
  | "current"
  | "historical"
  | "session_specific"
  | "expired"
  | "timeless"
  | "unknown";

export type ReasonCode =
  | "HIGH_CURRENT_NO_FRESH_PRIMARY_SOURCE"
  | "TEMPORAL_CONFLICT_UNRESOLVED"
  | "CITATION_COVERAGE_INSUFFICIENT"
  | "PROMPT_INJECTION_DETECTED"
  | "OFF_TOPIC_REJECTED"
  | "NO_ELIGIBLE_EVIDENCE"
  | "DEADLINE_EXCEEDED"
  | "RERANKER_TIMEOUT_FALLBACK"
  | "LIVE_VERIFICATION_FAILED"
  | "OUTPUT_CLAIM_UNSUPPORTED"
  | "CACHE_REVALIDATION_EXPIRED";
