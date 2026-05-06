// institutes.ts — добавлены проверки занятости
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { institutes, departments, studyGroups } from "@/db/schema";
import { eq } from "drizzle-orm";

const instituteCreateSchema = z.object({
  universityCode: z.number().int().positive(),
  name: z.string().min(1),
  isActive: z.boolean().default(true),
});

export const institutesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(institutes);
  }),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(institutes)
        .where(eq(institutes.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(instituteCreateSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(institutes).values(input).returning();
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      universityCode: z.number().int().positive().optional(),
      name: z.string().min(1).optional(),
      directorId: z.number().int().nullable().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, directorId, isActive, ...data } = input;

      if (directorId) {
        // Проверка, что сотрудник не зав. кафедрой
        const [isHead] = await ctx.db
          .select({ id: departments.id })
          .from(departments)
          .where(eq(departments.headId, directorId))
          .limit(1);
        if (isHead) throw new Error('Этот сотрудник является заведующим кафедрой и не может быть директором');

        // Проверка, что сотрудник не куратор
        const [isCurator] = await ctx.db
          .select({ id: studyGroups.id })
          .from(studyGroups)
          .where(eq(studyGroups.curatorId, directorId))
          .limit(1);
        if (isCurator) throw new Error('Этот сотрудник является куратором и не может быть директором');
      }

      // Каскадное отключение кафедр
      if (isActive === false) {
        await ctx.db
          .update(departments)
          .set({ isActive: false })
          .where(eq(departments.instituteId, id));
      }

      return ctx.db
        .update(institutes)
        .set({ ...data, directorId, isActive })
        .where(eq(institutes.id, id))
        .returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(institutes).where(eq(institutes.id, input.id));
        return { success: true };
      } catch (e: any) {
        if (e?.code === '23503' || e?.message?.includes('foreign key') || e?.cause?.code === '23503') {
          throw new Error('Невозможно удалить – запись используется в других таблицах');
        }
        throw e;
      }
    }),
});