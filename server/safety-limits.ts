/**
 * Global safety limits for autonomous agent execution.
 * Prevents infinite loops, excessive resource consumption, and runaway behavior.
 */

export const SAFETY_LIMITS = {
  /**
   * Maximum number of tool calls per plan execution.
   * If exceeded, execution stops and returns partial_success status.
   */
  MAX_TOOL_ITERATIONS: 10,

  /**
   * Maximum number of times the Reviewer can request changes/retries.
   * Prevents infinite review cycles.
   */
  MAX_REVIEW_ITERATIONS: 3,

  /**
   * Maximum number of times a plan can be replanned due to failures.
   * If exceeded, execution stops with failure status.
   */
  MAX_REPLANS: 3,

  /**
   * Maximum number of new tools that can be created in a single execution.
   * Prevents tool creation loops.
   */
  MAX_TOOL_CREATIONS: 1,
} as const;

/**
 * Execution result status when safety limits are exceeded.
 */
export type ExecutionLimitStatus = 'partial_success' | 'failed';

export interface ExecutionLimitExceeded {
  status: ExecutionLimitStatus;
  reason: 'tool_iterations_limit_reached' | 'review_iterations_limit_reached' | 'replans_limit_reached' | 'tool_creations_limit_reached';
  message: string;
  iterationsUsed: number;
  limit: number;
}

/**
 * Check if a limit has been exceeded and return the result.
 */
export function checkLimitExceeded(
  limitType: keyof typeof SAFETY_LIMITS,
  currentCount: number
): ExecutionLimitExceeded | null {
  const limit = SAFETY_LIMITS[limitType];

  if (currentCount >= limit) {
    const reasonMap = {
      MAX_TOOL_ITERATIONS: 'tool_iterations_limit_reached',
      MAX_REVIEW_ITERATIONS: 'review_iterations_limit_reached',
      MAX_REPLANS: 'replans_limit_reached',
      MAX_TOOL_CREATIONS: 'tool_creations_limit_reached',
    } as const;

    return {
      status: 'partial_success',
      reason: reasonMap[limitType],
      message: `${limitType} limit (${limit}) exceeded. Execution stopped.`,
      iterationsUsed: currentCount,
      limit,
    };
  }

  return null;
}
