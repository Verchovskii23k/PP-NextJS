import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { employees, employeesDepartments, securityCenter, departments, specialties, profiles } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";

export const employeesRouter = router({
  list: adminProcedure
    .input(z.object({
      instituteId: z.number().optional(),
      departmentId: z.number().optional(),
      profileId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (input?.profileId) {
        const [profile] = await ctx.db
          .select({ specialtyId: profiles.specialtyId })
          .from(profiles)
          .where(eq(profiles.id, input.profileId))
          .limit(1);
        if (profile) {
          const [specialty] = await ctx.db
            .select({ departmentId: specialties.departmentId })
            .from(specialties)
            .where(eq(specialties.id, profile.specialtyId))
            .limit(1);
          if (specialty) {
            return ctx.db
              .selectDistinct({
                id: employees.id,
                display: sql<string>`${employees.surname} || ' ' || left(${employees.name},1) || '.' || left(${employees.patronymic},1) || '.'`.as('display'),
              })
              .from(employees)
              .innerJoin(employeesDepartments, eq(employees.id, employeesDepartments.employeeId))
              .where(eq(employeesDepartments.departmentId, specialty.departmentId))
              .orderBy(asc(sql`display`));
          }
        }
        return [];
      }
      if (input?.departmentId) {
        return ctx.db
          .selectDistinct({
            id: employees.id,
            display: sql<string>`${employees.surname} || ' ' || left(${employees.name},1) || '.' || left(${employees.patronymic},1) || '.'`.as('display'),
          })
          .from(employees)
          .innerJoin(employeesDepartments, eq(employees.id, employeesDepartments.employeeId))
          .where(eq(employeesDepartments.departmentId, input.departmentId))
          .orderBy(asc(sql`display`));
      }
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
      const { id, ...data } = input;
      return ctx.db.update(employees).set(data).where(eq(employees.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // 1. Получаем сотрудника, чтобы узнать authenticationId
      const [employee] = await ctx.db
        .select({ authenticationId: employees.authenticationId })
        .from(employees)
        .where(eq(employees.id, input.id))
        .limit(1);
      if (!employee) throw new Error("Сотрудник не найден");

      // 2. Удаляем привязки к кафедрам
      await ctx.db
        .delete(employeesDepartments)
        .where(eq(employeesDepartments.employeeId, input.id));

      // 3. Если есть учётная запись – удаляем её
      if (employee.authenticationId) {
        await ctx.db
          .delete(securityCenter)
          .where(eq(securityCenter.id, employee.authenticationId));
      }

      // 4. Удаляем самого сотрудника
      await ctx.db.delete(employees).where(eq(employees.id, input.id));
      return { success: true };
    }),
});