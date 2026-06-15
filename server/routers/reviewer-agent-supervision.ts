import { protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import {
  logSupervisionEvent,
  createGuidance,
  markGuidanceResolved,
  logConversation,
  getSupervisionLogs,
  getAgentGuidanceRecords,
  getConversationHistory,
  getSupervisionDashboardSummary,
} from '../db-supervision';
import { getInterAgentConversations, getReviewerStats } from '../reviewer-orchestrator';
import { getLlmCallLogs, getLlmCallLogById, getLlmCallLogStats } from '../db-llm-logs';

/**
 * Reviewer Agent Supervision Router
 * Reviewer Agent monitors ALL agents (including Ops Head)
 * Provides guidance, logs interactions, and ensures quality control
 */

export const reviewerAgentSupervisionRouter = {
  /**
   * Log agent response and check if review/intervention is needed
   */
  logAgentResponse: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        agentName: z.string(),
        question: z.string(),
        agentResponse: z.string(),
        toolsUsed: z.array(z.any()).optional(),
        executionDetails: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Determine response status
        const responseText = input.agentResponse?.trim() || '';
        let responseStatus: 'success' | 'blank' | 'error' | 'incomplete' = 'success';

        if (!responseText) {
          responseStatus = 'blank';
        } else if (responseText.length < 20) {
          responseStatus = 'incomplete';
        } else if (responseText.toLowerCase().includes('error') || responseText.toLowerCase().includes('failed')) {
          responseStatus = 'error';
        }

        // Log to database
        const result = await logSupervisionEvent({
          agentId: input.agentId,
          agentName: input.agentName,
          question: input.question,
          agentResponse: input.agentResponse,
          responseStatus,
          toolsUsed: input.toolsUsed as string[] | undefined,
          executionDetails: input.executionDetails,
        });

        // If response needs review, automatically create guidance
        if (result.needsReview) {
          let guidanceType: 'clarification' | 'correction' | 'suggestion' | 'escalation' = 'suggestion';
          let guidanceAction: 'retry' | 'create_tool' | 'escalate' | 'manual_input' = 'retry';
          let guidanceText = '';

          if (responseStatus === 'blank') {
            guidanceType = 'clarification';
            guidanceAction = 'retry';
            guidanceText = `Your response was blank. Please provide a detailed answer to the question: "${input.question}"`;
          } else if (responseStatus === 'incomplete') {
            guidanceType = 'suggestion';
            guidanceAction = 'retry';
            guidanceText = `Your response was too brief. Please provide more details and context for: "${input.question}"`;
          } else if (responseStatus === 'error') {
            guidanceType = 'correction';
            guidanceAction = 'create_tool';
            guidanceText = `Your response indicated an error. Please retry or consider creating a tool to handle this query: "${input.question}"`;
          }

          // Create guidance record
          await createGuidance({
            supervisionId: result.supervisionId,
            agentId: input.agentId,
            guidanceType,
            guidanceText,
            guidanceAction,
          });

          console.log(`[Reviewer Agent] Guidance created for ${input.agentName}: ${guidanceAction}`);
        }

        return {
          supervisionId: result.supervisionId,
          responseStatus: result.responseStatus,
          needsReview: result.needsReview,
          message: `Response logged: ${result.responseStatus}`,
        };
      } catch (error) {
        console.error('[Reviewer Agent] Error logging response:', error);
        throw error;
      }
    }),

  /**
   * Reviewer Agent provides guidance to any agent
   */
  provideGuidance: protectedProcedure
    .input(
      z.object({
        supervisionId: z.string(),
        agentId: z.string(),
        guidanceType: z.enum(['clarification', 'correction', 'suggestion', 'escalation']),
        guidanceText: z.string(),
        guidanceAction: z.enum(['retry', 'create_tool', 'escalate', 'manual_input']),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await createGuidance({
          supervisionId: input.supervisionId,
          agentId: input.agentId,
          guidanceType: input.guidanceType,
          guidanceText: input.guidanceText,
          guidanceAction: input.guidanceAction,
        });

        return {
          guidanceId: result.guidanceId,
          message: result.message,
        };
      } catch (error) {
        console.error('[Reviewer Agent Guidance] Error providing guidance:', error);
        throw error;
      }
    }),

  /**
   * Mark guidance as resolved
   */
  markGuidanceResolved: protectedProcedure
    .input(
      z.object({
        guidanceId: z.string(),
        agentResponseAfterGuidance: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        await markGuidanceResolved(input.guidanceId, input.agentResponseAfterGuidance);
        return { success: true, message: 'Guidance marked as resolved' };
      } catch (error) {
        console.error('[Reviewer Agent] Error marking resolved:', error);
        throw error;
      }
    }),

  /**
   * Get all supervision logs for Reviewer Agent dashboard
   */
  getSupervisionLogs: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
        agentId: z.string().optional(),
        responseStatus: z.enum(['success', 'blank', 'error', 'incomplete']).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const logs = await getSupervisionLogs(input.agentId, input.responseStatus, input.limit);
        return logs;
      } catch (error) {
        console.error('[Reviewer Agent] Error fetching logs:', error);
        return [];
      }
    }),

  /**
   * Get conversation history for an agent
   */
  getAgentConversationHistory: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        limit: z.number().default(100),
      })
    )
    .query(async ({ input }) => {
      try {
        const history = await getConversationHistory(input.agentId, input.limit);
        return history;
      } catch (error) {
        console.error('[Reviewer Agent] Error fetching conversation history:', error);
        return [];
      }
    }),

  /**
   * Get guidance records for an agent
   */
  getAgentGuidance: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        resolved: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const guidance = await getAgentGuidanceRecords(input.agentId, input.resolved);
        return guidance;
      } catch (error) {
        console.error('[Reviewer Agent] Error fetching guidance:', error);
        return [];
      }
    }),

  /**
   * Get Reviewer Agent dashboard summary
   * Shows all agent interactions, interventions, and quality metrics
   */
  getDashboardSummary: protectedProcedure.query(async () => {
    try {
      const summary = await getSupervisionDashboardSummary();
      return summary;
    } catch (error) {
      console.error('[Reviewer Agent] Error getting dashboard summary:', error);
      return {
        totalInterventions: 0,
        pendingGuidance: 0,
        agentStats: [],
      };
    }
  }),

  /**
   * Get inter-agent conversations (Reviewer ↔ Agent dialogue)
   * Shows all reviewer evaluations, guidance, retries, and resolutions
   */
  getInterAgentConversations: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().optional(),
        agentId: z.string().optional(),
        limit: z.number().optional().default(100),
      })
    )
    .query(async ({ input }) => {
      try {
        const conversations = await getInterAgentConversations({
          sessionId: input.sessionId,
          agentId: input.agentId,
          limit: input.limit,
        });
        return conversations;
      } catch (error) {
        console.error('[Reviewer Agent] Error fetching inter-agent conversations:', error);
        return [];
      }
    }),

  /**
   * Get reviewer statistics
   * Shows total reviews, interventions, tool requests, and resolutions
   */
  getReviewerStats: protectedProcedure.query(async () => {
    try {
      const stats = await getReviewerStats();
      return stats;
    } catch (error) {
      console.error('[Reviewer Agent] Error fetching reviewer stats:', error);
      return { totalReviews: 0, interventions: 0, toolRequests: 0, resolutions: 0, avgScore: 0 };
    }
  }),

  getLlmLogs: protectedProcedure
    .input(z.object({
      agentId: z.string().optional(),
      limit: z.number().optional().default(50),
      offset: z.number().optional().default(0),
    }))
    .query(async ({ input }) => {
      try {
        return await getLlmCallLogs({ agentId: input.agentId, limit: input.limit, offset: input.offset });
      } catch (error) {
        console.error('[LLM Logs] Error fetching logs:', error);
        return [];
      }
    }),

  getLlmLogById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        return await getLlmCallLogById(input.id);
      } catch {
        return null;
      }
    }),

  getLlmLogStats: protectedProcedure.query(async () => {
    try {
      return await getLlmCallLogStats();
    } catch {
      return { total: 0, successCount: 0, errorCount: 0, emptyCount: 0, avgDuration: 0, totalTokens: 0, modelCounts: {} as Record<string, number> };
    }
  }),
};
