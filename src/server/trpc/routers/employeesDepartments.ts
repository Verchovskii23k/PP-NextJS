import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { employeesDepartments, employees, departments } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";

export const employeesDepartmentsRouter = router({
  list: adminProcedure
    .input(z.object({ instituteId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const query = ctx.db
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
        .from(employees);

      if (input?.instituteId) {
        // Оставляем только сотрудников, работающих на кафедрах этого института
        query
          .innerJoin(employeesDepartments, eq(employees.id, employeesDepartments.employeeId))
          .innerJoin(departments, eq(employeesDepartments.departmentId, departments.id))
          .where(eq(departments.instituteId, input.instituteId));
      }

      return query.orderBy(asc(employees.surname));
    }),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: employeesDepartments.id,
          employeeId: employeesDepartments.employeeId,
          departmentId: employeesDepartments.departmentId,
          employmentType: employeesDepartments.employmentType,
          position: employeesDepartments.position,
          display: sql<string>`${employees.surname} || ' ' || left(${employees.name},1) || '.' || left(${employees.patronymic},1) || '.'`.as('display'),
        })
        .from(employeesDepartments)
        .innerJoin(employees, eq(employeesDepartments.employeeId, employees.id))
        .where(eq(employeesDepartments.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      employeeId: z.coerce.number().int(),
      departmentId: z.coerce.number().int(),
      employmentType: z.coerce.string().nullable().optional(),
      position: z.coerce.string().nullable().optional(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(employeesDepartments).values(input).returning()),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      employeeId: z.coerce.number().int().optional(),
      departmentId: z.coerce.number().int().optional(),
      employmentType: z.coerce.string().nullable().optional(),
      position: z.coerce.string().nullable().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(employeesDepartments).set(data).where(eq(employeesDepartments.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(employeesDepartments).where(eq(employeesDepartments.id, input.id));
        return { success: true };
      } catch (e: any) {
        if (e?.code === '23503' || e?.message?.includes('foreign key') || e?.cause?.code === '23503') {
          throw new Error('Невозможно удалить – запись используется в других таблицах');
        }
        throw e;
      }
    }),
});