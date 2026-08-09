import { v } from "convex/values";
import { action } from "../_generated/server";
import { buildUntrustedContext } from "../generation/context";
import { type CandidateEvidenceSummary, evaluateEvidenceGate } from "../governance/evidenceGate";
import { classifyQueryRuleBased, type QueryUnderstanding } from "../routing/understandQuery";
import { evaluateSecurityGateway } from "../security/requestGuard";
import { AgentExecutionTracker } from "./state";

export interface WorkflowExecuteInput {
  queryText: string;
  mockCandidates?: CandidateEvidenceSummary[];
}

export interface WorkflowExecuteOutput {
  runId: string;
  finalState: string;
  decision: string;
  reasonCode: string;
  queryUnderstanding: QueryUnderstanding;
  answer?: string;
  contextXml?: string;
  latencyMs: number;
}

export function executeAgentWorkflowSync(input: WorkflowExecuteInput): WorkflowExecuteOutput {
  const tracker = new AgentExecutionTracker();

  // Step 1: Security Gateway
  const secResult = evaluateSecurityGateway(input.queryText);
  if (!secResult.passed) {
    tracker.recordTransition("refused", secResult.reasonCode || "PROMPT_INJECTION_DETECTED");
    return {
      runId: tracker.runId,
      finalState: "refused",
      decision: "refuse",
      reasonCode: secResult.reasonCode || "PROMPT_INJECTION_DETECTED",
      queryUnderstanding: classifyQueryRuleBased(input.queryText),
      latencyMs: Date.now() - tracker.startTime,
    };
  }

  tracker.recordTransition("security_checked", "SECURITY_PASSED");

  // Step 2: Query Understanding & Risk Classification
  const queryUnderstanding = classifyQueryRuleBased(secResult.sanitizedInput || input.queryText);
  tracker.recordTransition("classified", "CLASSIFIED_SUCCESSFULLY", {
    risk: queryUnderstanding.risk,
    intent: queryUnderstanding.intent,
  });

  // Step 3: Evidence Decision Gate
  const candidates: CandidateEvidenceSummary[] = input.mockCandidates || [];
  const gateResult = evaluateEvidenceGate({
    queryRisk: queryUnderstanding.risk,
    temporalIntent: queryUnderstanding.temporalIntent,
    candidates,
  });

  tracker.recordTransition("evidence_evaluated", gateResult.reasonCode, {
    decision: gateResult.decision,
  });

  if (gateResult.decision === "abstain" || gateResult.decision === "refuse") {
    const finalState = gateResult.decision === "abstain" ? "abstained" : "refused";
    tracker.recordTransition(finalState, gateResult.reasonCode);
    return {
      runId: tracker.runId,
      finalState,
      decision: gateResult.decision,
      reasonCode: gateResult.reasonCode,
      queryUnderstanding,
      answer:
        gateResult.decision === "abstain"
          ? "I am unable to answer with certainty because fresh, authoritative UET Taxila evidence is not currently available or conflicting information was detected."
          : "Your query could not be processed due to policy restrictions or lack of eligible source evidence.",
      latencyMs: Date.now() - tracker.startTime,
    };
  }

  // Step 4: Context Construction
  const mockEvidenceForContext = candidates.map((c) => ({
    id: c.id,
    title: `Official Document ${c.id}`,
    url: "https://uettaxila.edu.pk/official-notice.html",
    authority: c.authority,
    content: "Official UET Taxila evidence content.",
  }));

  const contextXml = buildUntrustedContext(mockEvidenceForContext);
  tracker.recordTransition("generation_allowed", "APPROVED_FOR_GENERATION");

  // Step 5: Final Grounded Completion
  tracker.recordTransition("completed", "WORKFLOW_SUCCESS");

  return {
    runId: tracker.runId,
    finalState: "completed",
    decision: gateResult.decision,
    reasonCode: gateResult.reasonCode,
    queryUnderstanding,
    answer: "Based on official UET Taxila evidence, here is the requested information.",
    contextXml,
    latencyMs: Date.now() - tracker.startTime,
  };
}

export const executeAgentWorkflowAction = action({
  args: {
    queryText: v.string(),
  },
  handler: async (_ctx, args) => {
    return executeAgentWorkflowSync({ queryText: args.queryText });
  },
});
