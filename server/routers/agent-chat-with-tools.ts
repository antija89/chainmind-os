import { protectedProcedure, router } from '../_core/trpc';
import { invokeLLM } from '../_core/llm';
import { z } from 'zod';
import { getToolsByAgent, logToolExecution } from '../db-tools';
import { saveAgentMessage } from '../db';

/**
 * Agent Chat Router with Tool Execution Dispatcher
 * Handles agent conversations with automatic tool calling
 */

interface ToolResult {
  toolName: string;
  status: 'success' | 'error' | 'timeout';
  result: any;
  executionTime: number;
  error?: string;
}

/**
 * Execute a tool call and return the result
 */
async function executeTool(
  toolName: string,
  toolArgs: Record<string, any>
): Promise<ToolResult> {
  const startTime = Date.now();
  
  try {
    // Mock tool implementations for supply chain tools
    switch (toolName) {
      case 'get_top_selling_skus':
        return {
          toolName,
          status: 'success',
          result: {
            skus: [
              { sku: 'SKU-001', units: 15000, revenue: 450000 },
              { sku: 'SKU-002', units: 12000, revenue: 360000 },
              { sku: 'SKU-003', units: 10000, revenue: 300000 },
            ],
          },
          executionTime: Date.now() - startTime,
        };

      case 'forecast_demand_by_sku':
        return {
          toolName,
          status: 'success',
          result: {
            sku: toolArgs.sku,
            forecast: [
              { month: 'Jan', quantity: 5000, confidence: 0.95 },
              { month: 'Feb', quantity: 5500, confidence: 0.92 },
              { month: 'Mar', quantity: 6000, confidence: 0.88 },
            ],
          },
          executionTime: Date.now() - startTime,
        };

      case 'calculate_safety_stock':
        return {
          toolName,
          status: 'success',
          result: {
            sku: toolArgs.sku,
            safetyStock: 1500,
            reorderPoint: 3000,
            economicOrderQuantity: 2500,
          },
          executionTime: Date.now() - startTime,
        };

      case 'get_inventory_status':
        return {
          toolName,
          status: 'success',
          result: {
            totalInventory: 45000,
            inStock: 42000,
            inTransit: 3000,
            onOrder: 5000,
            lowStockItems: 12,
          },
          executionTime: Date.now() - startTime,
        };

      case 'identify_supply_gaps':
        return {
          toolName,
          status: 'success',
          result: {
            gaps: [
              { sku: 'SKU-005', shortage: 500, reason: 'Supplier delay' },
              { sku: 'SKU-012', shortage: 200, reason: 'Production issue' },
            ],
            totalShortage: 700,
          },
          executionTime: Date.now() - startTime,
        };

      case 'get_consolidated_kpis':
        return {
          toolName,
          status: 'success',
          result: {
            serviceLevel: 0.98,
            forecastAccuracy: 0.92,
            inventoryTurnover: 8.5,
            orderFulfillmentRate: 0.99,
            supplierOnTimeDelivery: 0.96,
          },
          executionTime: Date.now() - startTime,
        };

      default:
        return {
          toolName,
          status: 'error',
          result: null,
          executionTime: Date.now() - startTime,
          error: `Unknown tool: ${toolName}`,
        };
    }
  } catch (error) {
    return {
      toolName,
      status: 'error',
      result: null,
      executionTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build system prompt with tool definitions
 */
function buildSystemPromptWithTools(agentName: string, tools: any[]): string {
  const toolDefinitions = tools
    .map(
      (t: any) => `
- **${t.name || 'Unknown'}**: ${t.description || 'No description'}
  Input: ${JSON.stringify(t.input_schema || {})}
  Output: ${JSON.stringify(t.output_schema || {})}
`
    )
    .join('\n');

  return `You are a supply chain ${agentName} agent. Your role is to help with supply chain planning and optimization.

You have access to the following tools:
${toolDefinitions}

When answering questions, use the available tools to gather data and provide accurate insights. Always explain your reasoning and the data you used to make decisions.

Format your responses clearly with:
1. Analysis of the situation
2. Tools used and their results
3. Recommendations based on the data
4. Action items if applicable`;
}

export const agentChatWithToolsRouter = router({
  sendMessage: protectedProcedure
    .input(z.object({
      agentId: z.string(),
      agentName: z.string(),
      message: z.string(),
      conversationHistory: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Get tools available for this agent
        const toolsData = await getToolsByAgent(input.agentId);
        const tools = Array.isArray(toolsData) ? toolsData : [];
        
        // Build system prompt with tools
        const systemPrompt = buildSystemPromptWithTools(input.agentName, tools);

        // Prepare messages for LLM
        const messages = [
          ...(input.conversationHistory || []),
          { role: 'user' as const, content: input.message },
        ];

        // Call LLM with tools
        const response = await invokeLLM({
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
          tools: tools.map((t: any) => ({
            type: 'function' as const,
            function: {
              name: t.name || '',
              description: t.description || '',
              parameters: t.input_schema || {},
            },
          })),
          tool_choice: 'auto',
        });

        const choice = response?.choices?.[0];
        const message = choice?.message;
        let assistantContent = typeof message?.content === 'string' ? message.content : '';
        const toolCalls = message?.tool_calls || [];

        // Execute tool calls if any
        const toolResults: ToolResult[] = [];
        for (const toolCall of toolCalls) {
          const toolName = toolCall.function?.name || '';
          try {
            const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
            const result = await executeTool(toolName, toolArgs);
            toolResults.push(result);

            // Log tool execution
            await logToolExecution({
              toolId: toolName,
              agentId: input.agentId,
              inputParams: toolArgs,
              outputResult: result.result,
              executionTime: result.executionTime,
              status: result.status,
              errorMessage: result.error,
            });
          } catch (error) {
            toolResults.push({
              toolName,
              status: 'error',
              result: null,
              executionTime: 0,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        // Save agent message to database
        try {
          await saveAgentMessage({
            agentId: input.agentId,
            content: assistantContent,
            role: 'assistant',
            metadata: {
              toolResults,
              toolCount: toolResults.length,
              userMessage: input.message,
            },
          });
        } catch (dbError) {
          console.error('[Agent Chat] Failed to save message:', dbError);
        }

        return {
          response: assistantContent,
          toolResults,
          toolsUsed: toolResults.map((t) => t.toolName),
          success: true,
        };
      } catch (error) {
        console.error('[Agent Chat with Tools] Error:', error);
        return {
          response: 'I encountered an error processing your request. Please try again.',
          toolResults: [],
          toolsUsed: [],
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),

  getToolsForAgent: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input }) => {
      try {
        const toolsData = await getToolsByAgent(input.agentId);
        const tools = Array.isArray(toolsData) ? toolsData : [];
        return {
          tools,
          count: tools.length,
        };
      } catch (error) {
        console.error('[Agent Chat with Tools] getToolsForAgent error:', error);
        return {
          tools: [],
          count: 0,
        };
      }
    }),
});
