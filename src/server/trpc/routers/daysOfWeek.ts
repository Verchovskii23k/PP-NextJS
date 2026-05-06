import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { daysOfWeek } from "@/db/schema";
import { eq } from "drizzle-orm";
import { TRACE_OUTPUT_VERSION } from "next/dist/shared/lib/constants";

export const daysOfWeekRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(daysOfWeek)),
  create: adminProcedure.input(z.object({ 
    name: z.string(),
    isActive: z.boolean().default(true)
 }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(daysOfWeek).values(input).returning()),
  update: adminProcedure.input(z.object({ id: z.number(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, name } = input;
      return ctx.db.update(daysOfWeek).set({ name }).where(eq(daysOfWeek.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ 
      id: z.number(),
      isActive: z.boolean().optional()
    }))
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