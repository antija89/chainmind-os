/**
 * LLM Tool Executor - Handles tool-calling from LLM responses
 * Ensures agents use tools instead of direct API calls
 */

import { invokeLLM } from './_core/llm';
import { logToolExecution } from './db-tools';
import { getDb } from './db';
import { sql } from 'drizzle-orm';

export interface ToolDefinition {
  tool_id: string;
  name: string;
  description: string;
  category: string;
  implementation: string;
  input_schema: any;
  output_schema?: any;
}

export interface ToolCallRequest {
  agentId: string;
  userId?: number;
  messageId?: string;
  userQuery: string;
  systemPrompt?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  availableTools?: ToolDefinition[];
}

export interface ToolCallResult {
  toolId: string;
  toolName: string;
  input: any;
  output: any;
  executionTime: number;
  status: 'success' | 'error' | 'timeout';
  errorMessage?: string;
}

/**
 * Execute LLM with tool-calling capability
 * Returns both the LLM response and any tool calls made
 */
export async function executeLLMWithTools(request: ToolCallRequest): Promise<{
  response: string;
  toolCalls: ToolCallResult[];
  rawResponse: any;
}> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Get available tools for the agent
  const tools = request.availableTools || (await getToolsForAgent(request.agentId));
  
  // Convert tools to OpenAI function format
  const functions = tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.implementation,
      description: tool.description,
      parameters: tool.input_schema || {
        type: 'object',
        properties: {},
      },
    },
  }));

  // Build messages
  const messages = [
    {
      role: 'system' as const,
      content: request.systemPrompt || buildSystemPrompt(request.agentId, tools),
    },
    ...(request.conversationHistory || []),
    {
      role: 'user' as const,
      content: request.userQuery,
    },
  ];

  // Call LLM with tool definitions
  const startTime = Date.now();
  let response: any;
  let toolCalls: ToolCallResult[] = [];

  try {
    response = await invokeLLM({
      messages,
      tools: functions.length > 0 ? (functions as any) : undefined,
    });

    const executionTime = Date.now() - startTime;

    // Check if LLM wants to call tools
    const content = response.choices?.[0]?.message?.content || '';
    const toolUseBlocks = response.choices?.[0]?.message?.tool_calls || [];

    // Execute any tool calls
    if (toolUseBlocks && toolUseBlocks.length > 0) {
      for (const toolCall of toolUseBlocks) {
        const toolResult = await executeToolCall(
          toolCall,
          tools,
          request.agentId,
          request.userId,
          request.messageId
        );
        toolCalls.push(toolResult);
      }
    }

    return {
      response: content,
      toolCalls,
      rawResponse: response,
    };
  } catch (error) {
    console.error('[ToolExecutor] LLM invocation failed:', error);
    throw error;
  }
}

/**
 * Execute a single tool call from LLM
 */
