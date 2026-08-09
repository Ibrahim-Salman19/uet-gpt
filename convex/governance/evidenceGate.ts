import type { Applicability, ReasonCode } from "../agent/policy";

export interface CandidateEvidenceSummary {
  id: string;
  authority: "official_primary" | "official_secondary" | "official_archive" | string;
  freshnessState: "fresh" | "aged" | "unknown";
  applicability: Applicability;
  hasConflict?: boolean;
}

export interface EvidenceDecisionInput {
  queryRisk: "high_current" | "medium_current" | "low_current" | "historical" | "general";
  temporalIntent: "current" | "historical" | "session_specific" | "timeless" | "unknown";
  candidates: CandidateEvidenceSummary[];
  liveVerificationAttempted?: boolean;
  liveVerificationSucceeded?: boolean;
}

export interface EvidenceDecisionOutput {
  queryRisk: string;
  temporalIntent: string;

  eligibleSourcesCount: number;
  freshSourcesCount: number;
  freshPrimarySourcesCount: number;
  agedSourcesCount: number;
  unknownFreshnessSourcesCount: number;

  currentApplicabilityConfirmed: boolean;
  conflictDetected: boolean;
  citationCoveragePossible: boolean;

  decision:
    | "answer"
    | "answer_with_as_of"
    | "historical_answer"
    | "answer_with_warning"
    | "abstain"
    | "refuse";

  reasonCode: ReasonCode | "APPROVED_FOR_GENERATION";
}

export function evaluateEvidenceGate(input: EvidenceDecisionInput): EvidenceDecisionOutput {
  const { queryRisk, temporalIntent, candidates, liveVerificationSucceeded } = input;

  if (candidates.length === 0) {
    return {
      queryRisk,
      temporalIntent,
      eligibleSourcesCount: 0,
      freshSourcesCount: 0,
      freshPrimarySourcesCount: 0,
      agedSourcesCount: 0,
      unknownFreshnessSourcesCount: 0,
      currentApplicabilityConfirmed: false,
      conflictDetected: false,
      citationCoveragePossible: false,
      decision: "refuse",
      reasonCode: "NO_ELIGIBLE_EVIDENCE",
    };
  }

  const eligibleSourcesCount = candidates.length;
  const freshSourcesCount = candidates.filter((c) => c.freshnessState === "fresh").length;
  const freshPrimarySourcesCount = candidates.filter(
    (c) => c.freshnessState === "fresh" && c.authority === "official_primary",
  ).length;
  const agedSourcesCount = candidates.filter((c) => c.freshnessState === "aged").length;
  const unknownFreshnessSourcesCount = candidates.filter(
    (c) => c.freshnessState === "unknown",
  ).length;

  const conflictDetected = candidates.some((c) => c.hasConflict === true);
  const currentApplicabilityConfirmed = candidates.some(
    (c) => c.applicability === "current" || c.applicability === "timeless",
  );
  const citationCoveragePossible = eligibleSourcesCount > 0;

  if (conflictDetected) {
    return {
      queryRisk,
      temporalIntent,
      eligibleSourcesCount,
      freshSourcesCount,
      freshPrimarySourcesCount,
      agedSourcesCount,
      unknownFreshnessSourcesCount,
      currentApplicabilityConfirmed,
      conflictDetected: true,
      citationCoveragePossible,
      decision: "abstain",
      reasonCode: "TEMPORAL_CONFLICT_UNRESOLVED",
    };
  }

  // Strict check for high_current queries
  if (queryRisk === "high_current") {
    const hasFreshPrimaryOrVerified =
      freshPrimarySourcesCount >= 1 || liveVerificationSucceeded === true;

    if (!hasFreshPrimaryOrVerified || !currentApplicabilityConfirmed) {
      return {
        queryRisk,
        temporalIntent,
        eligibleSourcesCount,
        freshSourcesCount,
        freshPrimarySourcesCount,
        agedSourcesCount,
        unknownFreshnessSourcesCount,
        currentApplicabilityConfirmed,
        conflictDetected,
        citationCoveragePossible,
        decision: "abstain",
        reasonCode: "HIGH_CURRENT_NO_FRESH_PRIMARY_SOURCE",
      };
    }

    return {
      queryRisk,
      temporalIntent,
      eligibleSourcesCount,
      freshSourcesCount,
      freshPrimarySourcesCount,
      agedSourcesCount,
      unknownFreshnessSourcesCount,
      currentApplicabilityConfirmed,
      conflictDetected,
      citationCoveragePossible,
      decision: "answer",
      reasonCode: "APPROVED_FOR_GENERATION",
    };
  }

  if (temporalIntent === "historical") {
    return {
      queryRisk,
      temporalIntent,
      eligibleSourcesCount,
      freshSourcesCount,
      freshPrimarySourcesCount,
      agedSourcesCount,
      unknownFreshnessSourcesCount,
      currentApplicabilityConfirmed,
      conflictDetected,
      citationCoveragePossible,
      decision: "historical_answer",
      reasonCode: "APPROVED_FOR_GENERATION",
    };
  }

  if (agedSourcesCount > 0 && freshSourcesCount === 0) {
    return {
      queryRisk,
      temporalIntent,
      eligibleSourcesCount,
      freshSourcesCount,
      freshPrimarySourcesCount,
      agedSourcesCount,
      unknownFreshnessSourcesCount,
      currentApplicabilityConfirmed,
      conflictDetected,
      citationCoveragePossible,
      decision: "answer_with_as_of",
      reasonCode: "APPROVED_FOR_GENERATION",
    };
  }

  return {
    queryRisk,
    temporalIntent,
    eligibleSourcesCount,
    freshSourcesCount,
    freshPrimarySourcesCount,
    agedSourcesCount,
    unknownFreshnessSourcesCount,
    currentApplicabilityConfirmed,
    conflictDetected,
    citationCoveragePossible,
    decision: "answer",
    reasonCode: "APPROVED_FOR_GENERATION",
  };
}
