import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { disciplines, curriculum, disciplineTeachers } from "@/db/schema";
import { eq } from "drizzle-orm";

export const disciplinesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(disciplines);
  }),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(disciplines).where(eq(disciplines.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      abbreviation: z.string().min(1),   // было optional
      departmentId: z.coerce.number().int(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(disciplines).values(input).returning()),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      abbreviation: z.string().optional(),
      departmentId: z.coerce.number().int().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, isActive, ...data } = input;

      if (isActive === false) {
        await ctx.db.update(curriculum).set({ isActive: false }).where(eq(curriculum.disciplineId, id));
        await ctx.db.update(disciplineTeachers).set({ isActive: false }).where(eq(disciplineTeachers.disciplineId, id));
      }
      const cleanData = Object.fromEntries(
        Object.entries({ ...data, isActive }).filter(([_, v]) => v !== undefined)
      );
      return ctx.db
        .update(disciplines)
        .set({ ...data, isActive })
        .where(eq(disciplines.id, id))
        .returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(disciplines).where(eq(disciplines.id, input.id));
        return { success: true };
      } catch (e: any) {
        if (e?.code === '23503' || e?.message?.includes('foreign key') || e?.cause?.code === '23503') {
          throw new Error('Невозможно удалить – запись используется в других таблицах');
        }
        throw e;
      }
    }),
});