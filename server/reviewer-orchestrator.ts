/**
 * Reviewer Agent Orchestration Engine
 *
 * The Reviewer Agent acts as a central thinking orchestrator:
 * 1. Evaluates every agent response for quality using LLM
 * 2. If inadequate: generates step-by-step guidance
 * 3. Retries the agent with that guidance
 * 4. If tool missing: requests tool creation from Tool Agent
 * 5. Logs all inter-agent conversations for full visibility
 *
 * Flow:
 *   User → Agent → [Reviewer evaluates] → [if poor: Reviewer guides Agent]
 *                                        → [if tool missing: Reviewer → Tool Agent → Agent]
 *                                        → [if good: pass through to user]
 */

import { invokeLLM } from './_core/llm';
import { getDb } from './db';
import { nanoid } from 'nanoid';
import { createGuidance } from './db-supervision';
import { reviewerConversations } from '../drizzle/schema';
import { eq, or, desc } from 'drizzle-orm';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReviewerEvaluation {
  quality: 'excellent' | 'good' | 'poor' | 'blank' | 'wrong_tool' | 'needs_data';
  score: number; // 0-100
  issues: string[];
  guidance: string;
  steps: string[];
  needsRetry: boolean;
  needsToolCreation: boolean;
  suggestedToolName?: string;
  suggestedToolDescription?: string;
  escalate: boolean;
}

export interface InterAgentMessage {
  conversationId: string;
  sessionId: string;
  supervisionId?: string;
  fromAgent: string;
  toAgent: string;
  messageType: 'review' | 'guidance' | 'retry_request' | 'tool_request' | 'escalation' | 'resolution';
  message: string;
  context?: Record<string, unknown>;
  score?: number;
  createdAt?: Date;
}

