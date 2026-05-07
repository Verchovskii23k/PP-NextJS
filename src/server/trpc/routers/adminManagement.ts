import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { employees, securityCenter, roles, students } from "@/db/schema";
import { eq } from "drizzle-orm";

export const adminManagementRouter = router({
  // Получить всех сотрудников с полем isAdmin
  listEmployeesWithAdminFlag: adminProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({
        id: employees.id,
        surname: employees.surname,
        name: employees.name,
        patronymic: employees.patronymic,
        email: employees.email,
        isAdmin: employees.isAdmin,
        authenticationId: employees.authenticationId,
      })
      .from(employees)
      .where(eq(employees.isActive, true))
      .orderBy(employees.surname, employees.name);

    return result;
  }),

  // Переключить флаг isAdmin и обновить роль в security_center
    toggleAdmin: adminProcedure
    .input(z.object({ employeeId: z.number(), isAdmin: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
        const { employeeId, isAdmin } = input;

        // Получаем текущий authenticationId
        const [emp] = await ctx.db
        .select({ authenticationId: employees.authenticationId })
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);

        if (!emp) throw new Error("Сотрудник не найден");

        // Обновляем флаг isAdmin в любом случае
        await ctx.db
        .update(employees)
        .set({ isAdmin })
        .where(eq(employees.id, employeeId));

        // Если у сотрудника нет учётной записи – предупреждаем, но не прерываем
        if (!emp.authenticationId) {
        return {
            success: true,
            warning: "У сотрудника нет учётной записи. После генерации логинов и паролей роль будет применена автоматически.",
        };
        }

        // Меняем роль в существующей учётной записи
        const [adminRole] = await ctx.db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, "admin"))
        .limit(1);
        const [teacherRole] = await ctx.db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, "teacher"))
        .limit(1);

        if (!adminRole || !teacherRole) throw new Error("Роли не найдены");

        const newRoleId = isAdmin ? adminRole.id : teacherRole.id;
        await ctx.db
        .update(securityCenter)
        .set({ roleId: newRoleId })
        .where(eq(securityCenter.id, emp.authenticationId));

        return { success: true };
    }),
    // Полная очистка всех учётных записей (для отладки)
    clearAllCredentials: adminProcedure.mutation(async ({ ctx }) => {
    await ctx.db.transaction(async (tx) => {
        // Отвязываем сотрудников и снимаем флаг администратора
        await tx.update(employees)
        .set({ authenticationId: null, isAdmin: false })
        .where(eq(employees.isActive, true));
        // Отвязываем студентов
        await tx.update(students)
        .set({ authenticationId: null })
        .where(eq(students.isActive, true));
        // Удаляем все записи из security_center
        await tx.delete(securityCenter);
    });
    return { success: true };
    }),
});