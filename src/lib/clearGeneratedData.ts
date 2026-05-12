import { db } from "@/db";
import {
  scheduleDisplay, schedule,
  lessonClassrooms, lessons,
  unitRoots, units,
  studyGroups, students
} from "@/db/schema";
import { isNull } from "drizzle-orm";

export async function clearGeneratedData() {
  await db.transaction(async (tx) => {
    await tx.delete(scheduleDisplay).where(isNull(scheduleDisplay.versionId));
    await tx.delete(schedule);
    await tx.delete(lessonClassrooms).where(isNull(lessonClassrooms.versionId));
    await tx.delete(lessons).where(isNull(lessons.versionId));
    await tx.delete(unitRoots).where(isNull(unitRoots.versionId));
    await tx.delete(units).where(isNull(units.versionId));

    // Открепляем студентов от групп и удаляем группы (без изменений)
    await tx.update(students).set({ studyGroupId: null, course: null });
    await tx.delete(studyGroups); // группы удаляем все
  });
}