/**
 * Plan Executor - Executes approved plans step-by-step.
 * Responsibility: Execute each step, store results, update context, determine next action.
 * Handles tool execution, result storage, and success criteria checking.
 */

import { ExecutionPlan, ExecutionStep } from './planner-agent';
import { SAFETY_LIMITS, checkLimitExceeded } from './safety-limits';
import { ExecutionState, ExecutionStateMachine } from './execution-state-machine';
import { getDb } from './db';
import { planExecutions } from '../drizzle/schema';
import { randomUUID } from 'crypto';

export interface ExecutionContext {
  planId: string;
  stepResults: Map<number, unknown>; // step number -> result
  accumulatedData: Record<string, unknown>; // Accumulated context across steps
  toolsUsed: string[];
  startTime: Date;
}

export interface ExecutionResult {
  status: 'success' | 'partial_success' | 'failed';
  reason?: string;
  finalAnswer?: string;
  executionTrace: Array<{
    stepNumber: number;
    tool: string;
    status: 'success' | 'error' | 'timeout';
    result?: unknown;
    error?: string;
  }>;
}

/**
 * Execute an approved plan step-by-step.
 */
export async function executePlan(
  plan: ExecutionPlan,
  stateMachine: ExecutionStateMachine,
  toolExecutor: (toolName: string, inputs: Record<string, unknown>, context: ExecutionContext) => Promise<unknown>
): Promise<ExecutionResult> {
  const context: ExecutionContext = {
    planId: plan.planId,
    stepResults: new Map(),
    accumulatedData: {},
    toolsUsed: [],
    startTime: new Date(),
  };

  const executionTrace: ExecutionResult['executionTrace'] = [];
  let toolIterationCount = 0;

  try {
    // Transition to EXECUTING state
    stateMachine.transition(ExecutionState.EXECUTING, 'Starting plan execution');

    // Execute each step in the plan
    for (const step of plan.executionSteps) {
      // Check tool iteration limit
      const limitExceeded = checkLimitExceeded('MAX_TOOL_ITERATIONS', toolIterationCount);
      if (limitExceeded) {
        return {
          status: 'partial_success',
          reason: limitExceeded.message,
          executionTrace,
        };
      }

      toolIterationCount++;

      try {
        // Check if dependencies are met
        const dependenciesMet = step.dependencies.every((depStep) => context.stepResults.has(depStep));

        if (!dependenciesMet) {
          const missingDeps = step.dependencies.filter((depStep) => !context.stepResults.has(depStep));
          throw new Error(`Missing dependencies: steps ${missingDeps.join(', ')}`);
        }

        // Transition to WAITING_FOR_TOOL
        stateMachine.transition(ExecutionState.WAITING_FOR_TOOL, `Executing step ${step.stepNumber}: ${step.action}`);

        // Execute the tool
        const startMs = Date.now();
        const result = await toolExecutor(step.tool, step.inputs, context);
        const durationMs = Date.now() - startMs;

        // Store result
        context.stepResults.set(step.stepNumber, result);
        context.toolsUsed.push(step.tool);
        context.accumulatedData[`step_${step.stepNumber}_result`] = result;

        // Log execution to database
        const db = await getDb();
        if (db) {
          await db.insert(planExecutions).values({
          executionId: randomUUID(),
          planId: plan.planId,
          stepNumber: step.stepNumber,
          toolId: step.tool,
          toolName: step.tool,
          toolInput: step.inputs,
          toolOutput: result as any,
          executionStatus: 'success',
          executionTimeMs: durationMs,
          contextBefore: step.dependencies.length > 0 ? { dependsOn: step.dependencies } : undefined,
          contextAfter: { stepComplete: true },
        });
        }

        executionTrace.push({
          stepNumber: step.stepNumber,
          tool: step.tool,
          status: 'success',
          result,
        });

        // Transition back to EXECUTING
        stateMachine.transition(ExecutionState.EXECUTING, `Step ${step.stepNumber} completed`);
      } catch (stepError) {
        const errorMessage = stepError instanceof Error ? stepError.message : String(stepError);

        // Log failed execution
        const db = await getDb();
        if (db) {
          await db.insert(planExecutions).values({
          executionId: randomUUID(),
          planId: plan.planId,
          stepNumber: step.stepNumber,
          toolId: step.tool,
          toolName: step.tool,
          toolInput: step.inputs,
          executionStatus: 'error',
          errorMessage,
        });
        }

        executionTrace.push({
          stepNumber: step.stepNumber,
          tool: step.tool,
          status: 'error',
          error: errorMessage,
        });

        // Return partial success with the error
        return {
          status: 'partial_success',
          reason: `Step ${step.stepNumber} failed: ${errorMessage}`,
          executionTrace,
        };
      }
    }

    // All steps completed successfully
    // Transition to REVIEWING
    stateMachine.transition(ExecutionState.REVIEWING, 'All steps completed, awaiting review');

    // Check success criteria
    const successCriteriaMet = plan.successCriteria.length === 0 || plan.successCriteria.every((criterion) => {
      // Simple check: if criterion mentions a step, verify that step succeeded
      const stepMatch = criterion.match(/step (\d+)/i);
      if (stepMatch) {
        const stepNum = parseInt(stepMatch[1]);
        return context.stepResults.has(stepNum);
      }
      return true;
    });

    if (!successCriteriaMet) {
      return {
        status: 'failed',
        reason: 'Success criteria not met',
        executionTrace,
      };
    }

    return {
      status: 'success',
      finalAnswer: `Plan executed successfully. Processed ${plan.executionSteps.length} steps using tools: ${context.toolsUsed.join(', ')}`,
      executionTrace,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    stateMachine.transition(ExecutionState.FAILED, `Execution failed: ${errorMessage}`);

    return {
      status: 'failed',
      reason: errorMessage,
      executionTrace,
    };
  }
}

/**
 * Get execution duration in milliseconds.
 */
export function getExecutionDuration(context: ExecutionContext): number {
  return Date.now() - context.startTime.getTime();
}

/**
 * Get accumulated context from execution.
 */
export function getExecutionContext(context: ExecutionContext): Record<string, unknown> {
  return {
    ...context.accumulatedData,
    toolsUsed: context.toolsUsed,
    stepsCompleted: context.stepResults.size,
  };
}
