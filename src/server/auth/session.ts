import { db } from "@/db";
import { securityCenter } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// Простое хранилище сессий в памяти (для разработки). В продакшене — Redis/БД.
const sessions = new Map<string, { userId: number; role: string }>();

export async function createSession(userId: number): Promise<string> {
  const user = await db.select({ roleId: securityCenter.roleId })
    .from(securityCenter)
    .where(eq(securityCenter.id, userId))
    .limit(1);
  if (!user.length) throw new Error("User not found");
  
  const role = user[0].roleId === 1 ? "admin" : user[0].roleId === 2 ? "teacher" : "student";
  const token = uuidv4();
  sessions.set(token, { userId, role });
  return token;
}

export async function getUserFromSession(token: string) {
  const session = sessions.get(token);
  if (!session) return null;
  return { id: session.userId, role: session.role };
}

export function deleteSession(token: string) {
  sessions.delete(token);
}