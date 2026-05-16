import { db } from "@/db";
import {
  scheduleDisplay, schedule, lessonClassrooms, lessons,
  unitRoots, units, studyGroups, students,
  classrooms,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function clearGeneratedData() {
  await db.transaction(async (tx) => {
    await tx.delete(scheduleDisplay)
      .where(and(eq(scheduleDisplay.isActive, true), isNull(scheduleDisplay.versionId)));
    await tx.delete(schedule)
      .where(and(eq(schedule.isActive, true), isNull(schedule.versionId)));
    await tx.delete(lessonClassrooms)
      .where(and(eq(lessonClassrooms.isActive, true), isNull(lessonClassrooms.versionId)));
    await tx.delete(lessons)
      .where(and(eq(lessons.isActive, true), isNull(lessons.versionId)));
    await tx.delete(unitRoots)
      .where(and(eq(unitRoots.isActive, true), isNull(unitRoots.versionId)));
    await tx.delete(units)
      .where(and(eq(units.isActive, true), isNull(units.versionId)));

    await tx.update(students)
      .set({ studyGroupId: null, course: null });

    await tx.update(studyGroups)
      .set({ isActive: false })
      .where(eq(studyGroups.isActive, true));

    // Сброс метрик аудиторий после удаления всех активных связей
    await tx.update(classrooms)
      .set({ usageMetric: 0 })
      .where(eq(classrooms.isActive, true));
  });
}