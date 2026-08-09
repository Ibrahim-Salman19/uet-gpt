import type { ReasonCode } from "./policy";

export interface ResourceBudget {
  maxTimeoutMs: number;
  maxModelCalls: number;
  maxToolCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxDatabaseReads: number;
  maxDatabaseWrites: number;
  maxVectorRequests: number;
  maxNetworkBytes: number;
  maxRetryAllowance: number;
}

export interface TelemetrySchema {
  spanName: string;
  requiredAttributes: string[];
  sensitiveDataMasked: boolean;
}

export interface ProductionPhaseContract<Input, Output> {
  phaseName: string;
  version: string;
  owner: string;

  preconditions: Array<(input: Input) => boolean | string>;
  postconditions: Array<(output: Output) => boolean | string>;
  invariants: Array<() => boolean | string>;

  timeoutMs: number;
  maximumAttempts: number;
  resourceBudget: ResourceBudget;

  failureClasses: ReasonCode[];
  telemetrySchema: TelemetrySchema;

  featureFlagKey: string;
  killSwitchActive: boolean;
}

export function validatePhasePreconditions<Input>(
  contract: ProductionPhaseContract<Input, unknown>,
  input: Input,
): { valid: boolean; error?: string } {
  if (contract.killSwitchActive) {
    return { valid: false, error: `Phase ${contract.phaseName} killed by emergency switch.` };
  }

  for (const check of contract.preconditions) {
    const res = check(input);
    if (res !== true) {
      return {
        valid: false,
        error: typeof res === "string" ? res : `Precondition failed in ${contract.phaseName}`,
      };
    }
  }

  return { valid: true };
}

export function validatePhasePostconditions<Output>(
  contract: ProductionPhaseContract<unknown, Output>,
  output: Output,
): { valid: boolean; error?: string } {
  for (const check of contract.postconditions) {
    const res = check(output);
    if (res !== true) {
      return {
        valid: false,
        error: typeof res === "string" ? res : `Postcondition failed in ${contract.phaseName}`,
      };
    }
  }

  for (const check of contract.invariants) {
    const res = check();
    if (res !== true) {
      return {
        valid: false,
        error: typeof res === "string" ? res : `Invariant violation in ${contract.phaseName}`,
      };
    }
  }

  return { valid: true };
}
