import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { pairs } from "@/db/schema";
import { eq } from "drizzle-orm";

export const pairsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(pairs)),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(pairs).where(eq(pairs.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      number: z.number().int().positive(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(pairs).values(input).returning()),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      number: z.number().int().positive().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(pairs).set(data).where(eq(pairs.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(pairs).where(eq(pairs.id, input.id));
        return { success: true };
      } catch (e: any) {
        if (e?.code === '23503' || e?.message?.includes('foreign key') || e?.cause?.code === '23503') {
          throw new Error('Невозможно удалить – запись используется в других таблицах');
        }
        throw e;
      }
    }),
});