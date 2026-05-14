// src/lib/clearGeneratedData.ts
import { db } from "@/db";
import {
  scheduleDisplay,
  schedule,
  lessonClassrooms,
  lessons,
  unitRoots,
  units,
  studyGroups,
  students,
} from "@/db/schema";
import { isNull, and, eq } from "drizzle-orm";

export async function clearGeneratedData() {
  await db.transaction(async (tx) => {
    // 1. Удаляем активные записи в порядке зависимостей
    await tx.delete(scheduleDisplay).where(
      and(eq(scheduleDisplay.isActive, true), isNull(scheduleDisplay.versionId))
    );
    await tx.delete(schedule).where(
      and(eq(schedule.isActive, true), isNull(schedule.versionId))
    );
    await tx.delete(lessonClassrooms).where(
      and(eq(lessonClassrooms.isActive, true), isNull(lessonClassrooms.versionId))
    );
    await tx.delete(lessons).where(
      and(eq(lessons.isActive, true), isNull(lessons.versionId))
    );
    await tx.delete(unitRoots).where(
      and(eq(unitRoots.isActive, true), isNull(unitRoots.versionId))
    );
    await tx.delete(units).where(
      and(eq(units.isActive, true), isNull(units.versionId))
    );

    // 2. Открепляем студентов от групп
    await tx.update(students).set({ studyGroupId: null, course: null });

    // 3. Удаляем только активные группы
    await tx.delete(studyGroups).where(eq(studyGroups.isActive, true));
  });
}