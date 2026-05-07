// src/app/page.tsx
import { redirect } from "next/navigation";
import { db } from "@/db";
import { securityCenter } from "@/db/schema";
import { count } from "drizzle-orm";

export default async function HomePage() {
  const [result] = await db.select({ value: count() }).from(securityCenter);
  const userCount = result?.value ?? 0;

  if (userCount === 0) {
    redirect("/setup");
  } else {
    redirect("/login");
  }
}