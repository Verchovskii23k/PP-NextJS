import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { buildings } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export const buildingsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(buildings).orderBy(asc(buildings.id));
  }),
  create: adminProcedure
    .input(z.object({ 
      number: z.coerce.number().int().positive(),
      isActive: z.boolean().default(true), 
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(buildings).values(input).returning();
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      number: z.coerce.number().int().positive().optional(),
      isActive: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(buildings).set(data).where(eq(buildings.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(buildings).where(eq(buildings.id, input.id));
        return { success: true };
      } catch (e: any) {
        if (e?.code === '23503' || e?.message?.includes('foreign key') || e?.cause?.code === '23503') {
          throw new Error('Невозможно удалить – запись используется в других таблицах');
        }
        throw e;
      }
    }),
  get: adminProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ ctx, input }) => {
    const rows = await ctx.db.select().from(buildings).where(eq(buildings.id, input.id)).limit(1);
    return rows[0] ?? null;
  }),
});