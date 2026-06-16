/**
 * Planner Agent - Converts user intent into structured execution plans.
 * Responsibility: Understand goals, decompose tasks, identify dependencies, define success criteria.
 * Never executes tools - only plans.
 */

import { invokeLLM } from './_core/llm';
import { randomUUID } from 'crypto';

export interface ExecutionStep {
  stepNumber: number;
  action: string;
  tool: string;
  inputs: Record<string, unknown>;
  expectedOutput: string;
  dependencies: number[]; // Step numbers this step depends on
}

export interface ExecutionPlan {
  planId: string;
  goal: string;
  requiredInformation: string[];
  executionSteps: ExecutionStep[];
  dependencies: Record<number, number[]>; // step -> [dependent steps]
  successCriteria: string[];
  estimatedComplexity: 'simple' | 'medium' | 'complex';
}

/**
 * System prompt for the Planner Agent.
 * Instructs LLM to convert user requests into structured plans.
 */
const PLANNER_SYSTEM_PROMPT = `You are the Planner Agent in a supply chain management system.

Your role is to convert user requests into detailed, structured execution plans.

You NEVER execute tools or provide direct answers. You ONLY plan.

For every user request:

1. Understand the Goal: What is the user trying to accomplish?
2. Identify Required Information: What data/context is needed to complete this goal?
3. Decompose into Steps: Break the goal into sequential, atomic steps.
4. Define Dependencies: Which steps must complete before others can start?
5. Define Success Criteria: How will we know the plan succeeded?

Output ONLY valid JSON in this exact format:
{
  "goal": "user's goal in one sentence",
  "requiredInformation": ["field1", "field2", ...],
  "executionSteps": [
    {
      "stepNumber": 1,
      "action": "what this step accomplishes",
      "tool": "tool_name_to_use",
      "inputs": {"param1": "value1", ...},
      "expectedOutput": "what we expect from this tool",
      "dependencies": []
    },
    ...
  ],
  "dependencies": {
    "2": [1],
    "3": [1, 2]
  },
  "successCriteria": ["criterion1", "criterion2", ...],
  "estimatedComplexity": "simple|medium|complex"
}

Rules:
- Tool names must be real supply chain tools (e.g., query_sales_history, calculate_dos, run_forecast)
- Steps must be sequential and logical
- Dependencies must form a valid DAG (no cycles)
- Success criteria must be measurable
- Never guess tool names - use only known supply chain tools
- If you don't know the right tool, use "query_database" as a fallback`;

/**
 * Generate an execution plan from a user request.
 */
export async function generatePlan(userRequest: string, agentId: string): Promise<ExecutionPlan> {
  const planId = randomUUID();

  try {
    const response = await invokeLLM({
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: PLANNER_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Please create an execution plan for this request: ${userRequest}`,
        },
      ],
    });

    // Extract JSON from response
    const rawContent = response.choices?.[0]?.message?.content;
    const content = typeof rawContent === 'string' ? rawContent : '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Planner did not return valid JSON');
    }

    const planData = JSON.parse(jsonMatch[0]);

    // Validate and structure the plan
    const plan: ExecutionPlan = {
      planId,
      goal: planData.goal || userRequest,
      requiredInformation: planData.requiredInformation || [],
      executionSteps: (planData.executionSteps || []).map((step: any, index: number) => ({
        stepNumber: index + 1,
        action: step.action,
        tool: step.tool,
        inputs: step.inputs || {},
        expectedOutput: step.expectedOutput,
        dependencies: step.dependencies || [],
      })),
      dependencies: planData.dependencies || {},
      successCriteria: planData.successCriteria || [],
      estimatedComplexity: planData.estimatedComplexity || 'medium',
    };

    return plan;
  } catch (error) {
    console.error('[Planner] Error generating plan:', error);

    // Fallback: Create a simple single-step plan
    return {
      planId,
      goal: userRequest,
      requiredInformation: [],
      executionSteps: [
        {
          stepNumber: 1,
          action: 'Execute user request',
          tool: 'query_database',
          inputs: { query: userRequest },
          expectedOutput: 'Result from query',
          dependencies: [],
        },
      ],
      dependencies: {},
      successCriteria: ['Request completed'],
      estimatedComplexity: 'simple',
    };
  }
}

/**
 * Replan when execution fails.
 * Called when a tool fails, returns empty results, or required information is missing.
 */
export async function replan(
  originalPlan: ExecutionPlan,
  failureReason: string,
  currentContext: Record<string, unknown>
): Promise<ExecutionPlan> {
  const newPlanId = randomUUID();

  try {
    const response = await invokeLLM({
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: PLANNER_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Original goal: ${originalPlan.goal}

Original plan failed with reason: ${failureReason}

Current context: ${JSON.stringify(currentContext)}

Please create an updated execution plan that addresses the failure and uses the current context.`,
        },
      ],
    });

    // Extract and parse JSON
    const rawContent = response.choices?.[0]?.message?.content;
    const content = typeof rawContent === 'string' ? rawContent : '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      // Return original plan if replan fails
      return { ...originalPlan, planId: newPlanId };
    }

    const planData = JSON.parse(jsonMatch[0]);

    const newPlan: ExecutionPlan = {
      planId: newPlanId,
      goal: planData.goal || originalPlan.goal,
      requiredInformation: planData.requiredInformation || originalPlan.requiredInformation,
      executionSteps: (planData.executionSteps || []).map((step: any, index: number) => ({
        stepNumber: index + 1,
        action: step.action,
        tool: step.tool,
        inputs: step.inputs || {},
        expectedOutput: step.expectedOutput,
        dependencies: step.dependencies || [],
      })),
      dependencies: planData.dependencies || {},
      successCriteria: planData.successCriteria || originalPlan.successCriteria,
      estimatedComplexity: planData.estimatedComplexity || 'medium',
    };

    return newPlan;
  } catch (error) {
    console.error('[Planner] Error replanning:', error);
    // Return original plan if replan fails
    return { ...originalPlan, planId: newPlanId };
  }
}
