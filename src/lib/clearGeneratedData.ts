/**
 * Полная очистка всех активных динамических данных с сохранением архивных версий.
 *
 * Выполняется в одной транзакции. Удаляет активные записи (без `versionId`) из таблиц:
 * `schedule_display`, `schedule`, `lesson_classrooms`, `lessons`, `unit_roots`, `units`.
 * Затем:
 * - Открепляет студентов от групп (сбрасывает `studyGroupId` и `course`).
 * - Деактивирует все активные учебные группы (`isActive = false`).
 * - Сбрасывает метрику использования (`usageMetric`) у всех активных аудиторий,
 *   так как связи `lesson_classrooms` больше не существует.
 *
 * Архивные записи с ненулевым `versionId` не затрагиваются, что обеспечивает
 * сохранность ранее созданных версий расписания. Группы физически не удаляются,
 * чтобы не нарушать ссылочную целостность архивных записей.
 *
 * Используется перед повторной генерацией (групп, юнитов, занятий, расписания)
 * для приведения базы в исходное состояние без потери исторических данных.
 *
 * @returns Promise<void> – после успешного завершения транзакции.
 *
 * @remarks
 * - Функция не требует прав администратора на уровне самой процедуры,
 *   но должна вызываться только в административных мутациях.
 * - Если в момент вызова есть открытые транзакции или блокировки,
 *   возможна задержка выполнения.
 * - Для ручного вызова из UI используется мутация `generations.resetGeneratedData`,
 *   которая дополнительно выводит уведомление и инвалидирует кэш.
 */
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

    await tx.update(classrooms)
      .set({ usageMetric: 0 })
      .where(eq(classrooms.isActive, true));
  });
}