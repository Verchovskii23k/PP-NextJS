import { redirect } from "next/navigation";
import { db } from "@/db";
import { securityCenter, roles } from "@/db/schema";
import { count, eq } from "drizzle-orm";

export default async function HomePage() {
  // Проверяем наличие хотя бы одной учётной записи с ролью "admin"
  const [result] = await db
    .select({ value: count() })
    .from(securityCenter)
    .innerJoin(roles, eq(securityCenter.roleId, roles.id))
    .where(eq(roles.name, "admin"));

  const adminCount = result?.value ?? 0;

  if (adminCount === 0) {
    redirect("/setup");
  } else {
    redirect("/login");
  }
}