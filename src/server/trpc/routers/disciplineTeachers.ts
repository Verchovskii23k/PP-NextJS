import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { disciplineTeachers } from "@/db/schema";
import { eq } from "drizzle-orm";

export const disciplineTeachersRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(disciplineTeachers)),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(disciplineTeachers).where(eq(disciplineTeachers.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      lessonTypeId: z.coerce.number().int(),
      disciplineId: z.coerce.number().int(),
      teacherDepartmentId: z.coerce.number().int(),
      isActive: z.boolean().default(true)
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(disciplineTeachers).values(input).returning()),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      lessonTypeId: z.coerce.number().int().optional(),
      disciplineId: z.coerce.number().int().optional(),
      teacherDepartmentId: z.coerce.number().int().optional(),
      isActive: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(disciplineTeachers).set(data).where(eq(disciplineTeachers.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(disciplineTeachers).where(eq(disciplineTeachers.id, input.id));
        return { success: true };
      } catch (e: any) {
        if (e?.code === '23503' || e?.message?.includes('foreign key') || e?.cause?.code === '23503') {
          throw new Error('Невозможно удалить – запись используется в других таблицах');
        }
        throw e;
      }
    }),
});