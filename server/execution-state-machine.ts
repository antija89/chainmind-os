/**
 * Execution State Machine for autonomous agent workflows.
 * Manages state transitions through the complete execution lifecycle.
 * States: PLANNING → PLAN_REVIEW → EXECUTING → WAITING_FOR_TOOL → REVIEWING → REPLANNING → TOOL_CREATION → COMPLETED/FAILED
 */

export enum ExecutionState {
  // Initial state: Planner generates structured execution plan from user request
  PLANNING = 'PLANNING',

  // Plan Reviewer validates the plan for feasibility, dependencies, and completeness
  PLAN_REVIEW = 'PLAN_REVIEW',

  // Executor is running tools according to the plan
  EXECUTING = 'EXECUTING',

  // Executor is waiting for a tool to complete (async tool execution)
  WAITING_FOR_TOOL = 'WAITING_FOR_TOOL',

  // Reviewer Agent is evaluating the execution results against evidence
  REVIEWING = 'REVIEWING',

  // Planner is generating an updated plan due to failure or missing information
  REPLANNING = 'REPLANNING',

  // Tool Creation Agent is generating a new tool to fulfill a missing capability
  TOOL_CREATION = 'TOOL_CREATION',

  // Execution completed successfully
  COMPLETED = 'COMPLETED',

  // Execution failed and cannot proceed
  FAILED = 'FAILED',
}

/**
 * Valid state transitions in the execution state machine.
 * Ensures deterministic execution flow and prevents invalid state changes.
 */
const VALID_TRANSITIONS: Record<ExecutionState, ExecutionState[]> = {
  [ExecutionState.PLANNING]: [ExecutionState.PLAN_REVIEW, ExecutionState.FAILED],
  [ExecutionState.PLAN_REVIEW]: [ExecutionState.EXECUTING, ExecutionState.REPLANNING, ExecutionState.FAILED],
  [ExecutionState.EXECUTING]: [ExecutionState.WAITING_FOR_TOOL, ExecutionState.REVIEWING, ExecutionState.COMPLETED, ExecutionState.FAILED],
  [ExecutionState.WAITING_FOR_TOOL]: [ExecutionState.EXECUTING, ExecutionState.FAILED],
  [ExecutionState.REVIEWING]: [ExecutionState.EXECUTING, ExecutionState.REPLANNING, ExecutionState.TOOL_CREATION, ExecutionState.COMPLETED, ExecutionState.FAILED],
  [ExecutionState.REPLANNING]: [ExecutionState.PLAN_REVIEW, ExecutionState.FAILED],
  [ExecutionState.TOOL_CREATION]: [ExecutionState.EXECUTING, ExecutionState.FAILED],
  [ExecutionState.COMPLETED]: [],
  [ExecutionState.FAILED]: [],
};

/**
 * State transition result with metadata.
 */
export interface StateTransition {
  fromState: ExecutionState;
  toState: ExecutionState;
  timestamp: Date;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Execution state machine instance for a single conversation/plan.
 */
export class ExecutionStateMachine {
  private currentState: ExecutionState = ExecutionState.PLANNING;
  private transitions: StateTransition[] = [];
  private startTime: Date = new Date();

  constructor(initialState: ExecutionState = ExecutionState.PLANNING) {
    this.currentState = initialState;
  }

  /**
   * Get the current execution state.
   */
  getState(): ExecutionState {
    return this.currentState;
  }

  /**
   * Transition to a new state if valid.
   * Throws error if transition is invalid.
   */
  transition(nextState: ExecutionState, reason?: string, metadata?: Record<string, unknown>): StateTransition {
    const validNextStates = VALID_TRANSITIONS[this.currentState];

    if (!validNextStates.includes(nextState)) {
      throw new Error(
        `Invalid state transition: ${this.currentState} → ${nextState}. Valid transitions: ${validNextStates.join(', ')}`
      );
    }

    const transition: StateTransition = {
      fromState: this.currentState,
      toState: nextState,
      timestamp: new Date(),
      reason,
      metadata,
    };

    this.transitions.push(transition);
    this.currentState = nextState;

    return transition;
  }

  /**
   * Get all state transitions that have occurred.
   */
  getTransitions(): StateTransition[] {
    return [...this.transitions];
  }

  /**
   * Get execution duration since state machine was created.
   */
  getDuration(): number {
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Check if execution is in a terminal state (completed or failed).
   */
  isTerminal(): boolean {
    return this.currentState === ExecutionState.COMPLETED || this.currentState === ExecutionState.FAILED;
  }

  /**
   * Get a human-readable description of the current state.
   */
  getStateDescription(): string {
    const descriptions: Record<ExecutionState, string> = {
      [ExecutionState.PLANNING]: 'Planning execution steps',
      [ExecutionState.PLAN_REVIEW]: 'Reviewing execution plan',
      [ExecutionState.EXECUTING]: 'Executing plan steps',
      [ExecutionState.WAITING_FOR_TOOL]: 'Waiting for tool to complete',
      [ExecutionState.REVIEWING]: 'Reviewing execution results',
      [ExecutionState.REPLANNING]: 'Replanning due to failure',
      [ExecutionState.TOOL_CREATION]: 'Creating new tool',
      [ExecutionState.COMPLETED]: 'Execution completed',
      [ExecutionState.FAILED]: 'Execution failed',
    };

    return descriptions[this.currentState];
  }
}

/**
 * Serialize state machine to JSON for database storage.
 */
export function serializeStateMachine(machine: ExecutionStateMachine): string {
  return JSON.stringify({
    currentState: machine.getState(),
    transitions: machine.getTransitions(),
    duration: machine.getDuration(),
  });
}

/**
 * Deserialize state machine from JSON.
 */
export function deserializeStateMachine(json: string): ExecutionStateMachine {
  const data = JSON.parse(json);
  const machine = new ExecutionStateMachine(data.currentState);

  // Replay transitions (optional - for now just restore current state)
  return machine;
}
