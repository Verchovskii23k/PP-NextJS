import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { daysOfWeek } from "@/db/schema";
import { eq } from "drizzle-orm";

export const daysOfWeekRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(daysOfWeek)),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(daysOfWeek).where(eq(daysOfWeek.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      name: z.string(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(daysOfWeek).values(input).returning()),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(daysOfWeek).set(data).where(eq(daysOfWeek.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(daysOfWeek).where(eq(daysOfWeek.id, input.id));
        return { success: true };
      } catch (e: any) {
        if (e?.code === '23503' || e?.message?.includes('foreign key') || e?.cause?.code === '23503') {
          throw new Error('Невозможно удалить – запись используется в других таблицах');
        }
        throw e;
      }
    }),
});