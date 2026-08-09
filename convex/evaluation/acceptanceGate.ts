import type { MetricResult } from "./metrics";

export interface SystemAcceptanceChecklist {
  workflowContractsActive: boolean;
  traceSpansActive: boolean;
  deadlinesBounded: boolean;
  killSwitchesActive: boolean;

  invalidDocsInContextCount: number;
  unknownFreshnessAsCurrentCount: number;
  unresolvedConflictAsCurrentCount: number;

  cacheSourceRevalidationActive: boolean;
  cacheStampedeProtected: boolean;

  directInjectionPassRate: number;
  ssrfPassRate: number;
  toolAuthorizationLeastPrivilege: boolean;

  noDeadModelsRemaining: boolean;
  embeddingDimension768Validated: boolean;

  qualityMetrics: MetricResult;
  p95LatencyMs: number;
  cacheHitP95LatencyMs: number;
}

export interface AcceptanceGateDecision {
  accepted: boolean;
  scorePercentage: number;
  violations: string[];
}

export function evaluateProductionAcceptanceGate(
  checklist: SystemAcceptanceChecklist,
): AcceptanceGateDecision {
  const violations: string[] = [];

  // §17 Workflow
  if (!checklist.workflowContractsActive) violations.push("Workflow contracts not fully active");
  if (!checklist.traceSpansActive) violations.push("Trace spans incomplete");
  if (!checklist.deadlinesBounded) violations.push("Deadlines not bounded");
  if (!checklist.killSwitchesActive) violations.push("Kill switches missing");

  // §17 Retrieval & Temporal Correctness
  if (checklist.invalidDocsInContextCount > 0)
    violations.push(
      `Invalid documents leaked into context (${checklist.invalidDocsInContextCount})`,
    );
  if (checklist.unknownFreshnessAsCurrentCount > 0)
    violations.push("Unknown freshness presented as current");
  if (checklist.unresolvedConflictAsCurrentCount > 0)
    violations.push("Unresolved conflict presented as current");

  // §17 Cache
  if (!checklist.cacheSourceRevalidationActive)
    violations.push("Cache source revalidation disabled");
  if (!checklist.cacheStampedeProtected) violations.push("Cache stampede protection missing");

  // §17 Security
  if (checklist.directInjectionPassRate < 1.0)
    violations.push("Direct injection pass rate below 100%");
  if (checklist.ssrfPassRate < 1.0) violations.push("SSRF pass rate below 100%");

  // §17 Providers
  if (!checklist.noDeadModelsRemaining)
    violations.push("Deprecated or dead model IDs remain in registry");
  if (!checklist.embeddingDimension768Validated)
    violations.push("Embedding 768-dimension invariant violated");

  // §17 Quality & SLOs
  if (checklist.qualityMetrics.recallAtK < 0.95)
    violations.push(
      `High-current Recall@10 below 95% (${(checklist.qualityMetrics.recallAtK * 100).toFixed(1)}%)`,
    );
  if (checklist.qualityMetrics.unsupportedClaimRate > 0)
    violations.push("Unsupported critical claims detected");
  if (checklist.qualityMetrics.citationCorrectness < 1.0)
    violations.push("Citation correctness below 100%");

  if (checklist.p95LatencyMs > 8000)
    violations.push(`p95 latency exceeds 8s (${checklist.p95LatencyMs}ms)`);
  if (checklist.cacheHitP95LatencyMs > 1500)
    violations.push(`Cache hit p95 latency exceeds 1.5s (${checklist.cacheHitP95LatencyMs}ms)`);

  const totalChecks = 16;
  const passedChecks = totalChecks - violations.length;
  const scorePercentage = (passedChecks / totalChecks) * 100;

  return {
    accepted: violations.length === 0,
    scorePercentage,
    violations,
  };
}
