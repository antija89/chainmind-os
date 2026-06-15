import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { getAgents } from "./agents";
import { getFgMasterList, getInventoryList, getPoDataList, getSuppliersList, getHilGatesPending } from "./db";
import { z } from 'zod';
import { invokeLLM } from "./_core/llm";
import { TRPCError } from '@trpc/server';
import { importExcelData } from './excelImport';
import { setLLMConfig, getLLMConfig, callLLM } from './llmService';
import { gatherAgentContext } from './tools';

// Role-based access control middleware
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

export const opsHeadProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!['admin', 'ops_head'].includes(ctx.user?.role || '')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Ops Head access required' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  settings: router({
    saveLlmConfig: publicProcedure
      .input(z.object({
        provider: z.enum(['gemini', 'openai', 'anthropic', 'custom']),
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
      return config ? { ...config, apiKey: '***' } : null;
    }),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    updateRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(['user', 'admin', 'ops_head', 'planner']) }))
      .mutation(async ({ input }) => {
        return { success: true, message: `User role updated to ${input.role}` };
      }),
  }),

  agents: router({
    list: publicProcedure.query(() => getAgents()),
    sendMessage: protectedProcedure
      .input(z.object({
        agentName: z.string(),
        message: z.string(),
        conversationId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const SYSTEM_PROMPTS: Record<string, string> = {
          'Demand Planner': 'You are a senior Demand Planning expert at a consumer goods company. You have access to real supply chain data provided below. Answer questions using ONLY the data provided — never make up numbers. Be specific, concise, and actionable. Format your answers with bullet points or tables where helpful.',
          'Supply Planner': 'You are a senior Supply Planning expert. You have access to real inventory, PO, and supply data provided below. Answer questions using ONLY the data provided — never make up numbers. Be specific, concise, and actionable.',
          'Production Planner': 'You are a senior Production Planning expert. You have access to real inventory and forecast data provided below. Answer questions using ONLY the data provided — never make up numbers. Be specific, concise, and actionable.',
          'Procurement Planner': 'You are a senior Procurement expert. You have access to real PO and supplier data provided below. Answer questions using ONLY the data provided — never make up numbers. Be specific, concise, and actionable.',
          'Ops Head': 'You are the Operations Head overseeing the full supply chain. You have access to real supply chain data provided below. Answer questions using ONLY the data provided — never make up numbers. Provide executive-level insights with clear priorities.',
        };

        try {
          // 1. Gather live data context from DB (deterministic tools — no LLM involved)
          const dataContext = await gatherAgentContext(input.agentName);
          const systemPrompt = (SYSTEM_PROMPTS[input.agentName] ?? SYSTEM_PROMPTS['Ops Head']) +
            (dataContext ? `\n\n--- LIVE SUPPLY CHAIN DATA ---\n${dataContext}\n--- END OF DATA ---` : '');

          // 2. Call LLM with context (LLM only does reasoning & language, not calculation)
          const reply = await callLLM(
            [{ role: 'user', content: input.message }],
            systemPrompt
          );

          return {
            success: true,
            message: reply,
            conversationId: input.conversationId || `conv-${Date.now()}`,
          };
        } catch (error) {
          console.error('[Agent] sendMessage error:', error);
          return {
            success: false,
            message: `Error: ${error instanceof Error ? error.message : String(error)}. Please check your LLM settings.`,
            conversationId: input.conversationId || `conv-${Date.now()}`,
          };
        }
      }),
  }),

  data: router({
    fgMaster: publicProcedure.query(() => getFgMasterList()),
    inventory: publicProcedure.query(() => getInventoryList()),
    poData: publicProcedure.query(() => getPoDataList()),
    suppliers: publicProcedure.query(() => getSuppliersList()),
    importExcel: protectedProcedure
      .input(z.object({
        tableName: z.string(),
        fileData: z.string(),
        fileName: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const buffer = Buffer.from(input.fileData, 'base64');
          const result = await importExcelData(input.tableName, buffer);
          return result;
        } catch (error) {
          return {
            success: false,
            message: `Error importing file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            rowsInserted: 0,
          };
        }
      }),
  }),

  hil: router({
    pending: publicProcedure.query(() => getHilGatesPending()),
  }),
});

export type AppRouter = typeof appRouter;
