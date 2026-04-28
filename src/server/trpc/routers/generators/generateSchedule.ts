import { z } from "zod";
import { router, adminProcedure } from "../../trpc";
import {
  schedule, lessons, lessonClassrooms,
  daysOfWeek, pairs,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export const generateScheduleRouter = router({
  generateSchedule: adminProcedure
    .input(z.object({
      totalWeeks: z.number().int().min(1).default(18),
      cycleLength: z.number().int().min(1).default(2),
    }))
    .mutation(async ({ ctx, input }) => {
      const { totalWeeks, cycleLength } = input;
      const step = Math.ceil(totalWeeks / cycleLength);

      const allLessons = await ctx.db.select().from(lessons);
      if (allLessons.length === 0) throw new Error("Нет занятий");

      const lessonClassroomMap = new Map<number, number[]>();
      const lcRows = await ctx.db.select().from(lessonClassrooms);
      for (const lc of lcRows) {
        if (!lessonClassroomMap.has(lc.lessonId)) lessonClassroomMap.set(lc.lessonId, []);
        lessonClassroomMap.get(lc.lessonId)!.push(lc.classroomId);
      }

      const days = await ctx.db.select().from(daysOfWeek).orderBy(daysOfWeek.id);
      const pairsList = await ctx.db.select().from(pairs).orderBy(pairs.number);
      if (days.length === 0 || pairsList.length === 0) throw new Error("Нет дней недели или пар");

      await ctx.db.delete(schedule);

      for (const lesson of allLessons) {
        if (!lesson.countPerSemester || lesson.countPerSemester <= 0) continue;

        const S = Math.ceil(lesson.countPerSemester / step);
        const base = Math.floor(S / cycleLength);
        const remainder = S % cycleLength;
        const weekLoad = Array(cycleLength).fill(base);
        for (let i = 0; i < remainder; i++) weekLoad[i]++;

        const classroomIds = lessonClassroomMap.get(lesson.id) || [];
        let placed = 0;

        for (let globalWeek = 0; globalWeek < totalWeeks; globalWeek++) {
          const cycleWeek = globalWeek % cycleLength;
          const needed = weekLoad[cycleWeek];
          if (needed <= 0) continue;

          for (let slot = 0; slot < needed; slot++) {
            if (placed >= S) break;

            let placedInSlot = false;
            for (const day of days) {
              for (const pair of pairsList) {
                // Конфликт преподавателя
                const conflict = await ctx.db
                  .select()
                  .from(schedule)
                  .innerJoin(lessons, eq(schedule.lessonId, lessons.id))
                  .where(and(
                    eq(schedule.weekNumber, globalWeek + 1),
                    eq(schedule.dayOfWeekId, day.id),
                    eq(schedule.pairNumberId, pair.id),
                    eq(lessons.teacherId, lesson.teacherId),
                  ))
                  .limit(1);
                if (conflict.length > 0) continue;

                // Аудитория
                let freeClassroomId: number | null = null;
                if (classroomIds.length > 0) {
                  for (const cid of classroomIds) {
                    const occ = await ctx.db
                      .select()
                      .from(schedule)
                      .where(and(
                        eq(schedule.weekNumber, globalWeek + 1),
                        eq(schedule.dayOfWeekId, day.id),
                        eq(schedule.pairNumberId, pair.id),
                        eq(schedule.classroomId, cid),
                      ))
                      .limit(1);
                    if (occ.length === 0) {
                      freeClassroomId = cid;
                      break;
                    }
                  }
                  if (freeClassroomId === null) continue;
                }

                await ctx.db.insert(schedule).values({
                  weekNumber: globalWeek + 1,
                  dayOfWeekId: day.id,
                  pairNumberId: pair.id,
                  lessonId: lesson.id,
                  classroomId: freeClassroomId,
                  classroomFlag: freeClassroomId !== null,
                });
                placed++;
                placedInSlot = true;
                break;
              }
              if (placedInSlot) break;
            }
          }
        }
      }

      return { status: "schedule generated" };
    }),
});