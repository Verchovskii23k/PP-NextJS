import { z } from 'zod';
import { router, adminProcedure } from '../trpc';
import { settings } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

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
      // Пытаемся вставить, если конфликт по ключу – обновить
      await ctx.db
        .insert(settings)
        .values({
          key: input.key,
          value: input.value,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: input.value,
            updatedAt: new Date(),
          },
        });
      return { success: true };
    }),
});