import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getAgents } from "./agents";
import { getFgMasterList, getInventoryList, getPoDataList, getSuppliersList, getHilGatesPending } from "./db";

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
  }),

  agents: router({
    list: publicProcedure.query(() => getAgents()),
  }),

  data: router({
    fgMaster: publicProcedure.query(() => getFgMasterList()),
    inventory: publicProcedure.query(() => getInventoryList()),
    poData: publicProcedure.query(() => getPoDataList()),
    suppliers: publicProcedure.query(() => getSuppliersList()),
  }),

  hil: router({
    pending: publicProcedure.query(() => getHilGatesPending()),
  }),
});

export type AppRouter = typeof appRouter;
