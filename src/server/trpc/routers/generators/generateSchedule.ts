// src/server/trpc/routers/generations/generateSchedule.ts
import { z } from "zod";
import { router, adminProcedure } from "../../trpc";
import { eq, asc } from "drizzle-orm";
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
      totalWeeks: z.number().int().min(1).default(16),
    }))
    .mutation(async ({ ctx, input }) => {
      // Получаем все активные недели (цикл)
      const weeksList = await ctx.db
        .select({ id: weeks.id })
        .from(weeks)
        .where(eq(weeks.isActive, true))
        .orderBy(asc(weeks.id));
      const cycleLength = weeksList.length;
      if (cycleLength === 0) throw new Error("Нет активных недель в таблице weeks");

      const totalWeeks = input.totalWeeks ?? 16;
      const step = Math.ceil(totalWeeks / cycleLength);

      const allLessons = await ctx.db.select().from(lessons);
      if (allLessons.length === 0) throw new Error("Нет занятий");

      // Загрузка связей юнитов с группами
      const allUnitRoots = await ctx.db.select().from(unitRoots);
      const unitToGroups = new Map<string, Set<number>>();
      for (const ur of allUnitRoots) {
        if (!unitToGroups.has(ur.unitCode)) unitToGroups.set(ur.unitCode, new Set());
        unitToGroups.get(ur.unitCode)!.add(ur.studyGroupId);
      }

      // lessonId -> unitCode
      const lessonUnitMap = new Map<number, string>();
      const allUnits = await ctx.db.select().from(units);
      const unitCodeById = new Map<number, string>();
      for (const u of allUnits) unitCodeById.set(u.id, u.code);
      for (const l of allLessons) {
        lessonUnitMap.set(l.id, unitCodeById.get(l.unitId) || "");
      }

      // Сортировка по количеству групп (больше групп → выше приоритет)
      const sortedLessons = [...allLessons].sort((a, b) => {
        const codeA = lessonUnitMap.get(a.id) || "";
        const codeB = lessonUnitMap.get(b.id) || "";
        const groupsA = unitToGroups.get(codeA)?.size ?? 0;
        const groupsB = unitToGroups.get(codeB)?.size ?? 0;
        return groupsB - groupsA;
      });

      // lessonId -> список classroomId
      const lessonClassroomMap = new Map<number, number[]>();
      const lcRows = await ctx.db.select().from(lessonClassrooms);
      for (const lc of lcRows) {
        if (!lessonClassroomMap.has(lc.lessonId)) lessonClassroomMap.set(lc.lessonId, []);
        lessonClassroomMap.get(lc.lessonId)!.push(lc.classroomId);
      }

      const days = await ctx.db.select().from(daysOfWeek).orderBy(daysOfWeek.id);
      const pairsList = await ctx.db.select().from(pairs).orderBy(pairs.number);
      if (days.length === 0 || pairsList.length === 0) throw new Error("Нет дней недели или пар");

      // Очистка старых расписаний
      await ctx.db.delete(scheduleDisplay);
      await ctx.db.delete(schedule);

      const scheduleRows: (typeof schedule.$inferInsert & { _unitCode?: string })[] = [];

      // Структура занятости слотов: ключ "weekId-dayId-pairId"
      const slotOccupancy = new Map<string, {
        teacherIds: Set<number>;
        classroomIds: Set<number>;
        groupIds: Set<number>;
      }>();

      // Все слоты на основе активных недель
      const allSlots: { weekId: number; day: typeof days[0]; pair: typeof pairsList[0] }[] = [];
      for (const week of weeksList) {
        for (const day of days) {
          for (const pair of pairsList) {
            allSlots.push({ weekId: week.id, day, pair });
          }
        }
      }

      let currentSlotIndex = 0;

      // Основной цикл по отсортированным занятиям
      for (const lesson of sortedLessons) {
        if (!lesson.countPerSemester || lesson.countPerSemester <= 0) continue;

        const S = Math.ceil(lesson.countPerSemester / step);
        const base = Math.floor(S / cycleLength);
        const remainder = S % cycleLength;
        const weekLoad = Array(cycleLength).fill(base);
        for (let i = 0; i < remainder; i++) weekLoad[i]++;

        const classroomIds = lessonClassroomMap.get(lesson.id) || [];
        const lessonUnitCode = lessonUnitMap.get(lesson.id) || "";
        const lessonGroups = unitToGroups.get(lessonUnitCode) ?? new Set<number>();

        if (lesson.teacherId == null || classroomIds.length === 0) continue;
        if (lessonGroups.size === 0) {
          console.warn(`Занятие ${lesson.id} не связано с группами (unitCode=${lessonUnitCode}), пропущено`);
          continue;
        }

        let placed = 0;

        // Для каждой недели цикла
        for (let cycleWeek = 0; cycleWeek < cycleLength; cycleWeek++) {
          const needed = weekLoad[cycleWeek];
          if (needed <= 0) continue;

          const targetWeekId = weeksList[cycleWeek].id; // ID недели из таблицы weeks

          for (let slot = 0; slot < needed; slot++) {
            if (placed >= S) break;
            let placedInSlot = false;

            for (let attempt = 0; attempt < allSlots.length; attempt++) {
              const slotIndex = (currentSlotIndex + attempt) % allSlots.length;
              const { weekId, day, pair } = allSlots[slotIndex];

              // Используем только слоты для целевой недели
              if (weekId !== targetWeekId) continue;

              const slotKey = `${weekId}-${day.id}-${pair.id}`;

              if (!slotOccupancy.has(slotKey)) {
                slotOccupancy.set(slotKey, {
                  teacherIds: new Set(),
                  classroomIds: new Set(),
                  groupIds: new Set(),
                });
              }
              const occupancy = slotOccupancy.get(slotKey)!;

              // Проверка конфликтов
              if (occupancy.teacherIds.has(lesson.teacherId!)) continue;
              if ([...lessonGroups].some(g => occupancy.groupIds.has(g))) continue;

              // Поиск свободной аудитории
              let freeClassroomId: number | null = null;
              for (const cid of classroomIds) {
                if (!occupancy.classroomIds.has(cid)) {
                  freeClassroomId = cid;
                  break;
                }
              }
              if (freeClassroomId === null) continue;

              // Добавляем запись
              scheduleRows.push({
                weekId: weekId,
                dayOfWeekId: day.id,
                pairNumberId: pair.id,
                lessonId: lesson.id,
                classroomId: freeClassroomId,
                classroomFlag: 1,
                mergeFlag: undefined,
                positionFlag: undefined,
                _unitCode: lessonUnitCode,
              });

              occupancy.teacherIds.add(lesson.teacherId!);
              occupancy.classroomIds.add(freeClassroomId);
              for (const g of lessonGroups) occupancy.groupIds.add(g);

              currentSlotIndex = (slotIndex + 1) % allSlots.length;
              placed++;
              placedInSlot = true;
              break;
            }
            if (placedInSlot) break;
          }
        }
      }

      // Вставка schedule
      if (scheduleRows.length > 0) {
        const cleanRows = scheduleRows.map(({ _unitCode, ...rest }) => rest);
        await ctx.db.insert(schedule).values(cleanRows);
      }

      // Заполнение schedule_display
      const insertedSchedule = await ctx.db.select().from(schedule);
      if (insertedSchedule.length > 0) {
        const enriched = await ctx.db
          .select({
            weekId: schedule.weekId,
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
          const text = `[${row.unitCode}] ${typeAbbr}${disc} – ${teacher}, ${room}`;
          return {
            lessonId: row.lessonId,
            weekId: row.weekId,
            dayOfWeekId: row.dayOfWeekId,
            pairNumberId: row.pairNumberId,
            unitCode: row.unitCode,
            displayText: text,
            mergeNumber: 0,
            positionFlag: false,
            classroomFlag: row.classroomId !== null,
            classroomId: row.classroomId, // ✅ сохраняем ID аудитории
          };
        });

        if (displayRows.length > 0) {
          await ctx.db.insert(scheduleDisplay).values(displayRows);
        }
      }

      return {
        status: "schedule generated",
        totalSlots: scheduleRows.length,
        placedLessons: new Set(scheduleRows.map(r => r.lessonId)).size,
      };
    }),
});