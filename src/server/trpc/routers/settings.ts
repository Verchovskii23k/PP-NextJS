import { z } from 'zod';
import { router, adminProcedure } from '../trpc';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const settingsRouter = router({
  get: adminProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, input.key))
        .limit(1);
      return result[0] ?? null;
    }),

  update: adminProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(settings)
        .set({ value: input.value, updatedAt: new Date() })
        .where(eq(settings.key, input.key));
      return { success: true };
    }),
});