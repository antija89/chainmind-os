import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { importExcelData } from './excelImport';
import { setLLMConfig, getLLMConfig, callLLM } from './llmService';
import {
  getAgentsList, getAgentById, updateAgentInstructions,
  getPlansList, getPlanById, createPlan, updatePlanStatus,
  getHilGatesPending, getHilGateById, resolveHilGate, createHilGate,
  getAuditLogs, writeAuditLog,
  getFgMasterList, getRmMasterList, getBomList, getInventoryList,
  getSalesHistoryList, getForecastList, getPoDataList, getSuppliersList,
  getDashboardKpis, saveAgentMessage, getAgentMessages,
} from './db';

// ============ ROLE-BASED MIDDLEWARE ============

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  return next({ ctx });
});

export const opsHeadProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!['admin', 'ops_head'].includes(ctx.user?.role || ''))
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Ops Head or Admin access required' });
  return next({ ctx });
});

// ============ TOOL DEFINITIONS FOR LLM TOOL CALLING ============

const AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_top_selling_skus",
      description: "Get the top selling SKUs by units sold from sales history. Use when asked about top sellers, best performing products, or sales ranking.",
      parameters: { type: "object", properties: { limit: { type: "number", description: "Number of top SKUs to return, default 10" } }, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_inventory_status",
      description: "Get current inventory levels, stock status, and days of supply for all or specific items. Use when asked about stock, inventory, DOS, or availability.",
      parameters: { type: "object", properties: { itemId: { type: "string", description: "Optional specific item ID to filter" } }, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_open_pos",
      description: "Get all open purchase orders with supplier, value, ETA, and status. Use when asked about POs, procurement, incoming stock, or supplier orders.",
      parameters: { type: "object", properties: { supplierName: { type: "string", description: "Optional supplier name to filter" } }, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_forecast_summary",
      description: "Get demand forecast summary by SKU, country, and channel. Use when asked about forecast, demand plan, or projected sales.",
      parameters: { type: "object", properties: { fgCode: { type: "string", description: "Optional SKU code to filter" }, country: { type: "string", description: "Optional country to filter" } }, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_sales_trend",
      description: "Get historical sales trend data by month for analysis. Use when asked about sales trends, historical performance, or growth rates.",
      parameters: { type: "object", properties: { fgCode: { type: "string", description: "Optional SKU code to filter" }, months: { type: "number", description: "Number of recent months to include, default 6" } }, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_supplier_performance",
      description: "Get supplier list with lead times, payment terms, and approval status. Use when asked about suppliers, vendor performance, or sourcing.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_kpi_summary",
      description: "Get current KPI dashboard values: service level, forecast accuracy, inventory DOS, open PO count. Use for executive summaries or overall performance questions.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_bom",
      description: "Get Bill of Materials for finished goods showing components, quantities, and costs. Use when asked about BOM, recipe, components, or raw material requirements.",
      parameters: { type: "object", properties: { fgCode: { type: "string", description: "Optional FG code to filter" } }, required: [] },
    },
  },
];

// ============ TOOL EXECUTOR ============

async function executeTool(toolName: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (toolName) {
      case 'get_top_selling_skus': {
        const limit = (args.limit as number) || 10;
        const rows = await getSalesHistoryList();
        const totals: Record<string, number> = {};
        for (const r of rows) {
          const key = `${r.fgCode} (${r.fgDescription?.slice(0, 30) ?? ''})`;
          totals[key] = (totals[key] || 0) + (r.unitsSold || 0);
        }
        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, limit);
        if (sorted.length === 0) return "No sales history data available.";
        return `Top ${limit} SKUs by units sold:\n` + sorted.map(([sku, units], i) => `${i + 1}. ${sku}: ${units.toLocaleString()} units`).join('\n');
      }

      case 'get_inventory_status': {
        const itemId = args.itemId as string | undefined;
        const rows = itemId ? (await getInventoryList(itemId)) : (await getInventoryList());
        if (rows.length === 0) return "No inventory data available.";
        const summary = rows.slice(0, 20).map(r =>
          `${r.itemId} | ${r.location} | On Hand: ${r.qtyOnHand} | Available: ${r.available} | Status: ${r.stockStatus} | Age: ${r.ageDays}d`
        ).join('\n');
        return `Inventory Status (${rows.length} records):\n${summary}`;
      }

      case 'get_open_pos': {
        const supplierFilter = args.supplierName as string | undefined;
        const rows = supplierFilter ? (await getPoDataList(supplierFilter)) : (await getPoDataList());
        const open = rows.filter(r => !['Received', 'Closed', 'Cancelled'].includes(r.status || ''));
        if (open.length === 0) return "No open purchase orders found.";
        const totalValue = open.reduce((s, r) => s + Number(r.poValueAed || 0), 0);
        const summary = open.slice(0, 15).map(r =>
          `PO# ${r.poNo} | ${r.supplierName} | ${r.description?.slice(0, 25)} | Qty: ${r.openQty} | AED ${Number(r.poValueAed).toLocaleString()} | ETA: ${r.confirmedEta} | ${r.status}`
        ).join('\n');
        return `Open POs (${open.length} orders, Total: AED ${totalValue.toLocaleString()}):\n${summary}`;
      }

      case 'get_forecast_summary': {
        const fgCode = args.fgCode as string | undefined;
        const country = args.country as string | undefined;
        const rows = fgCode ? (await getForecastList(fgCode)) : (await getForecastList());
        const filtered = country ? rows.filter(r => r.country === country) : rows;
        if (filtered.length === 0) return "No forecast data available.";
        const summary = filtered.slice(0, 15).map(r =>
          `${r.fgCode} | ${r.country} | ${r.channel} | ${r.month} | Forecast: ${r.forecastUnits} units | Confidence: ${r.confidencePercent}%`
        ).join('\n');
        return `Forecast Summary (${filtered.length} records):\n${summary}`;
      }

      case 'get_sales_trend': {
        const fgCode = args.fgCode as string | undefined;
        const rows = fgCode ? (await getSalesHistoryList(fgCode)) : (await getSalesHistoryList());
        if (rows.length === 0) return "No sales history data available.";
        const byMonth: Record<string, number> = {};
        for (const r of rows) {
          const m = r.month || 'Unknown';
          byMonth[m] = (byMonth[m] || 0) + (r.unitsSold || 0);
        }
        const sorted = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
        return `Sales Trend (monthly units):\n` + sorted.map(([m, u]) => `${m}: ${u.toLocaleString()} units`).join('\n');
      }

      case 'get_supplier_performance': {
        const rows = await getSuppliersList();
        if (rows.length === 0) return "No supplier data available.";
        const summary = rows.map(r =>
          `${r.supplierCode} | ${r.supplierName} | ${r.country} | Lead Time: ${r.leadTimeDays}d | Terms: ${r.paymentTerms} | Approved: ${r.approved ? 'Yes' : 'No'}`
        ).join('\n');
        return `Suppliers (${rows.length}):\n${summary}`;
      }

      case 'get_kpi_summary': {
        const kpis = await getDashboardKpis();
        if (!kpis) return "KPI data not available.";
        return `Current KPIs:\n- Service Level: ${kpis.serviceLevel.toFixed(1)}% (Target: 95%)\n- Forecast Accuracy: ${kpis.forecastAccuracy.toFixed(1)}% (Target: 90%)\n- Inventory DOS: ${kpis.inventoryDos.toFixed(1)} days (Target: 30 days)\n- Open POs: ${kpis.openPoCount} (Value: AED ${kpis.openPoValue.toLocaleString()})\n- Pending HIL Gates: ${kpis.pendingHilGates}`;
      }

      case 'get_bom': {
        const fgCode = args.fgCode as string | undefined;
        const rows = fgCode ? (await getBomList(fgCode)) : (await getBomList());
        if (rows.length === 0) return "No BOM data available.";
        const summary = rows.slice(0, 20).map(r =>
          `${r.fgCode} → ${r.componentCode} (${r.componentDescription?.slice(0, 30)}) | Qty: ${r.qtyPerFg} ${r.uom} | Cost: AED ${r.stdCostAed}`
        ).join('\n');
        return `BOM (${rows.length} entries):\n${summary}`;
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (err) {
    console.error(`[Tool] Error executing ${toolName}:`, err);
    return `Error running tool ${toolName}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ============ AGENT SYSTEM PROMPTS ============

const SYSTEM_PROMPTS: Record<string, string> = {
  'demand_planner': `You are a senior Demand Planner at a consumer goods company. You have access to real supply chain data via tools. 
Rules:
- ALWAYS use tools to get actual data before answering — never guess numbers
- Be specific, concise, and actionable
- Format answers with tables or bullet points where helpful
- Flag anomalies and risks proactively
- Reference actual SKU codes and values from tool results`,

  'supply_planner': `You are a senior Supply Planner. You have access to real inventory, PO, and supply data via tools.
Rules:
- ALWAYS use tools to get actual data before answering
- Focus on supply gaps, DOS, and replenishment needs
- Quantify risks with actual numbers from tool results
- Recommend specific actions with timelines`,

  'production_planner': `You are a senior Production Planner. You have access to real inventory and forecast data via tools.
Rules:
- ALWAYS use tools to get actual data before answering
- Focus on production scheduling, capacity, and BOM requirements
- Identify material constraints using BOM and inventory data`,

  'procurement_planner': `You are a senior Procurement Planner. You have access to real PO and supplier data via tools.
Rules:
- ALWAYS use tools to get actual data before answering
- Focus on open POs, supplier performance, and material coverage
- Flag high-value POs and supplier risks`,

  'ops_head': `You are the Operations Head overseeing the full supply chain. You have access to all supply chain data via tools.
Rules:
- ALWAYS use tools to get actual data before answering
- Provide executive-level insights with clear priorities
- Synthesize across demand, supply, production, and procurement
- Identify the top 3 actions needed right now`,
};

// ============ MAIN ROUTER ============

export const appRouter = router({
  system: systemRouter,

  settings: router({
    saveLlmConfig: publicProcedure
      .input(z.object({
        provider: z.enum(['gemini', 'openai', 'anthropic', 'manus', 'custom']),
        apiKey: z.string(),
        apiUrl: z.string().optional(),
        model: z.string(),
      }))
      .mutation(({ input }) => {
        setLLMConfig(input);
        return { success: true };
      }),
    getLlmConfig: publicProcedure.query(() => {
      const config = getLLMConfig();
      return config ? { ...config, apiKey: config.apiKey ? '***' : '' } : null;
    }),
  }),

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============ AGENTS ROUTER ============
  agents: router({
    list: publicProcedure.query(() => getAgentsList()),
    getById: publicProcedure.input(z.object({ agentId: z.string() })).query(({ input }) => getAgentById(input.agentId)),

    updateInstructions: protectedProcedure
      .input(z.object({ agentId: z.string(), instructionStack: z.any() }))
      .mutation(async ({ input, ctx }) => {
        const result = await updateAgentInstructions(input.agentId, input.instructionStack);
        await writeAuditLog({
          actorId: ctx.user.openId,
          actorType: 'human',
          action: 'update_agent_instructions',
          resourceType: 'agent',
          resourceId: input.agentId,
          reason: 'Manual instruction update via UI',
        });
        return result;
      }),

    getChatHistory: protectedProcedure
      .input(z.object({ agentId: z.string() }))
      .query(({ input, ctx }) => getAgentMessages(input.agentId, ctx.user.id)),

    // Option C: Proper tool calling
    sendMessage: protectedProcedure
      .input(z.object({
        agentId: z.string(),
        agentName: z.string(),
        message: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const systemPrompt = SYSTEM_PROMPTS[input.agentId] || SYSTEM_PROMPTS['ops_head'];

        // Save user message to DB
        await saveAgentMessage({ agentId: input.agentId, userId: ctx.user.id, role: 'user', content: input.message });

        try {
          // Step 1: Send user message + tool definitions to LLM
          const messages: Array<{ role: string; content: string }> = [
            { role: 'user', content: input.message }
          ];

          const firstResponse = await callLLMWithTools(messages, systemPrompt, AGENT_TOOLS);

          let finalReply = '';
          const toolCallsUsed: string[] = [];

          // Step 2: If LLM wants to call a tool, execute it and feed result back
          if (firstResponse.toolCalls && firstResponse.toolCalls.length > 0) {
            const toolResults: Array<{ role: string; content: string; name?: string }> = [
              { role: 'user', content: input.message },
              { role: 'assistant', content: firstResponse.content || '' },
            ];

          for (const tc of firstResponse.toolCalls) {
            const toolName = tc.function?.name || tc.name || 'unknown';
            const toolArgs = typeof tc.function?.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : (tc.arguments || {});

            toolCallsUsed.push(toolName);
            const toolResult = await executeTool(toolName, toolArgs as Record<string, unknown>);

            toolResults.push({
              role: 'user',
              content: `[Tool result for ${toolName}]:\n${toolResult}`,
            });
          }

            // Step 3: Send tool results back to LLM for final answer
            const finalResponse = await callLLM(
              toolResults as Array<{ role: 'user' | 'assistant'; content: string }>,
              systemPrompt
            );
            finalReply = finalResponse;
          } else {
            // LLM answered directly (no tool needed)
            finalReply = firstResponse.content || 'No response generated.';
          }

          // Save assistant reply to DB
          await saveAgentMessage({
            agentId: input.agentId,
            userId: ctx.user.id,
            role: 'assistant',
            content: finalReply,
            metadata: { toolsUsed: toolCallsUsed },
          });

          return {
            success: true,
            message: finalReply,
            toolsUsed: toolCallsUsed,
          };
        } catch (error) {
          console.error('[Agent] sendMessage error:', error);
          const errMsg = `I encountered an error: ${error instanceof Error ? error.message : String(error)}. Please check your LLM settings in the Settings page.`;
          return { success: false, message: errMsg, toolsUsed: [] };
        }
      }),
  }),

  // ============ DASHBOARD ROUTER ============
  dashboard: router({
    kpis: publicProcedure.query(() => getDashboardKpis()),
    alerts: publicProcedure.query(async () => {
      const pending = await getHilGatesPending();
      return pending.slice(0, 10).map(g => ({
        id: g.gateId,
        title: g.triggerType || 'Alert',
        description: (g.payload as Record<string, string>)?.description || 'Pending review',
        priority: g.priority || 'normal',
        agentId: g.agentId,
        createdAt: g.createdAt,
      }));
    }),
  }),

  // ============ DATA ROUTER ============
  data: router({
    fgMaster: publicProcedure.input(z.object({ search: z.string().optional() })).query(({ input }) => getFgMasterList(input.search)),
    rmMaster: publicProcedure.input(z.object({ search: z.string().optional() })).query(({ input }) => getRmMasterList(input.search)),
    bom: publicProcedure.input(z.object({ search: z.string().optional() })).query(({ input }) => getBomList(input.search)),
    inventory: publicProcedure.input(z.object({ search: z.string().optional() })).query(({ input }) => getInventoryList(input.search)),
    salesHistory: publicProcedure.input(z.object({ search: z.string().optional() })).query(({ input }) => getSalesHistoryList(input.search)),
    forecast: publicProcedure.input(z.object({ search: z.string().optional() })).query(({ input }) => getForecastList(input.search)),
    poData: publicProcedure.input(z.object({ search: z.string().optional() })).query(({ input }) => getPoDataList(input.search)),
    suppliers: publicProcedure.input(z.object({ search: z.string().optional() })).query(({ input }) => getSuppliersList(input.search)),

    importExcel: protectedProcedure
      .input(z.object({ tableName: z.string(), fileData: z.string(), fileName: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const buffer = Buffer.from(input.fileData, 'base64');
          return await importExcelData(input.tableName, buffer);
        } catch (error) {
          return { success: false, message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, rowsInserted: 0 };
        }
      }),
  }),

  // ============ HIL ROUTER ============
  hil: router({
    // list with optional status filter (used by HilInbox page)
    list: publicProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(({ input }) => getHilGatesPending(input.status)),

    // legacy alias
    pending: publicProcedure.query(() => getHilGatesPending('pending')),

    // respond mutation (used by HilInbox page) — maps action to resolution
    respond: protectedProcedure
      .input(z.object({
        id: z.number(),
        action: z.enum(['approve', 'reject', 'override']),
        reason: z.string().min(1, 'Reason is required'),
      }))
      .mutation(async ({ input, ctx }) => {
        const resolutionMap = { approve: 'approved', reject: 'rejected', override: 'overridden' } as const;
        const resolution = resolutionMap[input.action];
        await resolveHilGate(String(input.id), resolution, input.reason, ctx.user.openId);
        await writeAuditLog({
          actorId: ctx.user.openId,
          actorName: ctx.user.name || ctx.user.openId,
          actorType: 'human',
          action: `hil_${resolution}`,
          entityType: 'hil_gate',
          entityId: String(input.id),
          reason: input.reason,
          description: `HIL gate #${input.id} ${resolution}`,
        });
        return { success: true };
      }),

    // legacy resolve alias
    resolve: protectedProcedure
      .input(z.object({
        gateId: z.string(),
        resolution: z.enum(['approved', 'rejected', 'overridden']),
        reason: z.string().min(1, 'Reason is required'),
      }))
      .mutation(async ({ input, ctx }) => {
        await resolveHilGate(input.gateId, input.resolution, input.reason, ctx.user.openId);
        await writeAuditLog({
          actorId: ctx.user.openId,
          actorName: ctx.user.name || ctx.user.openId,
          actorType: 'human',
          action: `hil_${input.resolution}`,
          entityType: 'hil_gate',
          entityId: input.gateId,
          reason: input.reason,
          description: `HIL gate ${input.gateId} ${input.resolution}`,
        });
        return { success: true };
      }),

    create: protectedProcedure
      .input(z.object({
        triggerType: z.string(),
        agentId: z.string(),
        payload: z.any(),
        priority: z.enum(['urgent', 'normal', 'low']).default('normal'),
      }))
      .mutation(async ({ input }) => {
        return createHilGate(input);
      }),
  }),

  // ============ PLAN STORE ROUTER ============
  plans: router({
    list: publicProcedure.input(z.object({ type: z.string().optional() })).query(({ input }) => getPlansList(input.type)),
    getById: publicProcedure.input(z.object({ planId: z.string() })).query(({ input }) => getPlanById(input.planId)),

    create: protectedProcedure
      .input(z.object({
        type: z.string(),
        agentId: z.string(),
        dataPayload: z.any(),
        version: z.number().default(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const planId = `plan-${nanoid(10)}`;
        const result = await createPlan({ ...input, planId, status: 'draft' });
        await writeAuditLog({
          actorId: ctx.user.openId,
          actorType: 'human',
          action: 'create_plan',
          resourceType: 'plan',
          resourceId: planId,
        });
        return result;
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        planId: z.string(),
        status: z.enum(['draft', 'under_review', 'approved', 'rejected']),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const approvedBy = input.status === 'approved' ? ctx.user.openId : undefined;
        await updatePlanStatus(input.planId, input.status, approvedBy);
        await writeAuditLog({
          actorId: ctx.user.openId,
          actorType: 'human',
          action: `plan_${input.status}`,
          resourceType: 'plan',
          resourceId: input.planId,
          reason: input.reason,
        });
        return { success: true };
      }),
  }),

  // ============ AUDIT TRAIL ROUTER ============
  audit: router({
    list: publicProcedure
      .input(z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
        search: z.string().optional(),
        actorType: z.string().optional(),
      }))
      .query(({ input }) => getAuditLogs({ limit: input.limit, offset: input.offset, search: input.search, actorType: input.actorType })),
  }),
});

// ============ LLM WITH TOOLS HELPER ============

async function callLLMWithTools(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  tools: typeof AGENT_TOOLS
): Promise<{ content: string; toolCalls?: Array<{ name?: string; function?: { name: string; arguments: string }; arguments?: Record<string, unknown> }> }> {
  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages as Array<{ role: 'user' | 'assistant'; content: string }>,
      ],
      tools,
      tool_choice: 'auto',
    });

    const choice = response?.choices?.[0];
    const msg = choice?.message;
    const content = typeof msg?.content === 'string' ? msg.content : '';

    if (msg?.tool_calls && msg.tool_calls.length > 0) {
      return { content, toolCalls: msg.tool_calls };
    }

    return { content };
  } catch (err) {
    console.error('[LLM] callLLMWithTools error:', err);
    // Fallback: no tool calling, just direct answer
    const fallback = await callLLM(messages as Array<{ role: 'user' | 'assistant'; content: string }>, systemPrompt);
    return { content: fallback };
  }
}

export type AppRouter = typeof appRouter;