async function executeToolCall(
  toolCall: any,
  availableTools: ToolDefinition[],
  agentId: string,
  userId?: number,
  messageId?: string
): Promise<ToolCallResult> {
  const startTime = Date.now();
  const toolName = toolCall.function?.name || toolCall.name;
  const toolInput = JSON.parse(toolCall.function?.arguments || toolCall.arguments || '{}');

  // Find tool definition
  const toolDef = availableTools.find(t => t.implementation === toolName);
  if (!toolDef) {
    const error = `Tool not found: ${toolName}`;
    await logToolExecution({
      toolId: 'unknown',
      agentId,
      userId,
      messageId,
      inputParams: toolInput,
      executionTime: Date.now() - startTime,
      status: 'error',
      errorMessage: error,
    });
    return {
      toolId: 'unknown',
      toolName,
      input: toolInput,
      output: null,
      executionTime: Date.now() - startTime,
      status: 'error',
      errorMessage: error,
    };
  }

  try {
    // Execute tool (mock implementation for now)
    const output = await executeToolImplementation(toolDef, toolInput);
    const executionTime = Date.now() - startTime;

    // Log execution
    await logToolExecution({
      toolId: toolDef.tool_id,
      agentId,
      userId,
      messageId,
      inputParams: toolInput,
      outputResult: output,
      executionTime,
      status: 'success',
    });

    return {
      toolId: toolDef.tool_id,
      toolName: toolDef.name,
      input: toolInput,
      output,
      executionTime,
      status: 'success',
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Log execution failure
    await logToolExecution({
      toolId: toolDef.tool_id,
      agentId,
      userId,
      messageId,
      inputParams: toolInput,
      executionTime,
      status: 'error',
      errorMessage,
    });

    return {
      toolId: toolDef.tool_id,
      toolName: toolDef.name,
      input: toolInput,
      output: null,
      executionTime,
      status: 'error',
      errorMessage,
    };
  }
}

/**
 * Execute tool implementation (mock for now, can be extended)
 */
async function executeToolImplementation(tool: ToolDefinition, input: any): Promise<any> {
  // Mock implementations for demonstration
  const implementations: Record<string, (input: any) => Promise<any>> = {
    forecastDemandBySku: async (input) => ({
      forecast: [100, 110, 120, 115, 125],
      confidence: 0.87,
      trend: 'increasing',
      seasonality: { Q1: 0.9, Q2: 1.1, Q3: 1.05, Q4: 0.95 },
    }),
    calculateSafetyStock: async (input) => ({
      safety_stock: Math.round(
        input.demand_std_dev * 1.65 * Math.sqrt(input.lead_time / 30)
      ),
      reorder_point: input.demand_mean * input.lead_time + 
        input.demand_std_dev * 1.65 * Math.sqrt(input.lead_time / 30),
      z_score: 1.65,
    }),
    calculateReorderPoint: async (input) => ({
      reorder_point: input.average_demand * input.lead_time + (input.safety_stock || 0),
    }),
    calculateDaysOfSupply: async (input) => ({
      days_of_supply: 15,
      current_inventory: 1500,
      daily_demand: 100,
      status: 'normal',
    }),
    identifySupplyGaps: async (input) => ({
      at_risk_items: [
        { sku: 'SKU-001', dos: 3, status: 'critical' },
        { sku: 'SKU-002', dos: 5, status: 'low' },
      ],
      total_at_risk: 2,
    }),
    getInventoryStatus: async (input) => ({
      inventory: [
        { sku: 'SKU-001', quantity: 500, dos: 5, status: 'normal' },
        { sku: 'SKU-002', quantity: 200, dos: 2, status: 'critical' },
      ],
    }),
    calculateMaterialRequirements: async (input) => ({
      materials: [
        { material_id: 'MAT-001', quantity: 1000, cost: 5000 },
        { material_id: 'MAT-002', quantity: 500, cost: 2500 },
      ],
      total_cost: 7500,
      lead_time_critical: ['MAT-001'],
    }),
    checkCapacityConstraints: async (input) => ({
      bottlenecks: ['Assembly Line 1', 'Packaging'],
      utilization_rate: 0.87,
      capacity_gaps: [
        { resource: 'Assembly Line 1', gap: 15, unit: 'hours/week' },
      ],
    }),
    validateProductionSchedule: async (input) => ({
      is_feasible: true,
      issues: [],
      recommendations: ['Increase Assembly Line 1 capacity by 20%'],
    }),
    createPurchaseOrder: async (input) => ({
      po_number: 'PO-2026-001',
      supplier: { id: 'SUP-001', name: 'Supplier A', lead_time: 14 },
      cost: 5000,
      eta: '2026-07-01',
    }),
    evaluateSupplierPerformance: async (input) => ({
      score: 87,
      rating: 'good',
      on_time_delivery: 0.94,
      quality_score: 0.89,
      cost_competitiveness: 0.82,
      recommendations: ['Maintain relationship', 'Monitor quality metrics'],
    }),
    findAlternativeSuppliers: async (input) => ({
      suppliers: [
        { id: 'SUP-002', name: 'Supplier B', score: 85 },
        { id: 'SUP-003', name: 'Supplier C', score: 82 },
      ],
    }),
    getConsolidatedKpis: async (input) => ({
      kpis: {
        demand_forecast_accuracy: 0.92,
        inventory_turnover: 4.5,
        on_time_delivery: 0.96,
        supplier_quality: 0.91,
      },
      trends: [
        { metric: 'demand_forecast_accuracy', trend: 'improving' },
        { metric: 'inventory_turnover', trend: 'stable' },
      ],
      alerts: [
        { severity: 'high', message: 'SKU-001 at critical inventory level' },
      ],
    }),
    identifyCriticalIssues: async (input) => ({
      issues: [
        {
          id: 'ISSUE-001',
          severity: 'critical',
          title: 'SKU-001 Stockout Risk',
          impact: 'Revenue loss potential: $50K',
        },
      ],
      impact: 'High - Immediate action required',
    }),
  };

  const impl = implementations[tool.implementation];
  if (!impl) {
    throw new Error(`Implementation not found for tool: ${tool.implementation}`);
  }

  return impl(input);
}

/**
 * Get tools available for a specific agent
 */
async function getToolsForAgent(agentId: string): Promise<ToolDefinition[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    // Mock implementation - return empty array for now
    // In production, this would query the database
    return [];
  } catch (error) {
    console.error('[ToolExecutor] Failed to get tools for agent:', error);
    return [];
  }
}

/**
 * Build system prompt with tool context
 */
function buildSystemPrompt(agentId: string, tools: ToolDefinition[]): string {
  const agentPrompts: Record<string, string> = {
    demand_planner: `You are a Demand Planning Agent. Your role is to forecast demand, identify trends, and optimize inventory levels. Use available tools to analyze sales history, detect seasonal patterns, and provide demand forecasts.`,
    supply_planner: `You are a Supply Planning Agent. Your role is to optimize inventory levels, ensure supply continuity, and identify supply gaps. Use available tools to calculate safety stock, determine reorder points, and monitor inventory health.`,
    production_planner: `You are a Production Planning Agent. Your role is to create feasible production schedules, identify capacity constraints, and calculate material requirements. Use available tools to validate schedules and optimize production.`,
    procurement_planner: `You are a Procurement Agent. Your role is to source materials, evaluate suppliers, and create purchase orders. Use available tools to find suppliers, assess performance, and manage procurement.`,
    ops_head: `You are the Operations Head Agent. Your role is to monitor overall supply chain health, identify critical issues, and provide executive insights. Use available tools to get consolidated KPIs and flag critical issues.`,
  };

  const basePrompt = agentPrompts[agentId] || `You are a Supply Chain Agent. Use available tools to help solve supply chain problems.`;
  
  const toolList = tools.length > 0 
    ? `\n\nAvailable tools:\n${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}`
    : '';

  return `${basePrompt}${toolList}\n\nWhen responding to queries, use the available tools to gather data and provide accurate, data-driven insights. Always prefer using tools over making assumptions.`;
}
