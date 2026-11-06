import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getObservabilityCalls, getObservabilityCosts, getObservabilityStats, recordLlmCall, retryTrace, runRagDemo } from "./observability";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  observability: router({
    calls: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(500).default(100) }))
      .query(({ input }) => getObservabilityCalls(input.limit)),
    stats: publicProcedure.query(() => getObservabilityStats()),
    costs: publicProcedure.query(() => getObservabilityCosts()),
    runDemo: publicProcedure
      .input(z.object({ question: z.string().min(3).max(800) }))
      .mutation(({ input }) => runRagDemo(input.question)),
    addTrace: publicProcedure
      .input(z.object({
        provider:          z.string().min(1).max(32).default("groq"),
        model:             z.string().min(1).max(128),
        service:           z.string().min(1).max(128),
        endpoint:          z.string().min(1).max(255),
        prompt:            z.string().min(1).max(8000),
        response:          z.string().max(8000).optional(),
        latencyMs:         z.number().int().min(0).max(600_000),
        promptTokens:      z.number().int().min(0).max(1_000_000).optional(),
        completionTokens:  z.number().int().min(0).max(1_000_000).optional(),
        status:            z.enum(["success", "error"]).default("success"),
        errorMessage:      z.string().max(500).optional(),
      }))
      .mutation(({ input }) =>
        recordLlmCall({
          provider:         input.provider,
          model:            input.model,
          service:          input.service,
          endpoint:         input.endpoint,
          prompt:           input.prompt,
          response:         input.response ?? null,
          latencyMs:        input.latencyMs,
          promptTokens:     input.promptTokens,
          completionTokens: input.completionTokens,
          status:           input.status,
          errorMessage:     input.errorMessage ?? null,
        }),
      ),
    retryTrace: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => retryTrace(input.id)),
  }),
});

export type AppRouter = typeof appRouter;
