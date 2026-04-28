import { router, adminProcedure } from "../../trpc";
import {
  lessons, lessonClassrooms,
  classrooms, lessonTypes,
  disciplines,
} from "@/db/schema";
import { eq, isNull, asc } from "drizzle-orm";

export const assignClassroomsRouter = router({
  assignClassroomsAuto: adminProcedure
    .mutation(async ({ ctx }) => {
      await ctx.db.delete(lessonClassrooms);

      const allLessons = await ctx.db.select().from(lessons);
      let assigned = 0;

      for (const lesson of allLessons) {
        // Тип занятия
        const [lt] = await ctx.db.select().from(lessonTypes).where(eq(lessonTypes.id, lesson.lessonTypeId!)).limit(1);
        if (!lt) continue;

        let priorityColumn: keyof typeof classrooms;
        switch (lt.name) {
          case "lecture": priorityColumn = "priorityLecture"; break;
          case "workshop": priorityColumn = "priorityWorkshop"; break;
          case "guidedStudy": priorityColumn = "priorityGuidedStudy"; break;
          case "lab": priorityColumn = "priorityLab"; break;
          default: priorityColumn = "priorityLecture";
        }

        // Кафедра дисциплины
        const [disc] = await ctx.db.select({ departmentId: disciplines.departmentId })
          .from(disciplines).where(eq(disciplines.id, lesson.disciplineId!)).limit(1);
        const deptId = disc?.departmentId ?? null;

        // Лучшая аудитория по приоритету (без учёта занятости)
        const candidates = await ctx.db.select()
          .from(classrooms)
          .where(deptId ? eq(classrooms.departmentId, deptId) : undefined)
          .orderBy(asc(classrooms[priorityColumn]))
          .limit(1);

        if (candidates.length > 0) {
          await ctx.db.insert(lessonClassrooms).values({
            lessonId: lesson.id,
            classroomId: candidates[0].id,
          });
          assigned++;
        }
      }

      return { assignedClassrooms: assigned };
    }),
});