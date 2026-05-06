import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { hourTypeMapping } from "@/db/schema";
import { eq } from "drizzle-orm";

export const hourTypeMappingRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(hourTypeMapping)),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(hourTypeMapping).where(eq(hourTypeMapping.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      planHourColumn: z.string().min(1),
      priorityColumn: z.string().min(1),
      lessonTypeId: z.coerce.number().int(),
      isActive: z.boolean().default(true)
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(hourTypeMapping).values(input).returning()),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      planHourColumn: z.string().min(1).optional(),
      priorityColumn: z.string().min(1).optional(),
      lessonTypeId: z.coerce.number().int().optional(),
      isActive: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(hourTypeMapping).set(data).where(eq(hourTypeMapping.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(hourTypeMapping).where(eq(hourTypeMapping.id, input.id));
        return { success: true };
      } catch (e: any) {
        if (e?.code === '23503' || e?.message?.includes('foreign key') || e?.cause?.code === '23503') {
          throw new Error('Невозможно удалить – запись используется в других таблицах');
        }
        throw e;
      }
    }),
});