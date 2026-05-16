// src/lib/usageMetrics.ts
import { db } from "@/db";
import { lessonClassrooms, lessons, classrooms } from "@/db/schema";
import { eq, and, isNull, count } from "drizzle-orm";

export async function recalculateUsageMetrics() {
  // Подсчитываем количество активных связей для каждой аудитории
  const usage = await db
    .select({
      classroomId: lessonClassrooms.classroomId,
      cnt: count(),
    })
    .from(lessonClassrooms)
    .innerJoin(lessons, eq(lessonClassrooms.lessonId, lessons.id))
    .where(
      and(
        eq(lessonClassrooms.isActive, true),
        isNull(lessonClassrooms.versionId),
        eq(lessons.isActive, true),
        isNull(lessons.versionId)
      )
    )
    .groupBy(lessonClassrooms.classroomId);

  // Обнуляем метрики всем активным аудиториям
  await db
    .update(classrooms)
    .set({ usageMetric: 0 })
    .where(eq(classrooms.isActive, true));

  // Проставляем актуальные значения
  for (const { classroomId, cnt } of usage) {
    await db
      .update(classrooms)
      .set({ usageMetric: cnt })
      .where(eq(classrooms.id, classroomId));
  }
}