export interface ReviewerRetryResult {
  originalResponse: string;
  reviewerEvaluation: ReviewerEvaluation;
  guidanceGiven: string;
  retryResponse?: string;
  retryToolResults?: unknown[];
  interAgentMessages: InterAgentMessage[];
  finalResponse: string;
  wasRetried: boolean;
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

async function saveInterAgentMessage(
  msg: Omit<InterAgentMessage, 'conversationId'>,
  score?: number
): Promise<string> {
  const db = await getDb();
  const conversationId = `rac-${nanoid(12)}`;
  if (!db) return conversationId;
  try {
    await db.insert(reviewerConversations).values({
      conversationId,
      sessionId: msg.sessionId,
      supervisionId: msg.supervisionId || null,
      fromAgent: msg.fromAgent,
      toAgent: msg.toAgent,
      messageType: msg.messageType,
      message: msg.message,
      context: msg.context || null,
      score: score ?? null,
      createdAt: new Date(),
    });
  } catch (err) {
    console.warn('[ReviewerOrchestrator] Failed to save inter-agent message:', err);
  }
  return conversationId;
}

// ─── Core evaluation logic ────────────────────────────────────────────────────

export async function evaluateAgentResponse(params: {
  agentId: string;
  agentName: string;
  userQuestion: string;
  agentResponse: string;
  toolsUsed: string[];
  availableTools: string[];
  sessionId: string;
  supervisionId?: string;
}): Promise<ReviewerEvaluation> {
  const { agentId, agentName, userQuestion, agentResponse, toolsUsed, availableTools } = params;

  // Fast-path: blank or very short response
  if (!agentResponse || agentResponse.trim().length < 10) {
    return {
      quality: 'blank',
      score: 0,
      issues: ['Agent returned a blank or empty response'],
      guidance: `${agentName} must provide a substantive answer. If data is needed, use available tools to fetch it.`,
      steps: [
        'Check if the question requires data from the database',
        'Use the appropriate tool to fetch the required data',
        'Provide a clear, data-backed answer',
      ],
      needsRetry: true,
      needsToolCreation: false,
      escalate: false,
    };
  }

  // Check for explicit refusal to use charts/tools
  const refusalPatterns = [
    'i cannot create charts',
    'i cannot generate',
    'i am unable to',
    "i don't have the ability",
    'i can only provide text',
    'i cannot access',
    'i cannot provide',
    'i cannot directly',
  ];
  const isRefusal = refusalPatterns.some(p => agentResponse.toLowerCase().includes(p));

  if (isRefusal) {
    return {
      quality: 'wrong_tool',
      score: 20,
      issues: ['Agent refused to use available tools or generate requested output'],
      guidance: `${agentName} has tools available to fulfill this request. Use the generate_chart tool for visualizations and data tools for fetching supply chain data.`,
      steps: [
        'Identify which tool is needed for this request',
        'Call the tool with appropriate parameters',
        'Return the tool result to the user',
      ],
      needsRetry: true,
      needsToolCreation: false,
      escalate: false,
    };
  }

  // Use LLM to evaluate quality
  try {
    const evalPrompt = `You are a Quality Reviewer for a Supply Chain AI system. Evaluate this agent response.

AGENT: ${agentName}
USER QUESTION: ${userQuestion}
AGENT RESPONSE: ${agentResponse.substring(0, 1000)}
TOOLS USED: ${toolsUsed.join(', ') || 'none'}
AVAILABLE TOOLS: ${availableTools.join(', ')}

Evaluate the response and return JSON with this exact structure:
{
  "quality": "excellent|good|poor|blank|wrong_tool|needs_data",
  "score": 0-100,
  "issues": ["list of specific issues if any"],
  "guidance": "specific guidance for the agent to improve",
  "steps": ["step 1", "step 2", "step 3"],
  "needsRetry": true/false,
  "needsToolCreation": true/false,
  "suggestedToolName": "tool_name if tool creation needed, else null",
  "suggestedToolDescription": "description if tool creation needed, else null",
  "escalate": true/false
}

Criteria:
- score >= 80: excellent/good, no retry needed
- score 50-79: poor, needs guidance and retry
- score < 50: blank/wrong_tool/needs_data, definitely retry
- needsToolCreation: true only if agent clearly needs a tool that doesn't exist
- escalate: true only if the issue requires human intervention`;

    const evalResponse = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are a quality reviewer. Always respond with valid JSON only.' },
        { role: 'user', content: evalPrompt },
      ],
      response_format: { type: 'json_object' } as any,
    });

    const rawContent = evalResponse?.choices?.[0]?.message?.content;
    const content = typeof rawContent === 'string'
      ? rawContent
      : (Array.isArray(rawContent) ? rawContent.map((c: any) => c.text || '').join('') : null);
    if (content) {
      const parsed = JSON.parse(content);
      return {
        quality: parsed.quality || 'good',
        score: parsed.score || 75,
        issues: parsed.issues || [],
        guidance: parsed.guidance || '',
        steps: parsed.steps || [],
        needsRetry: parsed.needsRetry || false,
        needsToolCreation: parsed.needsToolCreation || false,
        suggestedToolName: parsed.suggestedToolName || undefined,
        suggestedToolDescription: parsed.suggestedToolDescription || undefined,
        escalate: parsed.escalate || false,
      };
    }
  } catch (err) {
    console.warn('[ReviewerOrchestrator] LLM evaluation failed, using heuristic:', err);
  }

  // Fallback heuristic
  const responseLen = agentResponse.trim().length;
  const hasNumbers = /\d/.test(agentResponse);
  const hasData = toolsUsed.length > 0;
  const score = Math.min(100, (responseLen > 200 ? 40 : 20) + (hasNumbers ? 20 : 0) + (hasData ? 30 : 0) + 10);

  return {
    quality: score >= 70 ? 'good' : 'poor',
    score,
    issues: score < 70 ? ['Response may lack sufficient data or detail'] : [],
    guidance: score < 70 ? `${agentName} should use available tools to provide data-backed answers` : '',
    steps: score < 70 ? ['Use available tools to fetch relevant data', 'Provide specific numbers and insights'] : [],
    needsRetry: score < 70,
    needsToolCreation: false,
    escalate: false,
  };
}

// ─── Main orchestration function ─────────────────────────────────────────────

