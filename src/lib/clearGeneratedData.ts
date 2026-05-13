// src\lib\clearGeneratedData.ts
import { db } from "@/db";
import {
  scheduleDisplay, schedule,
  lessonClassrooms, lessons,
  unitRoots, units,
  studyGroups, students
} from "@/db/schema";
import { isNull, and, eq } from "drizzle-orm";

export async function clearGeneratedData() {
  await db.transaction(async (tx) => {
    await tx.delete(scheduleDisplay).where(isNull(scheduleDisplay.versionId));
    await tx.delete(schedule);
    await tx.delete(lessonClassrooms).where(and(isNull(lessonClassrooms.versionId), eq(lessonClassrooms.isActive, true)));
    await tx.delete(lessons).where(isNull(lessons.versionId));                    // без isActive
    await tx.delete(unitRoots).where(isNull(unitRoots.versionId));                // без isActive
    await tx.delete(units).where(isNull(units.versionId));                        // без isActive
    await tx.update(studyGroups).set({ isActive: false }).where(eq(studyGroups.isActive, true));
    await tx.update(students).set({ studyGroupId: null, course: null });

    // Открепляем студентов от групп и удаляем группы (без изменений)
    await tx.update(students).set({ studyGroupId: null, course: null });
    await tx.delete(studyGroups); // группы удаляем все
  });
}