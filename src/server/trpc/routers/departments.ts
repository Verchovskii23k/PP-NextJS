// departments.ts — исправлена деструктуризация, добавлены проверки занятости
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { departments, employees, institutes, studyGroups } from "@/db/schema";
import { eq, asc, sql, and } from "drizzle-orm";
import { safeDelete } from "@/lib/safeDelete";
import { TRPCError } from "@trpc/server";
export const departmentsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: departments.id,
        name: departments.name,
        abbreviation: departments.abbreviation,
        instituteId: departments.instituteId,
        departmentCode: departments.departmentCode,
        headId: departments.headId,
        isActive: departments.isActive,
        display: sql<string>`${departments.abbreviation} || ' - ' || ${departments.name}`.as('display'),
        headDisplay: sql<string>`${employees.surname} || ' ' || left(${employees.name},1) || '.' || left(${employees.patronymic},1) || '.'`.as('head_display'),
      })
      .from(departments)
      .leftJoin(employees, eq(departments.headId, employees.id))   // прямая связь
      .orderBy(asc(departments.name));
  }),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: departments.id,
          name: departments.name,
          abbreviation: departments.abbreviation,
          instituteId: departments.instituteId,
          departmentCode: departments.departmentCode,
          headId: departments.headId,
          isActive: departments.isActive,
          display: sql<string>`${departments.abbreviation} || ' - ' || ${departments.name}`.as('display'),
          headDisplay: sql<string>`${employees.surname} || ' ' || left(${employees.name},1) || '.' || left(${employees.patronymic},1) || '.'`.as('head_display'),
        })
        .from(departments)
        .leftJoin(employees, eq(departments.headId, employees.id))
        .where(eq(departments.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        abbreviation: z.string().min(1),   // было .optional(), теперь обязательно
        instituteId: z.coerce.number().int(),
        departmentCode: z.coerce.number().int().positive(),
        headId: z.coerce.number().int().nullable().optional(),  // nullable поле
        isActive: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.headId) {
          // Не может быть директором
          const [isDirector] = await ctx.db
            .select({ id: institutes.id })
            .from(institutes)
            .where(eq(institutes.directorId, input.headId))
            .limit(1);
          if (isDirector) throw new TRPCError({ code: 'CONFLICT', message: 'Этот сотрудник уже является директором института' });

          // Не может быть куратором
          const [isCurator] = await ctx.db
            .select({ id: studyGroups.id })
            .from(studyGroups)
            .where(eq(studyGroups.curatorId, input.headId))
            .limit(1);
          if (isCurator) throw new TRPCError({ code: 'CONFLICT', message: 'Этот сотрудник уже является куратором' });
        }

        return ctx.db.insert(departments).values(input).returning();
      }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      abbreviation: z.string().optional(),
      instituteId: z.number().int().optional(),
      departmentCode: z.number().int().positive().optional(),
      headId: z.number().int().nullable().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, isActive, headId, ...data } = input;

      if (headId) {
        // Не может быть директором
        const [isDirector] = await ctx.db
          .select({ id: institutes.id })
          .from(institutes)
          .where(eq(institutes.directorId, headId))
          .limit(1);
        if (isDirector) throw new TRPCError({ code: 'CONFLICT', message: 'Этот сотрудник уже является директором института' });

        // Не может быть куратором
        const [isCurator] = await ctx.db
          .select({ id: studyGroups.id })
          .from(studyGroups)
          .where(eq(studyGroups.curatorId, headId))
          .limit(1);
        if (isCurator) throw new TRPCError({ code: 'CONFLICT', message: 'Этот сотрудник уже является куратором' });

        // Не может быть зав. другой кафедры
        const [isHead] = await ctx.db
          .select({ id: departments.id })
          .from(departments)
          .where(and(eq(departments.headId, headId), sql`${departments.id} != ${id}`))
          .limit(1);
        if (isHead) throw new TRPCError({ code: 'CONFLICT', message: 'Этот сотрудник уже является заведующим другой кафедрой' });
      }

      // Каскадное отключение... (остаётся)
      return ctx.db.update(departments).set({ ...data, headId, isActive }).where(eq(departments.id, id)).returning();
    }),
delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => safeDelete(departments, input.id)),
});