export async function orchestrateWithReviewer(params: {
  agentId: string;
  agentName: string;
  userQuestion: string;
  agentResponse: string;
  toolResults: unknown[];
  availableTools: string[];
  systemPrompt: string;
  sessionId: string;
  supervisionId?: string;
  retryFn: (guidedPrompt: string) => Promise<{ response: string; toolResults: unknown[] }>;
}): Promise<ReviewerRetryResult> {
  const {
    agentId, agentName, userQuestion, agentResponse,
    toolResults, availableTools, sessionId, supervisionId, retryFn,
  } = params;

  const interAgentMessages: InterAgentMessage[] = [];
  const toolsUsed = (toolResults as any[]).map(t => t.toolName || 'unknown');

  // Step 1: Reviewer evaluates the response
  const evaluation = await evaluateAgentResponse({
    agentId, agentName, userQuestion, agentResponse,
    toolsUsed, availableTools, sessionId, supervisionId,
  });

  console.log(`[ReviewerOrchestrator] ${agentName} score=${evaluation.score} quality=${evaluation.quality} needsRetry=${evaluation.needsRetry}`);

  // Log the review message
  const reviewMsg: Omit<InterAgentMessage, 'conversationId'> = {
    sessionId,
    supervisionId,
    fromAgent: 'reviewer_agent',
    toAgent: agentId,
    messageType: 'review',
    message: `Quality Score: ${evaluation.score}/100 (${evaluation.quality}). Issues: ${evaluation.issues.join('; ') || 'None'}`,
    context: { evaluation, userQuestion, responsePreview: agentResponse.substring(0, 200) },
  };
  const reviewMsgId = await saveInterAgentMessage(reviewMsg, evaluation.score);
  interAgentMessages.push({ ...reviewMsg, conversationId: reviewMsgId });

  // If response is good enough, no intervention needed
  if (!evaluation.needsRetry) {
    const resolutionMsg: Omit<InterAgentMessage, 'conversationId'> = {
      sessionId, supervisionId,
      fromAgent: 'reviewer_agent', toAgent: agentId,
      messageType: 'resolution',
      message: `Response approved. Quality: ${evaluation.quality} (${evaluation.score}/100). No intervention needed.`,
      context: { score: evaluation.score },
    };
    const resMsgId = await saveInterAgentMessage(resolutionMsg, evaluation.score);
    interAgentMessages.push({ ...resolutionMsg, conversationId: resMsgId });

    return {
      originalResponse: agentResponse,
      reviewerEvaluation: evaluation,
      guidanceGiven: '',
      interAgentMessages,
      finalResponse: agentResponse,
      wasRetried: false,
    };
  }

  // Step 2: Reviewer sends guidance to agent
  const guidanceText = buildGuidanceMessage(agentName, userQuestion, evaluation);

  const guidanceMsg: Omit<InterAgentMessage, 'conversationId'> = {
    sessionId, supervisionId,
    fromAgent: 'reviewer_agent', toAgent: agentId,
    messageType: 'guidance',
    message: guidanceText,
    context: { evaluation, steps: evaluation.steps },
  };
  const guidanceMsgId = await saveInterAgentMessage(guidanceMsg, evaluation.score);
  interAgentMessages.push({ ...guidanceMsg, conversationId: guidanceMsgId });

  // Save to agent_guidance table
  try {
    await createGuidance({
      supervisionId: supervisionId || `session-${sessionId}`,
      agentId,
      guidanceType: evaluation.quality === 'wrong_tool' ? 'correction' : 'suggestion',
      guidanceText,
      guidanceAction: evaluation.needsToolCreation ? 'create_tool' : 'retry',
    });
  } catch (err) {
    console.warn('[ReviewerOrchestrator] Failed to save guidance record:', err);
  }

  // Step 3: If tool creation needed, request it
  if (evaluation.needsToolCreation && evaluation.suggestedToolName) {
    const toolRequestMsg: Omit<InterAgentMessage, 'conversationId'> = {
      sessionId, supervisionId,
      fromAgent: 'reviewer_agent', toAgent: 'tool_agent',
      messageType: 'tool_request',
      message: `Please create a tool named "${evaluation.suggestedToolName}" for ${agentName}. Description: ${evaluation.suggestedToolDescription || 'Tool needed to answer supply chain queries'}`,
      context: {
        requestedBy: agentId,
        toolName: evaluation.suggestedToolName,
        toolDescription: evaluation.suggestedToolDescription,
        originalQuestion: userQuestion,
      },
    };
    const toolReqMsgId = await saveInterAgentMessage(toolRequestMsg);
    interAgentMessages.push({ ...toolRequestMsg, conversationId: toolReqMsgId });
  }

  // Step 4: Retry the agent with guided prompt
  const retryMsg: Omit<InterAgentMessage, 'conversationId'> = {
    sessionId, supervisionId,
    fromAgent: 'reviewer_agent', toAgent: agentId,
    messageType: 'retry_request',
    message: `Please retry the following question with the guidance provided:\n\nQuestion: ${userQuestion}\n\nGuidance:\n${guidanceText}`,
    context: { originalQuestion: userQuestion, guidance: guidanceText },
  };
  const retryMsgId = await saveInterAgentMessage(retryMsg);
  interAgentMessages.push({ ...retryMsg, conversationId: retryMsgId });

  let retryResponse = agentResponse;
  let retryToolResults: unknown[] = toolResults;

  try {
    const guided = await retryFn(guidanceText);
    retryResponse = guided.response;
    retryToolResults = guided.toolResults;
    console.log(`[ReviewerOrchestrator] Retry completed for ${agentName}, response length: ${retryResponse.length}`);
  } catch (err) {
    console.warn('[ReviewerOrchestrator] Retry failed:', err);
    retryResponse = agentResponse; // Fall back to original
  }

  // Step 5: Log the resolution
  const finalMsg: Omit<InterAgentMessage, 'conversationId'> = {
    sessionId, supervisionId,
    fromAgent: agentId, toAgent: 'reviewer_agent',
    messageType: 'resolution',
    message: `Retry completed. Response length: ${retryResponse.length} chars. ${retryToolResults ? `Tools used: ${(retryToolResults as any[]).map(t => t.toolName).join(', ')}` : ''}`,
    context: { retryResponsePreview: retryResponse.substring(0, 300) },
  };
  const finalMsgId = await saveInterAgentMessage(finalMsg);
  interAgentMessages.push({ ...finalMsg, conversationId: finalMsgId });

  return {
    originalResponse: agentResponse,
    reviewerEvaluation: evaluation,
    guidanceGiven: guidanceText,
    retryResponse,
    retryToolResults,
    interAgentMessages,
    finalResponse: retryResponse || agentResponse,
    wasRetried: true,
  };
}

