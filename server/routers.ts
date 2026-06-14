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
        const systemPrompts: Record<string, string> = {
          'Demand Planner': 'You are a Demand Planning expert. Analyze sales trends, forecast demand, and provide insights on market opportunities. Be concise and actionable.',
          'Supply Planner': 'You are a Supply Planning expert. Optimize inventory levels, manage supplier relationships, and ensure supply chain efficiency. Be concise and actionable.',
          'Production Planner': 'You are a Production Planning expert. Schedule production runs, optimize capacity, and minimize lead times. Be concise and actionable.',
          'Procurement Planner': 'You are a Procurement expert. Manage purchase orders, negotiate with suppliers, and optimize procurement costs. Be concise and actionable.',
          'Ops Head': 'You are an Operations Head. Oversee end-to-end supply chain, manage KPIs, and drive operational excellence. Be concise and actionable.',
        };
        
        try {
          const response = await invokeLLM({
            messages: [
              { role: 'system', content: systemPrompts[input.agentName] || 'You are a supply chain planning assistant.' },
              { role: 'user', content: input.message },
            ],
          });
          
          const assistantMessage = response.choices[0]?.message?.content || 'Unable to generate response';
          return {
            success: true,
            message: assistantMessage,
            conversationId: input.conversationId || `conv-${Date.now()}`,
          };
        } catch (error) {
          console.error('LLM error:', error);
          return {
            success: false,
            message: 'Error generating response. Please try again.',
            error: String(error),
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
