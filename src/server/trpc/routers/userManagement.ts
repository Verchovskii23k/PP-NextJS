import { z } from 'zod';
import { router, adminProcedure } from '../trpc';
import { users, employees, students, accounts, verificationTokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateRandomPassword, hashPassword } from '@/lib/password';
import { sendNewCredentialsEmail, sendResetCodeEmail } from '@/server/email';
import { TRPCError } from '@trpc/server';

export const userManagementRouter = router({
  getUsers: adminProcedure
    .input(z.object({
      role: z.enum(['teacher', 'student']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const currentUserId = ctx.user!.id;
      const conditions = input.role ? [eq(users.role, input.role)] : [];
      const userList = await ctx.db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(and(...conditions));

      const result = [];
      for (const user of userList) {
        let fullName = user.email;
        const isSelf = user.id === currentUserId;

        if (user.role === 'teacher' || user.role === 'admin') {
          const [emp] = await ctx.db
            .select({
              surname: employees.surname,
              name: employees.name,
              patronymic: employees.patronymic,
            })
            .from(employees)
            .where(eq(employees.userId, user.id))
            .limit(1);
          if (emp) fullName = `${emp.surname} ${emp.name}${emp.patronymic ? ' ' + emp.patronymic : ''}`;
        } else if (user.role === 'student') {
          const [stu] = await ctx.db
            .select({
              surname: students.surname,
              name: students.name,
            })
            .from(students)
            .where(eq(students.userId, user.id))
            .limit(1);
          if (stu) fullName = `${stu.surname} ${stu.name}`;
        }
        result.push({ id: user.id, email: user.email, role: user.role, fullName, isSelf });
      }
      return result;
    }),

  updateRole: adminProcedure
    .input(z.object({
      userId: z.string(),
      newRole: z.enum(['teacher', 'student']),
    }))
    .mutation(async ({ ctx, input }) => {
      const currentUserId = ctx.user!.id;

      const [target] = await ctx.db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Пользователь не найден' });

      if (target.role === 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Нельзя изменить роль администратора' });
      }

      if (target.id === currentUserId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Нельзя изменить собственную роль' });
      }

      await ctx.db.update(users)
        .set({ role: input.newRole })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  sendResetCode: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'Пользователь не найден' });
      if (!user.email) throw new TRPCError({ code: 'BAD_REQUEST', message: 'У пользователя нет email' });

      const code = Math.floor(100 + Math.random() * 900).toString();
      const expires = new Date(Date.now() + 10 * 60 * 1000);

      await ctx.db.delete(verificationTokens).where(eq(verificationTokens.identifier, user.id));
      await ctx.db.insert(verificationTokens).values({
        identifier: user.id,
        token: code,
        expires,
      });

      await sendResetCodeEmail(user.email, code);
      return { success: true };
    }),

  confirmResetCode: adminProcedure
    .input(z.object({ userId: z.string(), code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [record] = await ctx.db
        .select()
        .from(verificationTokens)
        .where(and(eq(verificationTokens.identifier, input.userId), eq(verificationTokens.token, input.code)))
        .limit(1);

      if (!record || record.expires < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Неверный или истёкший код' });
      }

      const [user] = await ctx.db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'Пользователь не найден' });

      const newPassword = generateRandomPassword();
      const hashed = await hashPassword(newPassword);

      await ctx.db.update(users).set({ hashedPassword: hashed }).where(eq(users.id, user.id));

      const [acc] = await ctx.db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, 'credential')))
        .limit(1);

      if (acc) {
        await ctx.db.update(accounts)
          .set({ password: hashed, accountId: user.email })
          .where(eq(accounts.id, acc.id));
      } else {
        await ctx.db.insert(accounts).values({
          userId: user.id,
          providerId: 'credential',
          accountId: user.email,
          password: hashed,
        });
      }

      await ctx.db.delete(verificationTokens).where(eq(verificationTokens.identifier, user.id));

      if (!user.email) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'У пользователя нет email' });
      }

      await sendNewCredentialsEmail(user.email, newPassword);
      return { success: true, newPassword: null, message: 'Новый пароль отправлен на email' };
    }),

  resetUserPassword: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'Пользователь не найден' });

      const newPassword = generateRandomPassword();
      const hashed = await hashPassword(newPassword);

      await ctx.db.update(users)
        .set({ hashedPassword: hashed })
        .where(eq(users.id, user.id));

      const [acc] = await ctx.db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, 'credential')))
        .limit(1);

      if (acc) {
        await ctx.db.update(accounts)
          .set({ password: hashed, accountId: user.email })
          .where(eq(accounts.id, acc.id));
      } else {
        await ctx.db.insert(accounts).values({
          userId: user.id,
          providerId: 'credential',
          accountId: user.email,
          password: hashed,
        });
      }

      if (user.email) {
        await sendNewCredentialsEmail(user.email, newPassword);
        return { success: true, newPassword: null, message: 'Новый пароль отправлен на email' };
      }

      return { success: true, newPassword, message: null };
    }),
});