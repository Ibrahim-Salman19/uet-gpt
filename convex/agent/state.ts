import { type AgentRunState, type ReasonCode, UETGPT_EXECUTION_POLICY } from "./policy";

export interface StateTransitionRecord {
  fromState: AgentRunState | null;
  toState: AgentRunState;
  timestamp: number;
  reasonCode?: ReasonCode | string;
  metadata?: Record<string, unknown>;
}

export class AgentExecutionTracker {
  public readonly runId: string;
  public readonly startTime: number;
  public currentState: AgentRunState;
  public stateHistory: StateTransitionRecord[] = [];
  public modelTurns = 0;
  public toolCalls = 0;
  public queryVariantsCount = 0;

  constructor(runId?: string) {
    this.runId = runId || `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.startTime = Date.now();
    this.currentState = "received";
    this.recordTransition("received", "Initialization");
  }

  public recordTransition(
    newState: AgentRunState,
    reasonCode?: ReasonCode | string,
    metadata?: Record<string, unknown>,
  ): void {
    const record: StateTransitionRecord = {
      fromState: this.stateHistory.length > 0 ? this.currentState : null,
      toState: newState,
      timestamp: Date.now(),
      reasonCode,
      metadata,
    };
    this.currentState = newState;
    this.stateHistory.push(record);
  }

  public incrementModelTurn(): void {
    this.modelTurns += 1;
    if (this.modelTurns > UETGPT_EXECUTION_POLICY.maxModelTurns) {
      this.recordTransition("failed", "DEADLINE_EXCEEDED", {
        detail: "Exceeded maxModelTurns limit",
      });
      throw new Error(`Max model turns (${UETGPT_EXECUTION_POLICY.maxModelTurns}) exceeded.`);
    }
  }

  public incrementToolCall(): void {
    this.toolCalls += 1;
    if (this.toolCalls > UETGPT_EXECUTION_POLICY.maxToolCalls) {
      this.recordTransition("failed", "DEADLINE_EXCEEDED", {
        detail: "Exceeded maxToolCalls limit",
      });
      throw new Error(`Max tool calls (${UETGPT_EXECUTION_POLICY.maxToolCalls}) exceeded.`);
    }
  }

  public isDeadlineExceeded(budgetMs: number = UETGPT_EXECUTION_POLICY.overallDeadlineMs): boolean {
    return Date.now() - this.startTime > budgetMs;
  }
}
