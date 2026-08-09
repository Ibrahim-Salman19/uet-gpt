import { UETGPT_EXECUTION_POLICY } from "../agent/policy";

export interface SecurityGuardResult {
  passed: boolean;
  reasonCode?: string;
  sanitizedInput?: string;
  confidence?: number;
}

export const INJECTION_PATTERNS = [
  /ignore\s+(previous|above)\s+instructions/i,
  /system\s+prompt\s+override/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /reveal\s+your\s+instructions/i,
  /bypass\s+(security|policy|rules)/i,
  /<script[\s\S]*?>[\s\S]*?<\/script>/i,
];

export function evaluateSecurityGateway(input: string): SecurityGuardResult {
  if (!input || input.trim().length === 0) {
    return { passed: false, reasonCode: "EMPTY_INPUT" };
  }

  if (input.length > UETGPT_EXECUTION_POLICY.maxRequestCharacters) {
    return { passed: false, reasonCode: "REQUEST_LENGTH_EXCEEDED" };
  }

  // Strip null bytes and control characters first
  const sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();

  // Layer A: Deterministic injection detection
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      return {
        passed: false,
        reasonCode: "PROMPT_INJECTION_DETECTED",
        confidence: 0.99,
      };
    }
  }

  return {
    passed: true,
    sanitizedInput: sanitized,
    confidence: 1.0,
  };
}
