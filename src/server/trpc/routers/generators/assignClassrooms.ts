// src/server/trpc/routers/generations/assignClassrooms.ts
import { router, adminProcedure } from "../../trpc";
import {
  lessons, lessonClassrooms,
  classrooms, lessonTypes,
  disciplines, units, unitRoots,
  studyGroups, unitTypes,
} from "@/db/schema";
import { eq, asc, desc, sql, and } from "drizzle-orm";

export const assignClassroomsRouter = router({
  assignClassroomsAuto: adminProcedure
    .mutation(async ({ ctx }) => {
      await ctx.db.delete(lessonClassrooms);

      const allLessons = await ctx.db.select().from(lessons);
      const failed: { lessonId: number; reason: string }[] = [];
      let assigned = 0;

      for (const lesson of allLessons) {
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
          const [ut] = await ctx.db
            .select({ maxSize: unitTypes.maxSize })
            .from(unitTypes)
            .where(eq(unitTypes.id, unit.unitTypeId))
            .limit(1);
          unitSize = ut?.maxSize ?? 0;
        }

        const [disc] = await ctx.db
          .select({ departmentId: disciplines.departmentId })
          .from(disciplines)
          .where(eq(disciplines.id, lesson.disciplineId!))
          .limit(1);
        const deptId = disc?.departmentId ?? null;

        let bestClassroom: typeof classrooms.$inferSelect | null = null;

        if (deptId) {
          const candidates = await ctx.db
            .select()
            .from(classrooms)
            .where(
              and(
                eq(classrooms.departmentId, deptId),
                eq(classrooms.isActive, true),          // ← только активные
                sql`${classrooms.capacity} >= ${unitSize}`
              )
            )
            .orderBy(desc(classrooms[priorityColumn]), asc(classrooms.usageMetric), asc(classrooms.id))
            .limit(1);
          if (candidates.length > 0) bestClassroom = candidates[0];
        }

        if (!bestClassroom) {
          const candidates = await ctx.db
            .select()
            .from(classrooms)
            .where(
              and(
                eq(classrooms.isActive, true),          // ← только активные
                sql`${classrooms.capacity} >= ${unitSize}`
              )
            )
            .orderBy(desc(classrooms[priorityColumn]), asc(classrooms.usageMetric), asc(classrooms.id))
            .limit(1);
          if (candidates.length > 0) bestClassroom = candidates[0];
        }

        if (!bestClassroom) {
          failed.push({ lessonId: lesson.id, reason: `Нет аудитории вместимостью ≥ ${unitSize}` });
          continue;
        }

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