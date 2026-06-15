/**
 * Agent Chat Router - Integrates LLM tool-calling with agent conversations
 */

import { router, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import { executeLLMWithTools, ToolCallResult } from '../tool-executor';
import { logToolExecution } from '../db-tools';
import { getDb } from '../db';
import { sql } from 'drizzle-orm';

export const agentChatRouter = router({
  /**
   * Send message to agent with tool-calling support
   */
  sendMessage: protectedProcedure
    .input(z.object({
      agentId: z.string(),
      message: z.string(),
      conversationId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      try {
        // Execute LLM with tool-calling
        const result = await executeLLMWithTools({
          agentId: input.agentId,
          userId: ctx.user.id,
          messageId: `msg_${Date.now()}`,
          userQuery: input.message,
          conversationHistory: [],
        });

        // Store message and tool calls in audit log
        const messageId = `msg_${Date.now()}`;
        
        // Log tool executions with details
        for (const toolCall of result.toolCalls) {
          await logToolExecution({
            toolId: toolCall.toolId,
            agentId: input.agentId,
            userId: ctx.user.id,
            messageId,
            inputParams: toolCall.input,
            outputResult: toolCall.output,
            executionTime: toolCall.executionTime,
            status: toolCall.status,
            errorMessage: toolCall.errorMessage,
          });
        }

        return {
          messageId,
          response: result.response,
          toolCalls: result.toolCalls,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('[AgentChat] Error:', error);
        throw error;
      }
    }),

  /**
   * Get tool execution history for a conversation
   */
  getToolExecutionHistory: protectedProcedure
    .input(z.object({
      agentId: z.string(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      try {
        // Return mock data for now
        return [];
      } catch (error) {
        console.error('[AgentChat] Error fetching history:', error);
        return [];
      }
    }),

  /**
   * Get tool stats for an agent
   */
  getAgentToolStats: protectedProcedure
    .input(z.object({
      agentId: z.string(),
    }))
    .query(async ({ input }) => {
      return {
        totalToolCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageExecutionTime: 0,
        toolsUsed: [],
      };
    }),
});
