import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { securityCenter, roles } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, deleteSession } from "@/server/auth/session";
import { cookies } from "next/headers";

export const authRouter = router({
  setup: publicProcedure
    .input(z.object({ login: z.string().min(3), password: z.string().min(6) }))
    .mutation(async ({ ctx, input }) => {
      // Проверим, нет ли уже админов
      const admins = await ctx.db.select({ count: sql<number>`count(*)` })
        .from(securityCenter)
        .where(eq(securityCenter.roleId, 1)); // 1 = admin
      if (admins[0].count > 0) {
        throw new Error("Setup already completed");
      }

      // Создаём роль admin, если её нет (на всякий)
      let adminRole = await ctx.db.select().from(roles).where(eq(roles.name, "admin")).limit(1);
      if (adminRole.length === 0) {
        adminRole = await ctx.db.insert(roles).values({ name: "admin", description: "Администратор" }).returning();
      }

      const passwordHash = await hashPassword(input.password);
      const [user] = await ctx.db.insert(securityCenter).values({
        login: input.login,
        passwordHash,
        roleId: adminRole[0].id,
      }).returning();

      // Создаём сессию
      const token = await createSession(user.id);
      // Устанавливаем cookie
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
      const [user] = await ctx.db.select().from(securityCenter).where(eq(securityCenter.login, input.login)).limit(1);
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
    const [user] = await ctx.db.select({
      id: securityCenter.id,
      login: securityCenter.login,
      role: roles.name,
    })
      .from(securityCenter)
      .innerJoin(roles, eq(securityCenter.roleId, roles.id))
      .where(eq(securityCenter.id, ctx.user.id))
      .limit(1);
    return user ?? null;
  }),
});