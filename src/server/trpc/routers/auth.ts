import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { securityCenter, roles, employees, students } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, deleteSession } from "@/server/auth/session";
import { cookies } from "next/headers";
import { sendPasswordResetEmail } from "@/server/email";
import { randomBytes } from "crypto";

export const authRouter = router({
  setup: publicProcedure
    .input(z.object({
      surname: z.string().min(1),
      name: z.string().min(1),
      patronymic: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      login: z.string().min(3),
      password: z.string().min(6),
    }))
    .mutation(async ({ ctx, input }) => {
      // Проверим, нет ли уже сотрудников-администраторов
      const [existingAdmin] = await ctx.db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.isAdmin, true))
        .limit(1);

      if (existingAdmin) {
        throw new Error("Setup already completed");
      }

      // Получаем или создаём роль admin
      let [adminRole] = await ctx.db.select().from(roles).where(eq(roles.name, "admin")).limit(1);
      if (!adminRole) {
        [adminRole] = await ctx.db.insert(roles).values({ name: "admin", description: "Администратор" }).returning();
      }

      const passwordHash = await hashPassword(input.password);

      // Транзакция: создаём сотрудника и учётную запись
      const [newUser] = await ctx.db.transaction(async (tx) => {
        const [newEmployee] = await tx.insert(employees).values({
          surname: input.surname,
          name: input.name,
          patronymic: input.patronymic || null,
          phone: input.phone || null,
          email: input.email || null,
          isAdmin: true,
          isActive: true,
        }).returning({ id: employees.id });

        const [newSec] = await tx.insert(securityCenter).values({
          login: input.login,
          passwordHash,
          roleId: adminRole.id,
        }).returning({ id: securityCenter.id });

        // Связываем сотрудника с учётной записью
        await tx.update(employees)
          .set({ authenticationId: newSec.id })
          .where(eq(employees.id, newEmployee.id));

        return [newSec];
      });

      // Создаём сессию
      const token = await createSession(newUser.id);
      (await cookies()).set("session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });

      return { success: true };
    }),

login: publicProcedure
  .input(z.object({ login: z.string(), password: z.string() }))
  .mutation(async ({ ctx, input }) => {
    try {
      const [user] = await ctx.db
        .select()
        .from(securityCenter)
        .where(eq(securityCenter.login, input.login))
        .limit(1);

      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new Error("Invalid credentials");
      }

      const token = await createSession(user.id);
      (await cookies()).set("session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      return { success: true };
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.message === "Invalid credentials") {
        throw error; // пробрасываем, чтобы клиент получил корректную ошибку
      }
      // Остальные ошибки (например, БД недоступна) превращаем в универсальное сообщение
      throw new Error("Внутренняя ошибка сервера. Попробуйте позже.");
    }
  }),

  logout: publicProcedure.mutation(async () => {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (token) {
      deleteSession(token);
      cookieStore.delete("session");
    }
    return { success: true };
  }),

  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    
    // Основные данные учётной записи
    const [sec] = await ctx.db
      .select({
        id: securityCenter.id,
        login: securityCenter.login,
        role: roles.name,
      })
      .from(securityCenter)
      .innerJoin(roles, eq(securityCenter.roleId, roles.id))
      .where(eq(securityCenter.id, ctx.user.id))
      .limit(1);

    if (!sec) return null;

    // Пробуем найти сотрудника
    const [emp] = await ctx.db
      .select({
        surname: employees.surname,
        name: employees.name,
        patronymic: employees.patronymic,
      })
      .from(employees)
      .where(eq(employees.authenticationId, ctx.user.id))
      .limit(1);

    if (emp) {
      const fullName = `${emp.surname} ${emp.name}${emp.patronymic ? ' ' + emp.patronymic : ''}`;
      return { ...sec, fullName };
    }

    // Пробуем найти студента
    const [stu] = await ctx.db
      .select({
        surname: students.surname,
        name: students.name,
      })
      .from(students)
      .where(eq(students.authenticationId, ctx.user.id))
      .limit(1);

    if (stu) {
      const fullName = `${stu.surname} ${stu.name}`;
      return { ...sec, fullName };
    }

    // Если ни к кому не привязан (например, старый технический админ), показываем логин
    return { ...sec, fullName: sec.login };
  }),
  changeLogin: protectedProcedure
    .input(z.object({ newLogin: z.string().min(3) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user!.id;

      // Получаем текущий хэш пароля
      const [currentUser] = await ctx.db
        .select({ passwordHash: securityCenter.passwordHash })
        .from(securityCenter)
        .where(eq(securityCenter.id, userId))
        .limit(1);

      if (!currentUser) throw new Error("Пользователь не найден");

      // Проверяем, нет ли уже такой пары (логин + хэш)
      const [existing] = await ctx.db
        .select({ id: securityCenter.id })
        .from(securityCenter)
        .where(
          and(
            eq(securityCenter.login, input.newLogin),
            eq(securityCenter.passwordHash, currentUser.passwordHash)
          )
        )
        .limit(1);

      if (existing && existing.id !== userId) {
        throw new Error("Такая пара логин/пароль уже существует");
      }

      await ctx.db
        .update(securityCenter)
        .set({ login: input.newLogin })
        .where(eq(securityCenter.id, userId));

      return { success: true };
    }),

    // Смена пароля
    changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user!.id;

      const [user] = await ctx.db
        .select({
          login: securityCenter.login,
          passwordHash: securityCenter.passwordHash,
        })
        .from(securityCenter)
        .where(eq(securityCenter.id, userId))
        .limit(1);

      if (!user) throw new Error("Пользователь не найден");

      // Проверяем старый пароль
      const isValid = await verifyPassword(input.currentPassword, user.passwordHash);
      if (!isValid) {
        throw new Error("Неверный текущий пароль");
      }

      // Хэшируем новый пароль
      const newHash = await hashPassword(input.newPassword);

      // Проверяем, нет ли уже такой пары (логин + новый хэш) у другого пользователя
      const [conflict] = await ctx.db
        .select({ id: securityCenter.id })
        .from(securityCenter)
        .where(
          and(
            eq(securityCenter.login, user.login),
            eq(securityCenter.passwordHash, newHash)
          )
        )
        .limit(1);

      if (conflict && conflict.id !== userId) {
        throw new Error("Такая пара логин/пароль уже занята другим пользователем");
      }

      // Обновляем хэш
      await ctx.db
        .update(securityCenter)
        .set({ passwordHash: newHash, passwordChangedAt: new Date() })
        .where(eq(securityCenter.id, userId));

      return { success: true };
    }),


