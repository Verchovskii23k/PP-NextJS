import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { employees, employeesDepartments, departments, disciplineTeachers } from "@/db/schema";
import { eq, and, asc, sql, inArray } from "drizzle-orm";

export const employeesRouter = router({
  list: adminProcedure
    .input(z.object({ instituteId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (input?.instituteId) {
        return ctx.db
          .selectDistinct({
            id: employees.id,
            display: sql<string>`${employees.surname} || ' ' || left(${employees.name},1) || '.' || left(${employees.patronymic},1) || '.'`.as('display'),
          })
          .from(employees)
          .innerJoin(employeesDepartments, eq(employees.id, employeesDepartments.employeeId))
          .innerJoin(departments, eq(employeesDepartments.departmentId, departments.id))
          .where(eq(departments.instituteId, input.instituteId))
          .orderBy(asc(sql`display`));
      }

      return ctx.db
        .select({
          id: employees.id,
          surname: employees.surname,
          name: employees.name,
          patronymic: employees.patronymic,
          phone: employees.phone,
          email: employees.email,
          isActive: employees.isActive,
          display: sql<string>`${employees.surname} || ' ' || left(${employees.name},1) || '.' || left(${employees.patronymic},1) || '.'`.as('display'),
        })
        .from(employees)
        .orderBy(asc(employees.surname));
    }),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: employees.id,
          surname: employees.surname,
          name: employees.name,
          patronymic: employees.patronymic,
          phone: employees.phone,
          email: employees.email,
          isActive: employees.isActive,
          display: sql<string>`${employees.surname} || ' ' || left(${employees.name},1) || '.' || left(${employees.patronymic},1) || '.'`.as('display'),
        })
        .from(employees)
        .where(eq(employees.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      surname: z.string().min(1),
      name: z.string().min(1),
      patronymic: z.string().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().email().nullable().optional(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(employees).values(input).returning();
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      surname: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
      patronymic: z.string().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().email().nullable().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, isActive, ...data } = input;

      if (isActive === false) {
        // Отключаем все связи сотрудника с кафедрами
        await ctx.db.update(employeesDepartments).set({ isActive: false }).where(eq(employeesDepartments.employeeId, id));

        // Отключаем все записи преподавателей дисциплин, где использовалась любая из этих связей
        const deptIds = (await ctx.db.select({ id: employeesDepartments.id }).from(employeesDepartments).where(eq(employeesDepartments.employeeId, id))).map(r => r.id);
        if (deptIds.length > 0) {
          await ctx.db.update(disciplineTeachers).set({ isActive: false }).where(inArray(disciplineTeachers.teacherDepartmentId, deptIds));
        }
      }

      return ctx.db
        .update(employees)
        .set({ ...data, isActive })
        .where(eq(employees.id, id))
        .returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(employees).where(eq(employees.id, input.id));
        return { success: true };
      } catch (e: any) {
        if (e?.code === '23503' || e?.message?.includes('foreign key') || e?.cause?.code === '23503') {
          throw new Error('Невозможно удалить – запись используется в других таблицах');
        }
        throw e;
      }
    }),
});