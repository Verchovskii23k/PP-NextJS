// src/server/trpc/routers/generations/generateSchedule.ts
import { z } from "zod";
import { router, adminProcedure } from "../../trpc";
import { eq, and, sql } from "drizzle-orm";

import {
  schedule, lessons, lessonClassrooms,
  daysOfWeek, pairs, scheduleDisplay,
  disciplines, lessonTypes,
  employeesDepartments, employees,
  units, classrooms, buildings,
  unitRoots, weeks,
} from "@/db/schema";

export const generateScheduleRouter = router({
  generateSchedule: adminProcedure
    .input(z.object({
      totalWeeks: z.number().int().min(1).default(18),
      // cycleLength больше не принимаем – он вычисляется из таблицы weeks
    }))
    .mutation(async ({ ctx, input }) => {
      const { totalWeeks } = input;

      // Вычисляем длину цикла по количеству записей в справочнике "weeks"
      const [cycleCount] = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(weeks);
      const cycleLength = Number(cycleCount?.count) || 2; // fallback на 2, если таблица пуста

      const step = Math.ceil(totalWeeks / cycleLength);

      // 1. Все занятия
      const allLessons = await ctx.db.select().from(lessons);
      if (allLessons.length === 0) throw new Error("Нет занятий");

      // 2. lessonId -> список classroomId
      const lessonClassroomMap = new Map<number, number[]>();
      const lcRows = await ctx.db.select().from(lessonClassrooms);
      for (const lc of lcRows) {
        if (!lessonClassroomMap.has(lc.lessonId)) lessonClassroomMap.set(lc.lessonId, []);
        lessonClassroomMap.get(lc.lessonId)!.push(lc.classroomId);
      }

      // 3. unitRoots: unit_code -> Set<studyGroupId>
      const allUnitRoots = await ctx.db.select().from(unitRoots);
      const unitToGroups = new Map<string, Set<number>>();
      for (const ur of allUnitRoots) {
        if (!unitToGroups.has(ur.unitCode)) unitToGroups.set(ur.unitCode, new Set());
        unitToGroups.get(ur.unitCode)!.add(ur.studyGroupId);
      }

      // 4. lessonId -> unitCode (для быстрых проверок)
      const lessonUnitMap = new Map<number, string>();
      const allUnits = await ctx.db.select().from(units);
      const unitCodeById = new Map<number, string>();
      for (const u of allUnits) unitCodeById.set(u.id, u.code);
      for (const l of allLessons) {
        lessonUnitMap.set(l.id, unitCodeById.get(l.unitId) || "");
      }

      // 5. Дни и пары
      const days = await ctx.db.select().from(daysOfWeek).orderBy(daysOfWeek.id);
      const pairsList = await ctx.db.select().from(pairs).orderBy(pairs.number);
      if (days.length === 0 || pairsList.length === 0) throw new Error("Нет дней недели или пар");

      // 6. Очистка старых расписаний
      await ctx.db.delete(scheduleDisplay);
      await ctx.db.delete(schedule);

      // 7. Массив будущих записей schedule
      const scheduleRows: (typeof schedule.$inferInsert & { _unitCode?: string })[] = [];

      // 8. Основной цикл
      for (const lesson of allLessons) {
        if (!lesson.countPerSemester || lesson.countPerSemester <= 0) continue;

        const S = Math.ceil(lesson.countPerSemester / step);
        const base = Math.floor(S / cycleLength);
        const remainder = S % cycleLength;
        const weekLoad = Array(cycleLength).fill(base);
        for (let i = 0; i < remainder; i++) weekLoad[i]++;

        const classroomIds = lessonClassroomMap.get(lesson.id) || [];
        const lessonUnitCode = lessonUnitMap.get(lesson.id) || "";
        const lessonGroups = unitToGroups.get(lessonUnitCode) ?? new Set<number>();

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
                const weekNum = globalWeek + 1;

                // Проверка конфликтов в уже накопленных scheduleRows
                const conflict = scheduleRows.some(row => {
                  if (row.weekNumber !== weekNum || row.dayOfWeekId !== day.id || row.pairNumberId !== pair.id) return false;

                  const rowLesson = allLessons.find(l => l.id === row.lessonId);
                  if (!rowLesson) return false;

                  if (rowLesson.teacherId === lesson.teacherId) return true;

                  if (row.classroomId && classroomIds.includes(row.classroomId)) return true;

                  const rowUnitCode = row._unitCode || lessonUnitMap.get(rowLesson.id) || "";
                  const rowGroups = unitToGroups.get(rowUnitCode) ?? new Set<number>();
                  for (const g of lessonGroups) {
                    if (rowGroups.has(g)) return true;
                  }
                  return false;
                });

                if (conflict) continue;

                let freeClassroomId: number | null = null;
                if (classroomIds.length > 0) {
                  for (const cid of classroomIds) {
                    const occupied = scheduleRows.some(r =>
                      r.weekNumber === weekNum &&
                      r.dayOfWeekId === day.id &&
                      r.pairNumberId === pair.id &&
                      r.classroomId === cid
                    );
                    if (!occupied) {
                      freeClassroomId = cid;
                      break;
                    }
                  }
                  if (freeClassroomId === null) continue;
                }

                scheduleRows.push({
                  weekNumber: weekNum,
                  dayOfWeekId: day.id,
                  pairNumberId: pair.id,
                  lessonId: lesson.id,
                  classroomId: freeClassroomId,
                  classroomFlag: freeClassroomId !== null ? 1 : 0,
                  mergeFlag: undefined,
                  positionFlag: undefined,
                  _unitCode: lessonUnitCode,
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

      // 9. Вставка schedule пачкой
      if (scheduleRows.length > 0) {
        const cleanRows = scheduleRows.map(({ _unitCode, ...rest }) => rest);
        await ctx.db.insert(schedule).values(cleanRows);
      }

      // 10. Заполнение schedule_display
      const insertedSchedule = await ctx.db.select().from(schedule);
      if (insertedSchedule.length > 0) {
        const enriched = await ctx.db
          .select({
            weekNumber: schedule.weekNumber,
            dayOfWeekId: schedule.dayOfWeekId,
            pairNumberId: schedule.pairNumberId,
            lessonId: schedule.lessonId,
            classroomId: schedule.classroomId,
            disciplineAbbr: disciplines.abbreviation,
            lessonTypeName: lessonTypes.name,
            teacherSurname: employees.surname,
            teacherName: employees.name,
            teacherPatronymic: employees.patronymic,
            buildingNumber: buildings.number,
            roomNumber: classrooms.roomNumber,
            unitCode: units.code,
          })
          .from(schedule)
          .innerJoin(lessons, eq(schedule.lessonId, lessons.id))
          .innerJoin(disciplines, eq(lessons.disciplineId, disciplines.id))
          .innerJoin(lessonTypes, eq(lessons.lessonTypeId, lessonTypes.id))
          .innerJoin(employeesDepartments, eq(lessons.teacherId, employeesDepartments.id))
          .innerJoin(employees, eq(employeesDepartments.employeeId, employees.id))
          .innerJoin(units, eq(lessons.unitId, units.id))
          .leftJoin(classrooms, eq(schedule.classroomId, classrooms.id))
          .leftJoin(buildings, eq(classrooms.buildingId, buildings.id));

        await ctx.db.delete(scheduleDisplay);

        const displayRows = enriched.map(row => {
          const typeMap: Record<string, string> = {
            lecture: 'лек.',
            lab: 'лаб.',
            workshop: 'пр.',
            guidedStudy: 'кср.'
          };
          const typeAbbr = typeMap[row.lessonTypeName] || row.lessonTypeName;
          const disc = row.disciplineAbbr;
          const teacher = `${row.teacherSurname} ${row.teacherName[0]}.${row.teacherPatronymic?.[0] ? row.teacherPatronymic[0] + '.' : ''}`;
          const room = row.buildingNumber ? `${row.buildingNumber}-${row.roomNumber}` : 'б/а';
          const text = `${typeAbbr}${disc} – ${teacher}, ${room}`;
          return {
            lessonId: row.lessonId,
            weekNumber: row.weekNumber,
            dayOfWeekId: row.dayOfWeekId,
            pairNumberId: row.pairNumberId,
            unitCode: row.unitCode,
            displayText: text,
            mergeNumber: 0,
            positionFlag: false,
            classroomFlag: row.classroomId !== null,
          };
        });

        if (displayRows.length > 0) {
          await ctx.db.insert(scheduleDisplay).values(displayRows);
        }
      }

      return { status: "schedule generated" };
    }),
});