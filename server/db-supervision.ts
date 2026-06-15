import { getDb } from './db';
import { supervisionLogs, agentGuidance, conversationLogs } from '../drizzle/schema';
import { nanoid } from 'nanoid';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Log an agent response for supervision
 */
export async function logSupervisionEvent(data: {
  agentId: string;
  agentName: string;
  question: string;
  agentResponse: string;
  responseStatus: 'success' | 'blank' | 'error' | 'incomplete';
  toolsUsed?: string[];
  executionDetails?: Record<string, any>;
}) {
  const supervisionId = `sup-${nanoid()}`;
  const needsReview = data.responseStatus !== 'success';
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    await db.insert(supervisionLogs).values({
      supervisionId,
      agentId: data.agentId,
      agentName: data.agentName,
      question: data.question,
      agentResponse: data.agentResponse,
      responseStatus: data.responseStatus,
      toolsUsed: data.toolsUsed || [],
      executionDetails: data.executionDetails || {},
      needsReview,
      createdAt: new Date(),
    });

    console.log(`[DB Supervision] Logged supervision event: ${supervisionId}, Status: ${data.responseStatus}`);

    return {
      supervisionId,
      responseStatus: data.responseStatus,
      needsReview,
    };
  } catch (error) {
    console.error('[DB Supervision] Error logging supervision event:', error);
    throw error;
  }
}

/**
 * Provide guidance to an agent
 */
export async function createGuidance(data: {
  supervisionId: string;
  agentId: string;
  guidanceType: 'clarification' | 'correction' | 'suggestion' | 'escalation';
  guidanceText: string;
  guidanceAction: 'retry' | 'create_tool' | 'escalate' | 'manual_input';
}) {
  const guidanceId = `guid-${nanoid()}`;
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    await db.insert(agentGuidance).values({
      guidanceId,
      supervisionId: data.supervisionId,
      agentId: data.agentId,
      guidanceType: data.guidanceType,
      guidanceText: data.guidanceText,
      guidanceAction: data.guidanceAction,
      resolved: false,
      createdAt: new Date(),
    });

    console.log(`[DB Guidance] Created guidance: ${guidanceId}, Action: ${data.guidanceAction}`);

    return {
      guidanceId,
      message: `Guidance provided: ${data.guidanceText}`,
    };
  } catch (error) {
    console.error('[DB Guidance] Error creating guidance:', error);
    throw error;
  }
}

/**
 * Mark guidance as resolved
 */
export async function markGuidanceResolved(guidanceId: string, agentResponse: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    await db
      .update(agentGuidance)
      .set({
        resolved: true,
        agentResponseAfterGuidance: agentResponse,
        resolvedAt: new Date(),
      })
      .where(eq(agentGuidance.guidanceId, guidanceId));

    console.log(`[DB Guidance] Marked resolved: ${guidanceId}`);

    return { success: true };
  } catch (error) {
    console.error('[DB Guidance] Error marking resolved:', error);
    throw error;
  }
}

/**
 * Log a conversation
 */
export async function logConversation(data: {
  agentId: string;
  supervisionId?: string;
  userMessage: string;
  agentMessage: string;
  conversationType: 'user_to_agent' | 'agent_to_reviewer' | 'reviewer_to_agent' | 'agent_to_agent';
  metadata?: Record<string, any>;
}) {
  const conversationId = `conv-${nanoid()}`;
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    await db.insert(conversationLogs).values({
      conversationId,
      agentId: data.agentId,
      supervisionId: data.supervisionId,
      userMessage: data.userMessage,
      agentMessage: data.agentMessage,
      conversationType: data.conversationType,
      metadata: data.metadata || {},
      createdAt: new Date(),
    });

    console.log(`[DB Conversation] Logged conversation: ${conversationId}`);

    return { conversationId };
  } catch (error) {
    console.error('[DB Conversation] Error logging conversation:', error);
    throw error;
  }
}

/**
 * Get supervision logs for an agent
 */
export async function getSupervisionLogs(
  agentId?: string,
  responseStatus?: string,
  limitCount: number = 50
) {
  const db = await getDb();
  if (!db) return [];

  try {
    const conditions = [];
    if (agentId) conditions.push(eq(supervisionLogs.agentId, agentId));
    if (responseStatus) conditions.push(eq(supervisionLogs.responseStatus, responseStatus as any));

    const logs = await db
      .select()
      .from(supervisionLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(supervisionLogs.createdAt))
      .limit(limitCount);

    return logs;
  } catch (error) {
    console.error('[DB Supervision] Error fetching logs:', error);
    return [];
  }
}

/**
 * Get guidance records for an agent
 */
export async function getAgentGuidanceRecords(agentId: string, resolved?: boolean) {
  const db = await getDb();
  if (!db) return [];

  try {
    const conditions = [eq(agentGuidance.agentId, agentId)];
    if (resolved !== undefined) {
      conditions.push(eq(agentGuidance.resolved, resolved));
    }

    const records = await db
      .select()
      .from(agentGuidance)
      .where(and(...conditions))
      .orderBy(desc(agentGuidance.createdAt));

    return records;
  } catch (error) {
    console.error('[DB Guidance] Error fetching guidance records:', error);
    return [];
  }
}

/**
 * Get conversation history for an agent
 */
export async function getConversationHistory(agentId: string, limitCount: number = 100) {
  const db = await getDb();
  if (!db) return [];

  try {
    const history = await db
      .select()
      .from(conversationLogs)
      .where(eq(conversationLogs.agentId, agentId))
      .orderBy(desc(conversationLogs.createdAt))
      .limit(limitCount);

    return history;
  } catch (error) {
    console.error('[DB Conversation] Error fetching history:', error);
    return [];
  }
}

/**
 * Get dashboard summary with agent stats
 */
export async function getSupervisionDashboardSummary() {
  const db = await getDb();
  if (!db) return { totalInterventions: 0, pendingGuidance: 0, agentStats: [] };

  try {
    // Get all supervision logs
    const allLogs = await db.select().from(supervisionLogs);

    // Get pending guidance
    const pendingGuidance = await db
      .select()
      .from(agentGuidance)
      .where(eq(agentGuidance.resolved, false));

    // Calculate agent stats
    const agentStats = new Map<
      string,
      {
        agentId: string;
        interactionCount: number;
        blankResponses: number;
        errorResponses: number;
        incompleteResponses: number;
      }
    >();

    for (const log of allLogs) {
      if (!agentStats.has(log.agentId)) {
        agentStats.set(log.agentId, {
          agentId: log.agentId,
          interactionCount: 0,
          blankResponses: 0,
          errorResponses: 0,
          incompleteResponses: 0,
        });
      }

      const stats = agentStats.get(log.agentId)!;
      stats.interactionCount++;

      if (log.responseStatus === 'blank') {
        stats.blankResponses++;
      } else if (log.responseStatus === 'error') {
        stats.errorResponses++;
      } else if (log.responseStatus === 'incomplete') {
        stats.incompleteResponses++;
      }
    }

    return {
      totalInterventions: pendingGuidance.length,
      pendingGuidance: pendingGuidance.length,
      agentStats: Array.from(agentStats.values()),
    };
  } catch (error) {
    console.error('[DB Supervision] Error getting dashboard summary:', error);
    return {
      totalInterventions: 0,
      pendingGuidance: 0,
      agentStats: [],
    };
  }
}
