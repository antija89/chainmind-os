import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../_core/trpc';
import { invokeLLM } from '../_core/llm';
import { createTool, getToolList } from '../db-tools';
import { writeAuditLog } from '../db';

// Sample supply chain data for LLM to use when demonstrating tools
const SAMPLE_DATA = {
  skus: [
    { sku: "SKU-001", name: "Widget A", category: "Electronics", monthly_demand: [120, 135, 110, 145, 160, 140], price: 25.99, lead_time_days: 14 },
    { sku: "SKU-002", name: "Gadget B", category: "Electronics", monthly_demand: [80, 75, 90, 85, 95, 88], price: 45.50, lead_time_days: 21 },
    { sku: "SKU-003", name: "Component C", category: "Parts", monthly_demand: [500, 480, 520, 510, 490, 505], price: 3.99, lead_time_days: 7 },
    { sku: "SKU-004", name: "Assembly D", category: "Finished Goods", monthly_demand: [30, 28, 35, 32, 40, 36], price: 199.99, lead_time_days: 30 },
    { sku: "SKU-005", name: "Part E", category: "Parts", monthly_demand: [200, 210, 195, 220, 215, 205], price: 8.75, lead_time_days: 10 },
  ],
  inventory: [
    { sku: "SKU-001", on_hand: 450, on_order: 200, safety_stock: 120, reorder_point: 200 },
    { sku: "SKU-002", on_hand: 180, on_order: 0, safety_stock: 80, reorder_point: 120 },
    { sku: "SKU-003", on_hand: 2100, on_order: 500, safety_stock: 500, reorder_point: 800 },
    { sku: "SKU-004", on_hand: 45, on_order: 30, safety_stock: 30, reorder_point: 50 },
    { sku: "SKU-005", on_hand: 620, on_order: 0, safety_stock: 200, reorder_point: 350 },
  ],
  suppliers: [
    { id: "SUP-001", name: "Alpha Supplies", on_time_rate: 0.94, quality_score: 4.2, avg_lead_time: 14, categories: ["Electronics", "Parts"] },
    { id: "SUP-002", name: "Beta Components", on_time_rate: 0.88, quality_score: 3.9, avg_lead_time: 21, categories: ["Electronics"] },
    { id: "SUP-003", name: "Gamma Parts", on_time_rate: 0.97, quality_score: 4.6, avg_lead_time: 7, categories: ["Parts"] },
  ],
  purchase_orders: [
    { po_no: "PO-2024-001", supplier: "Alpha Supplies", sku: "SKU-001", qty: 200, status: "In Transit", expected_date: "2024-02-15", value: 5198 },
    { po_no: "PO-2024-002", supplier: "Gamma Parts", sku: "SKU-003", qty: 500, status: "Confirmed", expected_date: "2024-02-10", value: 1995 },
    { po_no: "PO-2024-003", supplier: "Beta Components", sku: "SKU-002", qty: 100, status: "Pending", expected_date: "2024-03-01", value: 4550 },
  ],
  sales_history: [
    { month: "2024-01", sku: "SKU-001", units_sold: 120, revenue: 3118.80 },
    { month: "2024-01", sku: "SKU-002", units_sold: 80, revenue: 3640.00 },
    { month: "2024-01", sku: "SKU-003", units_sold: 500, revenue: 1995.00 },
    { month: "2023-12", sku: "SKU-001", units_sold: 140, revenue: 3638.60 },
    { month: "2023-12", sku: "SKU-002", units_sold: 88, revenue: 4004.00 },
    { month: "2023-12", sku: "SKU-003", units_sold: 505, revenue: 2014.95 },
  ],
};

// Run JS code safely with sample data
function runToolCode(code: string, inputParams: Record<string, any>): { result: any; error?: string; executionTimeMs: number } {
  const start = Date.now();
  try {
    // Build a safe execution context with sample data
    const fn = new Function(
      'inputParams', 'sampleData', 'console',
      `
      "use strict";
      const { skus, inventory, suppliers, purchase_orders, sales_history } = sampleData;
      try {
        ${code}
      } catch(e) {
        return { error: e.message };
      }
      `
    );
    const logs: string[] = [];
    const safeConsole = {
      log: (...args: any[]) => logs.push(args.map(String).join(' ')),
      error: (...args: any[]) => logs.push('[ERROR] ' + args.map(String).join(' ')),
      warn: (...args: any[]) => logs.push('[WARN] ' + args.map(String).join(' ')),
    };
    const result = fn(inputParams, SAMPLE_DATA, safeConsole);
    return { result: result ?? { logs }, executionTimeMs: Date.now() - start };
  } catch (e: any) {
    return { result: null, error: e.message, executionTimeMs: Date.now() - start };
  }
}

