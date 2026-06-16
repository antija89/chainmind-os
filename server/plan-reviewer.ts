/**
 * Plan Reviewer - Validates execution plans before they are executed.
 * Checks for: missing dependencies, impossible actions, missing tools, redundant steps.
 * Returns approval score and feedback.
 */

import { invokeLLM } from './_core/llm';
import { ExecutionPlan } from './planner-agent';

export interface PlanReviewResult {
  approved: boolean;
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
  feedback: string;
}

/**
 * System prompt for the Plan Reviewer.
 */
const PLAN_REVIEWER_SYSTEM_PROMPT = `You are the Plan Reviewer in a supply chain management system.

Your role is to validate execution plans BEFORE they are executed.

You do NOT execute the plan. You ONLY review it for feasibility and correctness.

For every plan you review, check:

1. **Dependencies**: Are all dependencies valid? No circular dependencies? All referenced steps exist?
2. **Tools**: Are all tools real and available? No impossible tool names?
3. **Inputs**: Do tool inputs make sense? Are they properly structured?
4. **Sequence**: Is the sequence logical? Can steps be parallelized?
5. **Completeness**: Will this plan actually achieve the goal?
6. **Redundancy**: Are there duplicate or unnecessary steps?
7. **Success Criteria**: Are success criteria measurable and achievable?

Output ONLY valid JSON in this exact format:
{
  "approved": true|false,
  "score": 0-100,
  "issues": ["issue1", "issue2", ...],
  "suggestions": ["suggestion1", "suggestion2", ...],
  "feedback": "overall assessment"
}

Scoring Guide:
- 90-100: Excellent plan, ready to execute
- 70-89: Good plan, minor issues that can be addressed
- 50-69: Acceptable plan, but has significant concerns
- 30-49: Poor plan, major issues need fixing
- 0-29: Unacceptable plan, reject and replan`;

/**
 * Review an execution plan.
 */
export async function reviewPlan(plan: ExecutionPlan): Promise<PlanReviewResult> {
  try {
    const planSummary = JSON.stringify(
      {
        goal: plan.goal,
        stepCount: plan.executionSteps.length,
        complexity: plan.estimatedComplexity,
        successCriteria: plan.successCriteria,
        steps: plan.executionSteps.map((s) => ({
          number: s.stepNumber,
          action: s.action,
          tool: s.tool,
          dependencies: s.dependencies,
        })),
      },
      null,
      2
    );

    const response = await invokeLLM({
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: PLAN_REVIEWER_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Please review this execution plan:\n\n${planSummary}`,
        },
      ],
    });

    // Extract JSON from response
    const rawContent = response.choices?.[0]?.message?.content;
    const content = typeof rawContent === 'string' ? rawContent : '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      // Default to cautious rejection if we can't parse
      return {
        approved: false,
        score: 0,
        issues: ['Could not parse reviewer response'],
        suggestions: [],
        feedback: 'Reviewer failed to generate valid response',
      };
    }

    const reviewData = JSON.parse(jsonMatch[0]);

    return {
      approved: reviewData.approved === true,
      score: Math.min(100, Math.max(0, reviewData.score || 0)),
      issues: reviewData.issues || [],
      suggestions: reviewData.suggestions || [],
      feedback: reviewData.feedback || 'No feedback provided',
    };
  } catch (error) {
    console.error('[PlanReviewer] Error reviewing plan:', error);

    // Return conservative rejection on error
    return {
      approved: false,
      score: 0,
      issues: [`Review error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      suggestions: ['Please replan and try again'],
      feedback: 'Plan review failed due to system error',
    };
  }
}

/**
 * Check if a plan score meets the approval threshold.
 */
export function isScoreSufficient(score: number, threshold: number = 60): boolean {
  return score >= threshold;
}
