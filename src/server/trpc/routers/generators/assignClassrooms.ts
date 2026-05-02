// src/server/trpc/routers/generations/assignClassrooms.ts
import { router, adminProcedure } from "../../trpc";
import {
  lessons, lessonClassrooms,
  classrooms, lessonTypes,
  disciplines, units, unitRoots,
  studyGroups, unitTypes,
} from "@/db/schema";
import { eq, asc, desc, sql } from "drizzle-orm";

export const assignClassroomsRouter = router({
  assignClassroomsAuto: adminProcedure
    .mutation(async ({ ctx }) => {
      await ctx.db.delete(lessonClassrooms);

      const allLessons = await ctx.db.select().from(lessons);
      const failed: { lessonId: number; reason: string }[] = [];
      let assigned = 0;

      for (const lesson of allLessons) {
        // 1. Тип занятия → приоритетный столбец
        const [lt] = await ctx.db
          .select()
          .from(lessonTypes)
          .where(eq(lessonTypes.id, lesson.lessonTypeId!))
          .limit(1);
        if (!lt) {
          failed.push({ lessonId: lesson.id, reason: "Неизвестный тип занятия" });
          continue;
        }

        let priorityColumn: keyof typeof classrooms;
        switch (lt.name) {
          case "lecture": priorityColumn = "priorityLecture"; break;
          case "workshop": priorityColumn = "priorityWorkshop"; break;
          case "guidedStudy": priorityColumn = "priorityGuidedStudy"; break;
          case "lab": priorityColumn = "priorityLab"; break;
          default:
            failed.push({ lessonId: lesson.id, reason: `Неизвестный тип занятия: ${lt.name}` });
            continue;
        }

        // 2. Размер юнита (сумма студентов всех связанных групп)
        let unitSize = 0;
        const [unit] = await ctx.db
          .select({ id: units.id, code: units.code, unitTypeId: units.unitTypeId })
          .from(units)
          .where(eq(units.id, lesson.unitId))
          .limit(1);
        if (!unit) {
          failed.push({ lessonId: lesson.id, reason: "Юнит не найден" });
          continue;
        }

        // Собираем группы через unitRoots
        const roots = await ctx.db
          .select({ studyGroupId: unitRoots.studyGroupId })
          .from(unitRoots)
          .where(eq(unitRoots.unitCode, unit.code));
        if (roots.length > 0) {
          const groupIds = roots.map(r => r.studyGroupId);
          const groupsData = await ctx.db
            .select({ studentCount: studyGroups.studentCount })
            .from(studyGroups)
            .where(sql`${studyGroups.id} IN ${groupIds}`);
          unitSize = groupsData.reduce((sum, g) => sum + (g.studentCount ?? 0), 0);
        } else {
          // Если связей нет (чего быть не должно), берём maxSize типа юнита
          const [ut] = await ctx.db
            .select({ maxSize: unitTypes.maxSize })
            .from(unitTypes)
            .where(eq(unitTypes.id, unit.unitTypeId))
            .limit(1);
          unitSize = ut?.maxSize ?? 0;
        }

        // 3. Кафедра дисциплины
        const [disc] = await ctx.db
          .select({ departmentId: disciplines.departmentId })
          .from(disciplines)
          .where(eq(disciplines.id, lesson.disciplineId!))
          .limit(1);
        const deptId = disc?.departmentId ?? null;

        // 4. Поиск подходящей аудитории
        let bestClassroom: typeof classrooms.$inferSelect | null = null;

        // Сначала пытаемся найти среди аудиторий кафедры
        if (deptId) {
          const candidates = await ctx.db
            .select()
            .from(classrooms)
            .where(sql`${classrooms.departmentId} = ${deptId} AND ${classrooms.capacity} >= ${unitSize}`)
            .orderBy(desc(classrooms[priorityColumn]), asc(classrooms.usageMetric), asc(classrooms.id))
            .limit(1);
          if (candidates.length > 0) bestClassroom = candidates[0];
        }

        // Если не нашли, ищем среди любых аудиторий (включая общие)
        if (!bestClassroom) {
          const candidates = await ctx.db
            .select()
            .from(classrooms)
            .where(sql`${classrooms.capacity} >= ${unitSize}`)
            .orderBy(desc(classrooms[priorityColumn]), asc(classrooms.usageMetric), asc(classrooms.id))
            .limit(1);
          if (candidates.length > 0) bestClassroom = candidates[0];
        }

        if (!bestClassroom) {
          failed.push({ lessonId: lesson.id, reason: `Нет аудитории вместимостью ≥ ${unitSize}` });
          continue;
        }

        // 5. Назначаем и увеличиваем метрику
        await ctx.db.insert(lessonClassrooms).values({
          lessonId: lesson.id,
          classroomId: bestClassroom.id,
        });
        await ctx.db
          .update(classrooms)
          .set({ usageMetric: (bestClassroom.usageMetric ?? 0) + 1 })
          .where(eq(classrooms.id, bestClassroom.id));
        assigned++;
      }

      return {
        assignedClassrooms: assigned,
        failed: failed.length > 0 ? failed : null,
      };
    }),
});