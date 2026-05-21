import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { db } from "@/db";
import { users, employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { clearAllTestData } from "@/test/helpers"; // <-- добавляем
import { seedTestData } from "@/test/fixtures/fixtures";

export const e2eTestHelpersRouter = router({
  resetAndSeed: publicProcedure
    .input(
      z.object({
        adminEmail: z.string().email().optional(),
        adminPassword: z.string().min(6).optional(),
      }).optional()
    )
    .mutation(async ({ input }) => {
      await clearAllTestData(); // <-- замена вместо clearDatabase
      await seedTestData();

      if (input?.adminEmail) {
        const email = input.adminEmail;
        const password = input.adminPassword ?? 'admin123';

        // Создаём пользователя через better-auth
        const result = await auth.api.signUpEmail({
          body: {
            email,
            password,
            name: 'E2E Admin',
          },
        });

        if (!result?.user) {
          throw new Error('Не удалось создать администратора');
        }

        // Устанавливаем роль admin и сохраняем хеш пароля
        const hashed = await bcrypt.hash(password, 10);
        await db.update(users)
          .set({ role: 'admin', hashedPassword: hashed })
          .where(eq(users.id, result.user.id));

        // Создаём сотрудника-админа
        await db.insert(employees).values({
          surname: 'E2E',
          name: 'Admin',
          userId: result.user.id,
          isAdmin: true,
          isActive: true,
        });

        return { login: email, password };
      }
      return null;
    }),

  seedAdmin: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(6).optional() }))
    .mutation(async ({ input }) => {
      const password = input.password ?? 'admin123';
      const result = await auth.api.signUpEmail({
        body: {
          email: input.email,
          password,
          name: 'E2E Admin',
        },
      });

      if (!result?.user) {
        throw new Error('Не удалось создать администратора');
      }

      const hashed = await bcrypt.hash(password, 10);
      await db.update(users)
        .set({ role: 'admin', hashedPassword: hashed })
        .where(eq(users.id, result.user.id));

      await db.insert(employees).values({
        surname: 'E2E',
        name: 'Admin',
        userId: result.user.id,
        isAdmin: true,
        isActive: true,
      });

      return { login: input.email, password };
    }),
});