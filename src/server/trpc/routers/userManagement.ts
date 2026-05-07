import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { securityCenter, employees, students } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/server/auth/password";
import { sendPasswordResetEmail } from "@/server/email";

export const userManagementRouter = router({
  // Получить всех пользователей с их ФИО и email
  listUsers: adminProcedure.query(async ({ ctx }) => {
    const securityRows = await ctx.db
      .select({
        id: securityCenter.id,
        login: securityCenter.login,
        roleId: securityCenter.roleId,
      })
      .from(securityCenter);

    const result = await Promise.all(
      securityRows.map(async (sec) => {
        const [emp] = await ctx.db
          .select({
            surname: employees.surname,
            name: employees.name,
            patronymic: employees.patronymic,
            email: employees.email,
          })
          .from(employees)
          .where(eq(employees.authenticationId, sec.id))
          .limit(1);

        if (emp) {
          return {
            ...sec,
            fullName: `${emp.surname} ${emp.name}${emp.patronymic ? ' ' + emp.patronymic : ''}`,
            email: emp.email,
          };
        }

        const [stu] = await ctx.db
          .select({
            surname: students.surname,
            name: students.name,
            email: students.email,
          })
          .from(students)
          .where(eq(students.authenticationId, sec.id))
          .limit(1);

        if (stu) {
          return {
            ...sec,
            fullName: `${stu.surname} ${stu.name}`,
            email: stu.email,
          };
        }

        return { ...sec, fullName: sec.login, email: null as string | null };
      })
    );

    return result;
  }),

  // Админский сброс логина/пароля
// adminResetCredentials – новая версия
adminResetCredentials: adminProcedure
  .input(z.object({ userId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const { userId } = input;

    // Генерируем новые логин и пароль
    const login = `user_${userId}_${Math.random().toString(36).slice(2, 6)}`;
    const password = Math.random().toString(36).slice(2, 10);
    const hashed = await hashPassword(password);

    await ctx.db
      .update(securityCenter)
      .set({
        login,
        passwordHash: hashed,
        resetToken: null,
        resetTokenExpires: null,
        passwordChangedAt: new Date(),
      })
      .where(eq(securityCenter.id, userId));

    // Ищем email
    const [emp] = await ctx.db
      .select({ email: employees.email })
      .from(employees)
      .where(eq(employees.authenticationId, userId))
      .limit(1);
    if (emp?.email) {
      await sendPasswordResetEmail(emp.email, login, password, true);
      return { emailSent: true };
    }

    const [stu] = await ctx.db
      .select({ email: students.email })
      .from(students)
      .where(eq(students.authenticationId, userId))
      .limit(1);
    if (stu?.email) {
      await sendPasswordResetEmail(stu.email, login, password, true);
      return { emailSent: true };
    }

    // Если email нет, возвращаем сгенерированные данные, чтобы администратор мог передать их вручную
    return { emailSent: false, login, password };
  }),
});