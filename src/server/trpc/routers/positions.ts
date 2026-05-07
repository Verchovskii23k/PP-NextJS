import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { positions } from "@/db/schema";
import { eq } from "drizzle-orm";

export const positionsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(positions)),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(positions).where(eq(positions.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({ name: z.string().min(1), abbreviation: z.string().optional(), isActive: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(positions).values(input).returning()),
  update: adminProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).optional(), abbreviation: z.string().optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(positions).set(data).where(eq(positions.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(positions).where(eq(positions.id, input.id));
        return { success: true };
      } catch (e: any) {
        if (e?.code === '23503' || e?.message?.includes('foreign key') || e?.cause?.code === '23503') {
          throw new Error('Невозможно удалить – запись используется в других таблицах');
        }
        throw e;
      }
    }),
});