import { protectedProcedure, router } from '../_core/trpc';
import { invokeLLM } from '../_core/llm';
import { z } from 'zod';

/**
 * Tool Creation Agent Router
 * Uses LLM to generate tool suggestions from natural language input
 */

const TOOL_CREATION_SYSTEM_PROMPT = `You are a supply chain tool creation expert. Your job is to analyze user requests and suggest tools that would help solve their problem.

When a user describes a need, you should:
1. Understand the supply chain domain (demand, supply, production, procurement, operations)
2. Suggest 1-3 relevant tools that would address their need
3. For each tool, provide:
   - name: A clear, descriptive name
   - description: What it does and why it's useful
   - category: One of [demand, supply, production, procurement, operations]
   - complexity: One of [simple, medium, complex]
   - inputSchema: What parameters it needs (as JSON schema)
   - outputSchema: What it returns (as JSON schema)
   - agentIds: Which agents should have access (array of agent names)

Return your response as a valid JSON array with this structure:
[
  {
    "name": "Tool Name",
    "description": "What it does",
    "category": "demand|supply|production|procurement|operations",
    "complexity": "simple|medium|complex",
    "inputSchema": { "type": "object", "properties": {...}, "required": [...] },
    "outputSchema": { "type": "object", "properties": {...} },
    "agentIds": ["agent1", "agent2"],
    "rationale": "Why this tool solves the problem"
  }
]

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation.`;

export const toolCreationAgentRouter = router({
  generateSuggestions: protectedProcedure
    .input(z.object({
      userRequest: z.string().min(10, 'Request must be at least 10 characters'),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Call LLM to generate tool suggestions
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: TOOL_CREATION_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: `User request: "${input.userRequest}"\n\nGenerate tool suggestions that would help solve this problem.`,
            },
          ],
        });

        // Extract the response content
        let content = response?.choices?.[0]?.message?.content || '';
        if (Array.isArray(content)) {
          content = '';
        }

        // Parse JSON from response
        let suggestions = [];
        try {
          // Try to extract JSON from the response (in case there's extra text)
          const jsonMatch = (content as string).match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            suggestions = JSON.parse(jsonMatch[0]);
          } else {
            suggestions = JSON.parse(content as string);
          }
        } catch (parseError) {
          console.error('[Tool Creation Agent] Failed to parse LLM response:', content);
          return {
            success: false,
            error: 'Failed to parse tool suggestions from LLM',
            suggestions: [],
          };
        }

        // Validate suggestions structure
        const validatedSuggestions = suggestions
          .filter((s: any) => s.name && s.description && s.category)
          .map((s: any) => ({
            name: s.name,
            description: s.description,
            category: s.category,
            complexity: s.complexity || 'simple',
            inputSchema: s.inputSchema || { type: 'object', properties: {} },
            outputSchema: s.outputSchema || { type: 'object', properties: {} },
            agentIds: Array.isArray(s.agentIds) ? s.agentIds : [],
            rationale: s.rationale || '',
          }));

        return {
          success: true,
          suggestions: validatedSuggestions,
          userRequest: input.userRequest,
        };
      } catch (error) {
        console.error('[Tool Creation Agent] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          suggestions: [],
        };
      }
    }),

  createFromSuggestion: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string(),
      category: z.enum(['demand', 'supply', 'production', 'procurement', 'operations']),
      complexity: z.enum(['simple', 'medium', 'complex']),
      inputSchema: z.any(),
      outputSchema: z.any(),
      agentIds: z.array(z.string()),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Import createTool from db-tools
        const { createTool } = await import('../db-tools');

        // Create the tool in database
        const tool = await createTool({
          name: input.name,
          description: input.description,
          category: input.category,
          agentIds: input.agentIds,
          inputSchema: input.inputSchema,
          outputSchema: input.outputSchema,
          implementation: input.name.toLowerCase().replace(/\s+/g, '_'),
          complexity: input.complexity,
          createdBy: ctx.user.openId,
        });

        return {
          success: true,
          tool,
          message: `Tool "${input.name}" created successfully`,
        };
      } catch (error) {
        console.error('[Tool Creation Agent] Create tool error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create tool',
        };
      }
    }),
});
