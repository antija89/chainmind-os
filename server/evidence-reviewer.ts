/**
 * Evidence-Based Reviewer - Evaluates execution results against evidence.
 * Checks: plan completion, tool output validity, claim support, no ignored failures.
 * Replaces text-quality scoring with evidence-based evaluation.
 */

import { invokeLLM } from './_core/llm';
import { ExecutionPlan } from './planner-agent';

export interface ExecutionEvidence {
  question: string;
  plan: ExecutionPlan;
  toolCalls: Array<{
    stepNumber: number;
    tool: string;
    input: Record<string, unknown>;
    output: unknown;
    status: 'success' | 'error';
    error?: string;
  }>;
  answer: string;
}

export interface EvidenceReviewResult {
  approved: boolean;
  score: number; // 0-100
  issues: string[];
  requiredActions: string[];
  feedback: string;
}

/**
 * System prompt for evidence-based review.
 */
const EVIDENCE_REVIEWER_SYSTEM_PROMPT = `You are the Evidence-Based Reviewer in a supply chain management system.

Your role is to evaluate execution results against EVIDENCE, not writing quality.

You receive:
1. Original question
2. Execution plan
3. Tool calls with outputs
4. Final answer

You check:

1. **Plan Completion**: Did the plan execute fully? Are all steps accounted for?
2. **Tool Output Validity**: Are tool outputs real data or hallucinations?
3. **Claim Support**: Is every claim in the answer supported by tool output?
4. **No Ignored Failures**: Were tool failures acknowledged? No sweeping errors under the rug?
5. **Success Criteria**: Does the answer satisfy the original success criteria?

Output ONLY valid JSON:
{
  "approved": true|false,
  "score": 0-100,
  "issues": ["issue1", ...],
  "requiredActions": ["action1", ...],
  "feedback": "assessment"
}

Scoring Guide:
- 90-100: All evidence present, all claims supported, all criteria met
- 70-89: Most evidence present, minor unsupported claims
- 50-69: Some evidence missing, several unsupported claims
- 30-49: Major evidence gaps, many unsupported claims
- 0-29: No evidence, answer is hallucination

CRITICAL: If a tool failed, the answer MUST acknowledge it. No sweeping failures under the rug.`;

/**
 * Review execution results based on evidence.
 */
export async function reviewEvidence(evidence: ExecutionEvidence): Promise<EvidenceReviewResult> {
  try {
    // Summarize evidence for the reviewer
    const evidenceSummary = {
      question: evidence.question,
      planGoal: evidence.plan.goal,
      planSteps: evidence.plan.executionSteps.length,
      successCriteria: evidence.plan.successCriteria,
      toolCalls: evidence.toolCalls.map((call) => ({
        step: call.stepNumber,
        tool: call.tool,
        status: call.status,
        hasOutput: call.output !== null && call.output !== undefined,
        errorIfAny: call.error,
      })),
      answer: evidence.answer,
    };

    const response = await invokeLLM({
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: EVIDENCE_REVIEWER_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Please review this execution result:\n\n${JSON.stringify(evidenceSummary, null, 2)}`,
        },
      ],
    });

    // Extract JSON
    const rawContent = response.choices?.[0]?.message?.content;
    const content = typeof rawContent === 'string' ? rawContent : '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return {
        approved: false,
        score: 0,
        issues: ['Reviewer failed to generate valid response'],
        requiredActions: ['Rerun execution and review'],
        feedback: 'Could not parse reviewer response',
      };
    }

    const reviewData = JSON.parse(jsonMatch[0]);

    return {
      approved: reviewData.approved === true,
      score: Math.min(100, Math.max(0, reviewData.score || 0)),
      issues: reviewData.issues || [],
      requiredActions: reviewData.requiredActions || [],
      feedback: reviewData.feedback || 'No feedback',
    };
  } catch (error) {
    console.error('[EvidenceReviewer] Error reviewing evidence:', error);

    return {
      approved: false,
      score: 0,
      issues: [`Review error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      requiredActions: ['Rerun execution'],
      feedback: 'Evidence review failed',
    };
  }
}

/**
 * Check if all claims in an answer are supported by tool outputs.
 */
export function validateClaimSupport(answer: string, toolOutputs: unknown[]): { valid: boolean; unsupportedClaims: string[] } {
  // Simple heuristic: check if answer contains specific numbers/data from tool outputs
  const unsupportedClaims: string[] = [];

  // Extract numeric claims from answer
  const numberClaims = answer.match(/\d+[\d,]*\.?\d*/g) || [];

  // Check if those numbers appear in tool outputs
  const toolOutputStr = JSON.stringify(toolOutputs);
  for (const claim of numberClaims) {
    if (!toolOutputStr.includes(claim)) {
      unsupportedClaims.push(`Number "${claim}" not found in tool outputs`);
    }
  }

  return {
    valid: unsupportedClaims.length === 0,
    unsupportedClaims: unsupportedClaims.slice(0, 5), // Limit to 5 issues
  };
}
