import { protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import { invokeLLM } from '../_core/llm';
import { createTool } from '../db-tools';

/**
 * On-demand tool creation router
 * Allows agents to create tools when they don't have one to answer a question
 */

export const toolCreationOnDemandRouter = {
  /**
   * Create a tool on-demand based on agent's need
   * 1. LLM generates tool code
   * 2. Tool is executed on sample data
   * 3. Tool is saved to database
   * 4. Returns tool execution result
   */
  createAndExecute: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        agentName: z.string(),
        question: z.string(),
        category: z.enum(['demand', 'supply', 'production', 'procurement', 'operations']),
        sampleData: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        console.log(`[Tool Creation On-Demand] Agent: ${input.agentName}, Question: ${input.question}`);

        // Step 1: Generate tool using LLM
        const systemPrompt = `You are a supply chain tool generator. Generate a JavaScript function that answers this question: "${input.question}"

Requirements:
- Return ONLY valid JSON (no markdown, no extra text)
- Function must be named "executeTool"
- Must handle the provided sampleData
- Must return { success: true, data: {...}, message: "..." }
- Include error handling

JSON format:
{
  "name": "tool_name",
  "description": "what this tool does",
  "code": "async function executeTool(data) { ... return { success: true, data: {...}, message: '...' }; }",
  "inputSchema": { "type": "object", "properties": {...} },
  "outputSchema": { "type": "object", "properties": {...} }
}`;

        const response = await invokeLLM({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate a tool for: ${input.question}` },
          ],
        });

        const content = response?.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('LLM did not generate tool code');
        }

        // Extract JSON from response
        let toolDef: any;
        const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
        try {
          toolDef = JSON.parse(contentStr);
        } catch {
          const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            toolDef = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('Could not extract JSON from LLM response');
          }
        }

        console.log(`[Tool Creation On-Demand] Generated tool: ${toolDef.name}`);

        // Step 2: Execute tool on sample data
        let executionResult: any = { success: false, data: null, message: 'Not executed' };
        try {
          const sampleData = input.sampleData || {
            skus: ['SKU-001', 'SKU-002', 'SKU-003'],
            months: ['Jan', 'Feb', 'Mar'],
            quantities: [100, 150, 200],
          };

          // Create and execute the function
          const func = new Function('data', `return (${toolDef.code})(data)`);
          executionResult = await func(sampleData);

          console.log(`[Tool Creation On-Demand] Execution result:`, executionResult);
        } catch (execError) {
          console.error('[Tool Creation On-Demand] Execution error:', execError);
          executionResult = {
            success: false,
            data: null,
            message: `Execution error: ${execError instanceof Error ? execError.message : 'Unknown error'}`,
          };
        }

        // Step 3: Save tool to database
        try {
          const result = await createTool({
            name: toolDef.name,
            description: toolDef.description || '',
            category: input.category,
            agentIds: [input.agentId],
            inputSchema: toolDef.inputSchema || {},
            outputSchema: toolDef.outputSchema || {},
            implementation: toolDef.code,
            complexity: 'medium',
            createdBy: String(ctx.user?.id) || 'system',
          });

          console.log(`[Tool Creation On-Demand] Tool saved: ${result.tool_id}`);

          return {
            success: true,
            toolId: result.tool_id,
            toolName: toolDef.name,
            toolDescription: toolDef.description,
            executionResult,
            message: `Tool "${toolDef.name}" created and executed successfully`,
          };
        } catch (dbError) {
          console.error('[Tool Creation On-Demand] Failed to save tool:', dbError);
          // Return success if tool was created and executed, even if save failed
          return {
            success: true,
            toolId: null,
            toolName: toolDef.name,
            toolDescription: toolDef.description,
            executionResult,
            message: `Tool "${toolDef.name}" executed successfully but failed to save to database`,
          };
        }
      } catch (error) {
        console.error('[Tool Creation On-Demand] Error:', error);
        return {
          success: false,
          toolId: null,
          toolName: null,
          toolDescription: null,
          executionResult: null,
          message: `Failed to create tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }),
};
