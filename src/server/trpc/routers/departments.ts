// departments.ts — исправлена деструктуризация, добавлены проверки занятости
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import {
  departments, specialties, disciplines, classrooms,
  employeesDepartments, employees, institutes, studyGroups
} from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";

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
        const clean = {
          name: input.name,
          abbreviation: input.abbreviation,
          instituteId: input.instituteId,
          departmentCode: input.departmentCode,
          headId: input.headId ?? null,
          isActive: input.isActive ?? true,
        };
        return ctx.db.insert(departments).values(clean).returning();
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
        // Проверка, что сотрудник не директор
        const [isDirector] = await ctx.db
          .select({ id: institutes.id })
          .from(institutes)
          .where(eq(institutes.directorId, headId))
          .limit(1);
        if (isDirector) throw new Error('Этот сотрудник является директором института и не может быть заведующим кафедрой');

        // Проверка, что сотрудник не куратор
        const [isCurator] = await ctx.db
          .select({ id: studyGroups.id })
          .from(studyGroups)
          .where(eq(studyGroups.curatorId, headId))
          .limit(1);
        if (isCurator) throw new Error('Этот сотрудник является куратором и не может быть заведующим кафедрой');
      }
      if (isActive === false) {
        await ctx.db.update(specialties).set({ isActive: false }).where(eq(specialties.departmentId, id));
        await ctx.db.update(disciplines).set({ isActive: false }).where(eq(disciplines.departmentId, id));
        await ctx.db.update(classrooms).set({ isActive: false }).where(eq(classrooms.departmentId, id));
        await ctx.db.update(employeesDepartments).set({ isActive: false }).where(eq(employeesDepartments.departmentId, id));
      }
      // const cleanData = Object.fromEntries(
      //   Object.entries({ ...data, headId, isActive }).filter(([_, v]) => v !== undefined)
      // );
      return ctx.db
        .update(departments)
        .set({ ...data, headId, isActive })
        .where(eq(departments.id, id))
        .returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(departments).where(eq(departments.id, input.id));
        return { success: true };
      } catch (e: any) {
        if (e?.code === '23503' || e?.message?.includes('foreign key') || e?.cause?.code === '23503') {
          throw new Error('Невозможно удалить – запись используется в других таблицах');
        }
        throw e;
      }
    }),
});