// ─── Helper: Build guidance message ──────────────────────────────────────────

function buildGuidanceMessage(agentName: string, question: string, evaluation: ReviewerEvaluation): string {
  const lines: string[] = [
    `**Reviewer Agent Guidance for ${agentName}**`,
    ``,
    `**Question:** ${question}`,
    `**Issue:** ${evaluation.issues.join('; ')}`,
    ``,
    `**Guidance:** ${evaluation.guidance}`,
    ``,
    `**Step-by-step instructions:**`,
  ];

  evaluation.steps.forEach((step, i) => {
    lines.push(`${i + 1}. ${step}`);
  });

  if (evaluation.needsToolCreation && evaluation.suggestedToolName) {
    lines.push(``, `**Note:** A new tool "${evaluation.suggestedToolName}" will be created to help with this.`);
  }

  return lines.join('\n');
}

// ─── Query inter-agent conversations ─────────────────────────────────────────

export async function getInterAgentConversations(params: {
  sessionId?: string;
  agentId?: string;
  limit?: number;
}): Promise<InterAgentMessage[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    let query = db.select().from(reviewerConversations);

    if (params.agentId) {
      (query as any).where(
        or(
          eq(reviewerConversations.fromAgent, params.agentId),
          eq(reviewerConversations.toAgent, params.agentId)
        )
      );
    } else if (params.sessionId) {
      (query as any).where(eq(reviewerConversations.sessionId, params.sessionId));
    }

    const rows = await db
      .select()
      .from(reviewerConversations)
      .orderBy(desc(reviewerConversations.createdAt))
      .limit(params.limit || 50);

    return rows.map(row => ({
      conversationId: row.conversationId,
      sessionId: row.sessionId,
      supervisionId: row.supervisionId ?? undefined,
      fromAgent: row.fromAgent,
      toAgent: row.toAgent,
      messageType: row.messageType as InterAgentMessage['messageType'],
      message: row.message,
      context: row.context as Record<string, unknown> | undefined,
      score: row.score ?? undefined,
      createdAt: row.createdAt ?? undefined,
    }));
  } catch (err) {
    console.warn('[ReviewerOrchestrator] Failed to fetch inter-agent conversations:', err);
    return [];
  }
}

export async function getReviewerStats(): Promise<{
  totalReviews: number;
  interventions: number;
  toolRequests: number;
  resolutions: number;
  avgScore: number;
}> {
  const db = await getDb();
  if (!db) return { totalReviews: 0, interventions: 0, toolRequests: 0, resolutions: 0, avgScore: 0 };
  try {
    const rows = await db.select().from(reviewerConversations);
    const total = rows.length;
    const interventions = rows.filter(r => r.messageType === 'guidance').length;
    const toolRequests = rows.filter(r => r.messageType === 'tool_request').length;
    const resolutions = rows.filter(r => r.messageType === 'resolution').length;
    const reviewRows = rows.filter(r => r.messageType === 'review' && r.score !== null);
    const avgScore = reviewRows.length > 0
      ? Math.round(reviewRows.reduce((sum, r) => sum + (r.score || 0), 0) / reviewRows.length)
      : 0;

    return { totalReviews: total, interventions, toolRequests, resolutions, avgScore };
  } catch {
    return { totalReviews: 0, interventions: 0, toolRequests: 0, resolutions: 0, avgScore: 0 };
  }
}