forgotPassword: publicProcedure
  .input(
    z.object({
      login: z.string().optional(),
      email: z.string().email().optional(),
    }).refine(data => data.login || data.email, {
      message: "Укажите логин или email",
    })
  )
  .mutation(async ({ ctx, input }) => {
    let userId: number | undefined;
    let userLogin: string | undefined;
    let userEmail: string | null = null;

    // 1. Поиск пользователя
    if (input.login) {
      const [u] = await ctx.db
        .select({ id: securityCenter.id, login: securityCenter.login })
        .from(securityCenter)
        .where(eq(securityCenter.login, input.login))
        .limit(1);
      if (u) {
        userId = u.id;
        userLogin = u.login;
      }
    } else if (input.email) {
      // Поиск по email (регистронезависимый) среди сотрудников
      const [emp] = await ctx.db
        .select({ authenticationId: employees.authenticationId })
        .from(employees)
        .where(sql`lower(${employees.email}) = ${input.email.toLowerCase()}`)
        .limit(1);
      if (emp?.authenticationId) {
        const [u] = await ctx.db
          .select({ id: securityCenter.id, login: securityCenter.login })
          .from(securityCenter)
          .where(eq(securityCenter.id, emp.authenticationId))
          .limit(1);
        if (u) {
          userId = u.id;
          userLogin = u.login;
        }
      }
      // Если не нашли среди сотрудников – ищем студента
      if (!userId) {
        const [stu] = await ctx.db
          .select({ authenticationId: students.authenticationId })
          .from(students)
          .where(sql`lower(${students.email}) = ${input.email.toLowerCase()}`)
          .limit(1);
        if (stu?.authenticationId) {
          const [u] = await ctx.db
            .select({ id: securityCenter.id, login: securityCenter.login })
            .from(securityCenter)
            .where(eq(securityCenter.id, stu.authenticationId))
            .limit(1);
          if (u) {
            userId = u.id;
            userLogin = u.login;
          }
        }
      }
    }

    // 2. Если пользователь не найден – универсальное сообщение
    if (!userId) {
      return { message: "Если учётная запись с такими данными существует, инструкция отправлена." };
    }

    // 3. Генерируем токен и сохраняем
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 час
    await ctx.db
      .update(securityCenter)
      .set({ resetToken: token, resetTokenExpires: expires })
      .where(eq(securityCenter.id, userId));

    // 4. Находим email пользователя (точный, какой есть в базе)
    const [empEmail] = await ctx.db
      .select({ email: employees.email })
      .from(employees)
      .where(eq(employees.authenticationId, userId))
      .limit(1);
    if (empEmail?.email) userEmail = empEmail.email;

    if (!userEmail) {
      const [stuEmail] = await ctx.db
        .select({ email: students.email })
        .from(students)
        .where(eq(students.authenticationId, userId))
        .limit(1);
      if (stuEmail?.email) userEmail = stuEmail.email;
    }

    // 5. Пытаемся отправить письмо или возвращаем токен
    if (userEmail) {
      try {
        const sent = await sendPasswordResetEmail(userEmail, userLogin!, token, false);
        if (sent) return { message: "Инструкция отправлена на ваш email" };
      } catch (e) {
        console.error("Email sending failed, falling back to token:", e);
      }
    }

    return { token };
  }),

  resetPassword: publicProcedure
  .input(z.object({
    token: z.string(),
    newPassword: z.string().min(6),
    newLogin: z.string().min(3).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    // Ищем пользователя по токену
    const [user] = await ctx.db
      .select({ id: securityCenter.id })
      .from(securityCenter)
      .where(eq(securityCenter.resetToken, input.token))
      .limit(1);

    if (!user) throw new Error("Токен недействителен или истёк");

    // Проверяем срок действия
    const [fullUser] = await ctx.db
      .select({ resetTokenExpires: securityCenter.resetTokenExpires })
      .from(securityCenter)
      .where(eq(securityCenter.id, user.id))
      .limit(1);
    if (!fullUser?.resetTokenExpires || fullUser.resetTokenExpires < new Date()) {
      throw new Error("Токен истёк");
    }

    const newHash = await hashPassword(input.newPassword);

    // Определяем итоговый логин: если передан новый – используем его, иначе не меняем
    let targetLogin: string | undefined = undefined;
    if (input.newLogin) {
      targetLogin = input.newLogin;
    }

    // Проверяем уникальность пары (логин + хэш) только если логин задан (явно или остаётся текущий)
    if (targetLogin) {
      const [conflict] = await ctx.db
        .select({ id: securityCenter.id })
        .from(securityCenter)
        .where(
          and(
            eq(securityCenter.login, targetLogin),
            eq(securityCenter.passwordHash, newHash),
            sql`${securityCenter.id} != ${user.id}`
          )
        )
        .limit(1);
      if (conflict) {
        throw new Error("Пользователь с таким логином и паролем уже существует. Выберите другую комбинацию.");
      }
    } else {
      // Если логин не меняется, проверяем пару с текущим логином пользователя
      const [current] = await ctx.db
        .select({ login: securityCenter.login })
        .from(securityCenter)
        .where(eq(securityCenter.id, user.id))
        .limit(1);
      if (current) {
        targetLogin = current.login;
        const [conflict] = await ctx.db
          .select({ id: securityCenter.id })
          .from(securityCenter)
          .where(
            and(
              eq(securityCenter.login, targetLogin),
              eq(securityCenter.passwordHash, newHash),
              sql`${securityCenter.id} != ${user.id}`
            )
          )
          .limit(1);
        if (conflict) {
          throw new Error("Пользователь с таким логином и паролем уже существует. Выберите другой пароль.");
        }
      }
    }

    // Формируем объект обновления
    const updateData: Record<string, unknown> = {
      passwordHash: newHash,
      resetToken: null,
      resetTokenExpires: null,
      passwordChangedAt: new Date(),
    };
    if (input.newLogin) {
      updateData.login = input.newLogin;
    }

    await ctx.db
      .update(securityCenter)
      .set(updateData)
      .where(eq(securityCenter.id, user.id));

    return { success: true };
  }),
});
