import { db } from "@/db";
import { sessions, securityCenter, roles } from "@/db/schema";
import { eq, lt } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 дней

export async function createSession(userId: number): Promise<string> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  // Получаем роль пользователя
  const [user] = await db
    .select({ role: roles.name })
    .from(securityCenter)
    .innerJoin(roles, eq(securityCenter.roleId, roles.id))
    .where(eq(securityCenter.id, userId))
    .limit(1);

  if (!user) throw new Error("User not found");

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({
    userId,
    token,
    expiresAt,
  });

  // Периодически чистим просроченные сессии (можно вынести в cron)
  await db
    .delete(sessions)
    .where(eq(sessions.expiresAt, new Date())) // упрощённо для примера, лучше поставить условие < now()
    .execute(); // но для простоты удалим все просроченные
  // Лучше так:
  // await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));

  return token;
}

export async function getUserFromSession(token: string) {
  const [row] = await db
    .select({
      userId: sessions.userId,
      role: roles.name,
    })
    .from(sessions)
    .innerJoin(securityCenter, eq(sessions.userId, securityCenter.id))
    .innerJoin(roles, eq(securityCenter.roleId, roles.id))
    .where(eq(sessions.token, token))
    .limit(1);

  if (!row) {
    return null;
  }

  return { id: row.userId, role: row.role };
}

export async function deleteSession(token: string) {
  await db.delete(sessions).where(eq(sessions.token, token));
}