export const toolGeneratorRouter = router({
  // Step 1: Generate tool definition + code from natural language
  generate: protectedProcedure
    .input(z.object({
      description: z.string().min(10, "Please describe the tool in more detail"),
      category: z.enum(["demand", "supply", "production", "procurement", "operations"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const systemPrompt = `You are a supply chain tool developer. Given a description of what a supply chain tool should do, you will:
1. Design the tool's interface (name, description, input parameters, output schema)
2. Write JavaScript code that implements the tool using supply chain data
3. The code will have access to these variables: inputParams (user inputs), skus, inventory, suppliers, purchase_orders, sales_history (sample data arrays)
4. The code MUST end with a return statement returning the result object

Available sample data structure:
- skus: [{sku, name, category, monthly_demand[6 months], price, lead_time_days}]
- inventory: [{sku, on_hand, on_order, safety_stock, reorder_point}]
- suppliers: [{id, name, on_time_rate, quality_score, avg_lead_time, categories[]}]
- purchase_orders: [{po_no, supplier, sku, qty, status, expected_date, value}]
- sales_history: [{month, sku, units_sold, revenue}]

Respond ONLY with valid JSON in this exact format:
{
  "name": "tool_function_name_snake_case",
  "display_name": "Human Readable Tool Name",
  "description": "What this tool does in 1-2 sentences",
  "category": "demand|supply|production|procurement|operations",
  "complexity": "simple|medium|complex",
  "agent_ids": ["demand_planner", "supply_planner", "production_planner", "procurement_planner", "ops_head"],
  "input_schema": {
    "type": "object",
    "properties": {
      "param_name": {"type": "string|number|boolean", "description": "what this param does", "default": "optional default"}
    },
    "required": ["required_param_names"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "result_field": {"type": "array|object|number|string", "description": "what this field contains"}
    }
  },
  "code": "// JavaScript code that uses inputParams and sample data variables\\n// Must end with: return { ... }\\nconst result = ...;\\nreturn result;"
}`;

      const userPrompt = `Create a supply chain tool for: "${input.description}"${input.category ? `\nCategory hint: ${input.category}` : ''}`;

      const response = await invokeLLM({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      } as any);

      const rawContent = response.choices?.[0]?.message?.content || '{}';
      const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
      let toolDef: any;
      try {
        toolDef = JSON.parse(content);
      } catch {
        throw new Error('LLM returned invalid JSON. Please try again.');
      }

      if (!toolDef.name || !toolDef.code) {
        throw new Error('LLM did not generate a complete tool definition. Please try again with more detail.');
      }

      return {
        name: toolDef.name,
        displayName: toolDef.display_name || toolDef.name,
        description: toolDef.description || input.description,
        category: toolDef.category || input.category || 'operations',
        complexity: toolDef.complexity || 'medium',
        agentIds: toolDef.agent_ids || ['ops_head'],
        inputSchema: toolDef.input_schema || { type: 'object', properties: {} },
        outputSchema: toolDef.output_schema || { type: 'object', properties: {} },
        code: toolDef.code,
      };
    }),

  // Step 2: Run the generated code on sample data and return results
  preview: protectedProcedure
    .input(z.object({
      code: z.string(),
      inputParams: z.record(z.string(), z.any()).optional(),
    }))
    .mutation(async ({ input }) => {
      const { result, error, executionTimeMs } = runToolCode(
        input.code,
        input.inputParams || {}
      );

      return {
        success: !error,
        result,
        error,
        executionTimeMs,
        sampleDataUsed: {
          skus: SAMPLE_DATA.skus.length,
          inventory: SAMPLE_DATA.inventory.length,
          suppliers: SAMPLE_DATA.suppliers.length,
          purchase_orders: SAMPLE_DATA.purchase_orders.length,
          sales_history: SAMPLE_DATA.sales_history.length,
        },
      };
    }),

  // Step 3: Save approved tool to database
  save: protectedProcedure
    .input(z.object({
      name: z.string(),
      displayName: z.string(),
      description: z.string(),
      category: z.enum(["demand", "supply", "production", "procurement", "operations"]),
      complexity: z.enum(["simple", "medium", "complex"]),
      agentIds: z.array(z.string()),
      inputSchema: z.any(),
      outputSchema: z.any(),
      code: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const tool = await createTool({
        name: input.displayName,
        description: input.description,
        category: input.category,
        agentIds: input.agentIds,
        inputSchema: input.inputSchema,
        outputSchema: input.outputSchema,
        implementation: input.name, // function identifier
        dataSources: ['skus', 'inventory', 'suppliers', 'purchase_orders', 'sales_history'],
        complexity: input.complexity,
        createdBy: ctx.user.openId,
      });

      // Store the code in the tool's metadata by updating
      await writeAuditLog({
        actorId: ctx.user.openId,
        actorName: ctx.user.name ?? undefined,
        actorType: 'human',
        action: 'tool_created',
        entityType: 'tool',
        entityId: (tool as any).tool_id,
        description: `Created tool via AI generator: ${input.displayName}`,
        metadata: { code: input.code, generated_by: 'llm' },
      });

      return { success: true, tool };
    }),

  // Get sample data for display
  getSampleData: publicProcedure
    .query(() => SAMPLE_DATA),
});
