import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { institutes, departments, studyGroups } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { safeDelete } from "@/lib/safeDelete";
import { TRPCError } from "@trpc/server";
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
    .input(instituteCreateSchema.and(z.object({
      directorId: z.number().int().optional(),   // если нужно разрешить при создании
    })))
    .mutation(async ({ ctx, input }) => {
      if (input.directorId) {
        // Проверка, что сотрудник не зав. кафедрой
        const [isHead] = await ctx.db
          .select({ id: departments.id })
          .from(departments)
          .where(eq(departments.headId, input.directorId))
          .limit(1);
        if (isHead) throw new TRPCError({ code: 'CONFLICT', message: 'Этот сотрудник уже является заведующим кафедрой' });

        // Проверка, что сотрудник не куратор
        const [isCurator] = await ctx.db
          .select({ id: studyGroups.id })
          .from(studyGroups)
          .where(eq(studyGroups.curatorId, input.directorId))
          .limit(1);
        if (isCurator) throw new TRPCError({ code: 'CONFLICT', message: 'Этот сотрудник уже является куратором' });
      }

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
          // Не может быть зав. кафедрой
          const [isHead] = await ctx.db
            .select({ id: departments.id })
            .from(departments)
            .where(eq(departments.headId, directorId))
            .limit(1);
          if (isHead) throw new TRPCError({ code: 'CONFLICT', message: 'Этот сотрудник уже является заведующим кафедрой' });

          // Не может быть куратором
          const [isCurator] = await ctx.db
            .select({ id: studyGroups.id })
            .from(studyGroups)
            .where(eq(studyGroups.curatorId, directorId))
            .limit(1);
          if (isCurator) throw new TRPCError({ code: 'CONFLICT', message: 'Этот сотрудник уже является куратором' });

          // Не может быть директором другого института
          const [isDirector] = await ctx.db
            .select({ id: institutes.id })
            .from(institutes)
            .where(and(eq(institutes.directorId, directorId), sql`${institutes.id} != ${id}`))
            .limit(1);
          if (isDirector) throw new TRPCError({ code: 'CONFLICT', message: 'Этот сотрудник уже является директором другого института' });
        }

        // Каскадное отключение кафедр при isActive = false остаётся без изменений
        if (isActive === false) {
          await ctx.db.update(departments).set({ isActive: false }).where(eq(departments.instituteId, id));
        }

        return ctx.db.update(institutes).set({ ...data, directorId, isActive }).where(eq(institutes.id, id)).returning();
      }),
delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => safeDelete(institutes, input.id)),
});