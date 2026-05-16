// src/server/trpc/routers/generations/assignClassrooms.ts
import { router, adminProcedure } from "../../trpc";
import {
  lessons,
  lessonClassrooms,
  classrooms,
  disciplines,
  units,
  unitRoots,
  studyGroups,
  unitTypes,
  hourTypeMapping,
} from "@/db/schema";
import { recalculateUsageMetrics } from "@/lib/usageMetrics";
import { eq, and, gte, isNull, or, sql, SQL } from "drizzle-orm";

export const assignClassroomsRouter = router({
  assignClassroomsAuto: adminProcedure.mutation(async ({ ctx }) => {
    // Больше не сбрасываем метрику в начале – пересчитаем в конце

    const allLessons = await ctx.db
      .select()
      .from(lessons)
      .where(and(eq(lessons.isActive, true), isNull(lessons.versionId)));

    const failed: { lessonId: number; reason: string }[] = [];
    let assigned = 0;

    for (const lesson of allLessons) {
      // --- определение unitSize (без изменений) ---
      let unitSize = 0;
      const [unit] = await ctx.db
        .select({ id: units.id, code: units.code, unitTypeId: units.unitTypeId })
        .from(units)
        .where(
          and(
            eq(units.id, lesson.unitId),
            eq(units.isActive, true),
            isNull(units.versionId)
          )
        )
        .limit(1);
      if (!unit) {
        failed.push({ lessonId: lesson.id, reason: "Юнит не найден" });
        continue;
      }

      const [unitType] = await ctx.db
        .select({ name: unitTypes.name, maxSize: unitTypes.maxSize })
        .from(unitTypes)
        .where(eq(unitTypes.id, unit.unitTypeId))
        .limit(1);
      if (!unitType) {
        failed.push({ lessonId: lesson.id, reason: "Тип юнита не найден" });
        continue;
      }

      if (unitType.name === "ПОДГРУППА") {
        unitSize = unitType.maxSize ?? 0;
      } else {
        const roots = await ctx.db
          .select({ studyGroupId: unitRoots.studyGroupId })
          .from(unitRoots)
          .where(
            and(
              eq(unitRoots.unitCode, unit.code),
              eq(unitRoots.isActive, true),
              isNull(unitRoots.versionId)
            )
          );
        if (roots.length > 0) {
          const groupIds = roots.map((r) => r.studyGroupId);
          const groupsData = await ctx.db
            .select({ studentCount: studyGroups.studentCount })
            .from(studyGroups)
            .where(
              and(
                sql`${studyGroups.id} IN ${groupIds}`,
                eq(studyGroups.isActive, true)
              )
            );
          unitSize = groupsData.reduce(
            (sum, g) => sum + (g.studentCount ?? 0),
            0
          );
        } else {
          unitSize = unitType.maxSize ?? 0;
        }
      }

      // --- кафедра дисциплины (без изменений) ---
      const [disc] = await ctx.db
        .select({ departmentId: disciplines.departmentId })
        .from(disciplines)
        .where(eq(disciplines.id, lesson.disciplineId!))
        .limit(1);
      const deptId = disc?.departmentId ?? null;

      // --- приоритетная колонка (без изменений) ---
      const [mapping] = await ctx.db
        .select({ priorityColumn: hourTypeMapping.priorityColumn })
        .from(hourTypeMapping)
        .where(
          and(
            eq(hourTypeMapping.lessonTypeId, lesson.lessonTypeId!),
            eq(hourTypeMapping.isActive, true)
          )
        )
        .limit(1);
      if (!mapping) {
        failed.push({
          lessonId: lesson.id,
          reason: "Нет маппинга типа занятия",
        });
        continue;
      }

      type ClassroomPriorityKey = keyof Pick<
        typeof classrooms,
        "priorityLecture" | "priorityWorkshop" | "priorityGuidedStudy" | "priorityLab"
      >;
      const priorityColumn = mapping.priorityColumn as ClassroomPriorityKey;

      // --- фильтрация кандидатов (без изменений) ---
      const conditions: SQL<unknown>[] = [
        eq(classrooms.isActive, true),
        gte(classrooms.capacity, unitSize),
      ];
      if (deptId !== null) {
        conditions.push(
          or(
            eq(classrooms.departmentId, deptId),
            isNull(classrooms.departmentId)
          ) as SQL<unknown>
        );
      }

      const candidates = await ctx.db
        .select()
        .from(classrooms)
        .where(and(...conditions));

      if (candidates.length === 0) {
        failed.push({
          lessonId: lesson.id,
          reason: `Нет аудитории вместимостью ≥ ${unitSize} (кафедра ${deptId ?? "нет"})`,
        });
        continue;
      }

      // --- сортировка (без изменений) ---
      candidates.sort((a, b) => {
        const prioA = (a[priorityColumn] as number) ?? 99;
        const prioB = (b[priorityColumn] as number) ?? 99;
        if (prioA !== prioB) return prioA - prioB;

        const metricA = a.usageMetric ?? 0;
        const metricB = b.usageMetric ?? 0;
        if (metricA !== metricB) return metricA - metricB;

        return a.id - b.id;
      });

      const best = candidates[0];

      // Проверка и вставка связи (без изменений)
      const [existingLink] = await ctx.db
        .select({ id: lessonClassrooms.id })
        .from(lessonClassrooms)
        .where(
          and(
            eq(lessonClassrooms.lessonId, lesson.id),
            eq(lessonClassrooms.isActive, true),
            isNull(lessonClassrooms.versionId)
          )
        )
        .limit(1);

      if (!existingLink) {
        await ctx.db.insert(lessonClassrooms).values({
          lessonId: lesson.id,
          classroomId: best.id,
          isActive: true,
        });
        assigned++
      }

      // Увеличиваем метрику только для текущего назначения (чтобы сортировка в цикле работала)
      await ctx.db
        .update(classrooms)
        .set({ usageMetric: (best.usageMetric ?? 0) + 1 })
        .where(eq(classrooms.id, best.id));

    }

    // Финальный пересчёт метрики по фактическому состоянию lessonClassrooms
    await recalculateUsageMetrics();

    return {
      assignedClassrooms: assigned,
      failed: failed.length > 0 ? failed : null,
    };
  }),
});