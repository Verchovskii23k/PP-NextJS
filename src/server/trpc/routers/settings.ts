import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { db } from '@/db';

export const settingsRouter = createTRPCRouter({
  // Получить значение одной настройки по ключу
  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const result = await db
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, input.key))
        .limit(1);
      return result[0] ?? null;
    }),

  // Обновить значение настройки
  update: protectedProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ input }) => {
      await db
        .update(settings)
        .set({ value: input.value, updatedAt: new Date() })
        .where(eq(settings.key, input.key));
      return { success: true };
    }),
});