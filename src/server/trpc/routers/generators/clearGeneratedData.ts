import { db } from "@/db";
import {
  scheduleDisplay, schedule,
  lessonClassrooms, lessons,
  unitRoots, units,
  studyGroups, students
} from "@/db/schema";

export async function clearGeneratedData() {
  await db.transaction(async (tx) => {
    await tx.delete(scheduleDisplay);
    await tx.delete(schedule);
    await tx.delete(lessonClassrooms);
    await tx.delete(lessons);
    await tx.delete(unitRoots);
    await tx.delete(units);

    // Открепляем студентов от групп и удаляем группы
    await tx.update(students).set({ studyGroupId: null, course: null });
    await tx.delete(studyGroups);
  });
}