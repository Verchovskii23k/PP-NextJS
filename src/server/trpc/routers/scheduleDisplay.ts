// src/server/trpc/routers/scheduleDisplay.ts
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import {
  scheduleDisplay, daysOfWeek, pairs, unitRoots, studyGroups, unitTypes,
  employeesDepartments, classrooms, buildings, weeks, lessonTypes, disciplines
} from "@/db/schema";
import { lessons, lessonClassrooms, schedule, employees, units } from "@/db/schema";
import { eq, inArray, asc, and, gte, sql, or, not } from "drizzle-orm";

export const scheduleDisplayRouter = router({
  // ==================== ЗАПРОСЫ НА ПОЛУЧЕНИЕ ====================
  getForWeekPair: adminProcedure
    .input(z.object({ weekBase: z.number().int().min(1) }))
    .query(async ({ ctx, input }) => {
      const { weekBase } = input;
      const weekEven = weekBase + 1;

      const rows = await ctx.db
        .select()
        .from(scheduleDisplay)
        .where(and(
          inArray(scheduleDisplay.weekNumber, [weekBase, weekEven]),
          gte(scheduleDisplay.weekNumber, 1) // исключаем буфер
        ))
        .orderBy(
          asc(scheduleDisplay.weekNumber),
          asc(scheduleDisplay.dayOfWeekId),
          asc(scheduleDisplay.pairNumberId),
          asc(scheduleDisplay.unitCode)
        );

      const days = await ctx.db.select().from(daysOfWeek).orderBy(asc(daysOfWeek.id));
      const pairsList = await ctx.db.select().from(pairs).orderBy(asc(pairs.number));

      return { rows, days, pairs: pairsList };
    }),

  getByGroup: adminProcedure
    .input(z.object({ studyGroupCode: z.string().min(1), weekBase: z.number().int().min(1) }))
    .query(async ({ ctx, input }) => {
      const { studyGroupCode, weekBase } = input;
      const weekEven = weekBase + 1;

      const unitLinks = await ctx.db
        .select({ unitCode: unitRoots.unitCode })
        .from(unitRoots)
        .innerJoin(studyGroups, eq(unitRoots.studyGroupId, studyGroups.id))
        .where(eq(studyGroups.code, studyGroupCode));

      if (unitLinks.length === 0) return { rows: [], days: [], pairs: [] };

      const unitCodes = [...new Set(unitLinks.map(u => u.unitCode))];

      const rows = await ctx.db
        .select()
        .from(scheduleDisplay)
        .where(and(
          inArray(scheduleDisplay.weekNumber, [weekBase, weekEven]),
          inArray(scheduleDisplay.unitCode, unitCodes),
          gte(scheduleDisplay.weekNumber, 1)
        ))
        .orderBy(
          asc(scheduleDisplay.weekNumber),
          asc(scheduleDisplay.dayOfWeekId),
          asc(scheduleDisplay.pairNumberId),
          asc(scheduleDisplay.unitCode)
        );

      const days = await ctx.db.select().from(daysOfWeek).orderBy(asc(daysOfWeek.id));
      const pairsList = await ctx.db.select().from(pairs).orderBy(asc(pairs.number));

      return { rows, days, pairs: pairsList };
    }),

  getByStudyGroups: adminProcedure
    .input(z.object({ weekBase: z.number().int().min(1) }))
    .query(async ({ ctx, input }) => {
      const { weekBase } = input;
      const weekEven = weekBase + 1;

      const roots = await ctx.db
        .select({
          studyGroupCode: studyGroups.code,
          unitCode: unitRoots.unitCode,
        })
        .from(unitRoots)
        .innerJoin(studyGroups, eq(unitRoots.studyGroupId, studyGroups.id))
        .innerJoin(scheduleDisplay, eq(unitRoots.unitCode, scheduleDisplay.unitCode))
        .where(and(
          inArray(scheduleDisplay.weekNumber, [weekBase, weekEven]),
          gte(scheduleDisplay.weekNumber, 1)
        ));

      const groupUnitMap = new Map<string, Set<string>>();
      for (const { studyGroupCode, unitCode } of roots) {
        if (!groupUnitMap.has(studyGroupCode)) groupUnitMap.set(studyGroupCode, new Set());
        groupUnitMap.get(studyGroupCode)!.add(unitCode);
      }

      const allRows: (typeof scheduleDisplay.$inferSelect & { studyGroupCode: string })[] = [];
      for (const [groupCode, unitCodes] of groupUnitMap.entries()) {
        const unitList = [...unitCodes];
        const groupRows = await ctx.db
          .select({
            id: scheduleDisplay.id,
            lessonId: scheduleDisplay.lessonId,
            weekNumber: scheduleDisplay.weekNumber,
            dayOfWeekId: scheduleDisplay.dayOfWeekId,
            pairNumberId: scheduleDisplay.pairNumberId,
            unitCode: scheduleDisplay.unitCode,
            displayText: scheduleDisplay.displayText,
            mergeNumber: scheduleDisplay.mergeNumber,
            positionFlag: scheduleDisplay.positionFlag,
            classroomFlag: scheduleDisplay.classroomFlag,
          })
          .from(scheduleDisplay)
          .where(and(
            inArray(scheduleDisplay.weekNumber, [weekBase, weekEven]),
            inArray(scheduleDisplay.unitCode, unitList),
            gte(scheduleDisplay.weekNumber, 1)
          ));

        for (const row of groupRows) {
          allRows.push({ ...row, studyGroupCode: groupCode });
        }
      }

      allRows.sort((a, b) =>
        a.weekNumber - b.weekNumber ||
        a.dayOfWeekId - b.dayOfWeekId ||
        a.pairNumberId - b.pairNumberId ||
        a.studyGroupCode.localeCompare(b.studyGroupCode)
      );

      const days = await ctx.db.select().from(daysOfWeek).orderBy(asc(daysOfWeek.id));
      const pairsList = await ctx.db.select().from(pairs).orderBy(asc(pairs.number));

      return { rows: allRows, days, pairs: pairsList };
    }),

  // Буфер
  getBuffer: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(scheduleDisplay)
      .where(eq(scheduleDisplay.weekNumber, 0))
      .orderBy(asc(scheduleDisplay.id));
  }),

  // Перенос в буфер (теперь обнуляем и день, и пару)
  moveToBuffer: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(scheduleDisplay)
        .set({ weekNumber: 0, dayOfWeekId: 0, pairNumberId: 0 })
        .where(eq(scheduleDisplay.id, input.id));
      return { success: true };
    }),

  moveFromBuffer: adminProcedure
    .input(z.object({
      id: z.number(),
      targetWeek: z.number().int().min(1),
      targetDayId: z.number().int(),
      targetPairId: z.number().int(),
      targetUnitCode: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const record = await ctx.db
        .select()
        .from(scheduleDisplay)
        .where(eq(scheduleDisplay.id, input.id))
        .limit(1);
      if (!record.length || record[0].weekNumber !== 0) {
        throw new Error('Запись не в буфере');
      }

      const existing = await ctx.db
        .select()
        .from(scheduleDisplay)
        .where(and(
          eq(scheduleDisplay.weekNumber, input.targetWeek),
          eq(scheduleDisplay.dayOfWeekId, input.targetDayId),
          eq(scheduleDisplay.pairNumberId, input.targetPairId),
          eq(scheduleDisplay.unitCode, input.targetUnitCode),
          gte(scheduleDisplay.weekNumber, 1)
        ));
      if (existing.length > 0) throw new Error('Слот занят');

      await ctx.db
        .update(scheduleDisplay)
        .set({
          weekNumber: input.targetWeek,
          dayOfWeekId: input.targetDayId,
          pairNumberId: input.targetPairId,
          unitCode: input.targetUnitCode,
        })
        .where(eq(scheduleDisplay.id, input.id));

      return { success: true };
    }),

  // ==================== ПРОВЕРКА СЛОТОВ ====================
  checkSlots: adminProcedure
    .input(z.object({
      movingId: z.number(),
      slots: z.array(z.object({
        week: z.number().int(),
        dayId: z.number().int(),
        pairId: z.number().int(),
        unitCode: z.string(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const moving = await ctx.db.select().from(scheduleDisplay).where(eq(scheduleDisplay.id, input.movingId)).limit(1);
      if (!moving.length) throw new Error('Занятие не найдено');
      const m = moving[0];

      const isBuffer = m.weekNumber === 0;

      const movingUnitGroups = await ctx.db
        .select({ studyGroupId: unitRoots.studyGroupId })
        .from(unitRoots)
        .where(eq(unitRoots.unitCode, m.unitCode));
      const movingGroupIds = new Set(movingUnitGroups.map(r => r.studyGroupId));

      if (movingGroupIds.size === 0) {
        const errMsg = `Юнит ${m.unitCode} не привязан ни к одной учебной группе.`;
        const results: Record<string, { status: string; diagnostic?: string }> = {};
        for (const slot of input.slots) {
          const key = `week-${slot.week}-${slot.dayId}-${slot.pairId}-${slot.unitCode}`;
          results[key] = { status: 'conflict', diagnostic: errMsg };
        }
        return results;
      }

      const [mTeacher, mClassroom] = await Promise.all([
        ctx.db.select({ teacherId: lessons.teacherId })
          .from(lessons)
          .where(eq(lessons.id, m.lessonId))
          .limit(1),
        ctx.db.select({ classroomId: lessonClassrooms.classroomId })
          .from(lessonClassrooms)
          .where(eq(lessonClassrooms.lessonId, m.lessonId))
          .limit(1),
      ]);
      const mTeacherId = mTeacher[0]?.teacherId ?? null;
      const mClassroomId = mClassroom[0]?.classroomId ?? null;

      const oldSlot = isBuffer ? null : {
        week: m.weekNumber,
        dayId: m.dayOfWeekId,
        pairId: m.pairNumberId,
        unitCode: m.unitCode,
      };

      const results: Record<string, { status: string; swapId?: number }> = {};

      for (const slot of input.slots) {
        const key = `week-${slot.week}-${slot.dayId}-${slot.pairId}-${slot.unitCode}`;

        const allInSlot = await ctx.db
          .select()
          .from(scheduleDisplay)
          .where(and(
            eq(scheduleDisplay.weekNumber, slot.week),
            eq(scheduleDisplay.dayOfWeekId, slot.dayId),
            eq(scheduleDisplay.pairNumberId, slot.pairId),
          ));
        const others = allInSlot.filter(e => e.id !== input.movingId);

        if (others.length === 0) {
          results[key] = { status: 'free' };
          continue;
        }

        let directConflict = false;
        for (const other of others) {
          const otherUnitGroups = await ctx.db
            .select({ studyGroupId: unitRoots.studyGroupId })
            .from(unitRoots)
            .where(eq(unitRoots.unitCode, other.unitCode));
          const otherGroupIds = new Set(otherUnitGroups.map(r => r.studyGroupId));

          const [otherTeacher, otherClassroom] = await Promise.all([
            ctx.db.select({ teacherId: lessons.teacherId }).from(lessons).where(eq(lessons.id, other.lessonId)).limit(1),
            ctx.db.select({ classroomId: lessonClassrooms.classroomId }).from(lessonClassrooms).where(eq(lessonClassrooms.lessonId, other.lessonId)).limit(1),
          ]);
          const oTeacherId = otherTeacher[0]?.teacherId ?? null;
          const oClassroomId = otherClassroom[0]?.classroomId ?? null;

          if (
            ([...movingGroupIds].some(g => otherGroupIds.has(g))) ||
            (mTeacherId && oTeacherId && mTeacherId === oTeacherId) ||
            (mClassroomId && oClassroomId && mClassroomId === oClassroomId)
          ) {
            directConflict = true;
            break;
          }
        }

        if (directConflict) {
          results[key] = { status: 'conflict' };
          continue;
        }

        // Буфер – свободен
        if (isBuffer) {
          results[key] = { status: 'free' };
          continue;
        }

        // Попытка swap (ровно одно другое занятие)
        if (others.length === 1) {
          const other = others[0];

          const otherUnitGroups = await ctx.db
            .select({ studyGroupId: unitRoots.studyGroupId })
            .from(unitRoots)
            .where(eq(unitRoots.unitCode, other.unitCode));
          const otherGroupIds = new Set(otherUnitGroups.map(r => r.studyGroupId));
          const [oTeacher] = await ctx.db.select({ teacherId: lessons.teacherId }).from(lessons).where(eq(lessons.id, other.lessonId)).limit(1);
          const [oClassroom] = await ctx.db.select({ classroomId: lessonClassrooms.classroomId }).from(lessonClassrooms).where(eq(lessonClassrooms.lessonId, other.lessonId)).limit(1);
          const oTeacherId = oTeacher?.teacherId ?? null;
          const oClassroomId = oClassroom?.classroomId ?? null;

          const oldSlotAll = await ctx.db
            .select()
            .from(scheduleDisplay)
            .where(and(
              eq(scheduleDisplay.weekNumber, oldSlot!.week),
              eq(scheduleDisplay.dayOfWeekId, oldSlot!.dayId),
              eq(scheduleDisplay.pairNumberId, oldSlot!.pairId),
            ));
          const oldOthers = oldSlotAll.filter(e => e.id !== input.movingId);

          let reverseConflict = false;
          for (const oldOther of oldOthers) {
            const oldUnitGroups = await ctx.db
              .select({ studyGroupId: unitRoots.studyGroupId })
              .from(unitRoots)
              .where(eq(unitRoots.unitCode, oldOther.unitCode));
            const oldGroupIds = new Set(oldUnitGroups.map(r => r.studyGroupId));
            const [oldTeacher, oldClassroom] = await Promise.all([
              ctx.db.select({ teacherId: lessons.teacherId }).from(lessons).where(eq(lessons.id, oldOther.lessonId)).limit(1),
              ctx.db.select({ classroomId: lessonClassrooms.classroomId }).from(lessonClassrooms).where(eq(lessonClassrooms.lessonId, oldOther.lessonId)).limit(1),
            ]);
            const oldTeacherId = oldTeacher[0]?.teacherId ?? null;
            const oldClassroomId = oldClassroom[0]?.classroomId ?? null;

            if (
              ([...otherGroupIds].some(g => oldGroupIds.has(g))) ||
              (oTeacherId && oldTeacherId && oTeacherId === oldTeacherId) ||
              (oClassroomId && oldClassroomId && oClassroomId === oldClassroomId)
            ) {
              reverseConflict = true;
              break;
            }
          }

          if (!reverseConflict) {
            results[key] = { status: 'swap', swapId: other.id };
          } else {
            results[key] = { status: 'conflict' };
          }
        } else {
          results[key] = { status: 'conflict' };
        }
      }

      return results;
    }),

  // ==================== ПЕРЕМЕЩЕНИЯ ====================
  move: adminProcedure
    .input(z.object({
      id: z.number(),
      targetWeek: z.number().int(),
      targetDayId: z.number().int(),
      targetPairId: z.number().int(),
      targetUnitCode: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(scheduleDisplay)
        .where(and(
          eq(scheduleDisplay.weekNumber, input.targetWeek),
          eq(scheduleDisplay.dayOfWeekId, input.targetDayId),
          eq(scheduleDisplay.pairNumberId, input.targetPairId),
          eq(scheduleDisplay.unitCode, input.targetUnitCode),
        ));

      if (existing.length > 0) throw new Error('Слот занят');

      await ctx.db
        .update(scheduleDisplay)
        .set({
          weekNumber: input.targetWeek,
          dayOfWeekId: input.targetDayId,
          pairNumberId: input.targetPairId,
          unitCode: input.targetUnitCode,
        })
        .where(eq(scheduleDisplay.id, input.id));

      return { success: true };
    }),

  swap: adminProcedure
    .input(z.object({ id1: z.number(), id2: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [rec1, rec2] = await Promise.all([
        ctx.db.select().from(scheduleDisplay).where(eq(scheduleDisplay.id, input.id1)).limit(1),
        ctx.db.select().from(scheduleDisplay).where(eq(scheduleDisplay.id, input.id2)).limit(1),
      ]);
      if (!rec1.length || !rec2.length) throw new Error('Занятие не найдено');

      const slot1 = { weekNumber: rec1[0].weekNumber, dayOfWeekId: rec1[0].dayOfWeekId, pairNumberId: rec1[0].pairNumberId, unitCode: rec1[0].unitCode };
      const slot2 = { weekNumber: rec2[0].weekNumber, dayOfWeekId: rec2[0].dayOfWeekId, pairNumberId: rec2[0].pairNumberId, unitCode: rec2[0].unitCode };

      await Promise.all([
        ctx.db.update(scheduleDisplay).set(slot2).where(eq(scheduleDisplay.id, input.id1)),
        ctx.db.update(scheduleDisplay).set(slot1).where(eq(scheduleDisplay.id, input.id2)),
      ]);

      return { success: true };
    }),

  updateFlags: adminProcedure
    .input(z.object({
      id: z.number(),
      mergeNumber: z.number().int().optional(),
      positionFlag: z.boolean().optional(),
      classroomFlag: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.db.update(scheduleDisplay).set(data).where(eq(scheduleDisplay.id, id));
      return { success: true };
    }),

  // ==================== ПЕРЕГЕНЕРАЦИЯ ====================
  // ==================== ПЕРЕГЕНЕРАЦИЯ (новая реализация) ====================
// ==================== ПЕРЕГЕНЕРАЦИЯ (исправленная версия) ====================
// ==================== ПЕРЕГЕНЕРАЦИЯ (исправленная) ====================
regenerateSchedule: adminProcedure
  .mutation(async ({ ctx }) => {
    // ─── 0. Вспомогательные функции ─────────────────────────────────────
    const slotKey = (w: number, d: number, p: number) => `${w}-${d}-${p}`;
    const occBySlot = new Map<string, {
      teacherIds: Set<number>;
      classroomIds: Set<number>;
      groupIds: Set<number>;
    }>();

    // ─── 1. Сбор текущих данных ─────────────────────────────────────────
    const allDisplay = await ctx.db.select().from(scheduleDisplay);
    const buffer = allDisplay.filter(r => r.weekNumber === 0);
    const pinned = allDisplay.filter(r => r.positionFlag && r.weekNumber > 0);

    // Карта слияний (lessonId -> mergeNumber)
    const mergeMap = new Map<number, number>();
    for (const rec of allDisplay) {
      if (rec.lessonId && rec.mergeNumber != null && rec.mergeNumber > 0) {
        mergeMap.set(rec.lessonId, rec.mergeNumber);
      }
    }

    // Сохраняем закреплённые schedule-записи (без id)
    type ScheduleInsert = Omit<typeof schedule.$inferInsert, 'id'>;
    const pinnedSchedule: ScheduleInsert[] = [];
    if (pinned.length > 0) {
      const conditions = pinned.map(p =>
        and(
          eq(schedule.lessonId, p.lessonId!),
          eq(schedule.weekNumber, p.weekNumber),
          eq(schedule.dayOfWeekId, p.dayOfWeekId),
          eq(schedule.pairNumberId, p.pairNumberId)
        )
      );
      const existingPinned = await ctx.db.select().from(schedule).where(or(...conditions));
      for (const ps of existingPinned) {
        const { id, ...rest } = ps;
        pinnedSchedule.push(rest);
      }
    }

    // ─── 2. Очистка таблиц (кроме буфера) ───────────────────────────────
    // Удаляем все display, кроме буфера (weekNumber = 0)
    await ctx.db.delete(scheduleDisplay)
      .where(not(eq(scheduleDisplay.weekNumber, 0)));
    // Удаляем все schedule
    await ctx.db.delete(schedule);

    // Восстанавливаем закреплённые schedule
    if (pinnedSchedule.length > 0) {
      await ctx.db.insert(schedule).values(pinnedSchedule);
    }

    // ─── 3. Базовая занятость от закреплённых ───────────────────────────
    const allUnits = await ctx.db.select().from(units);
    // Две карты для быстрого доступа: по id и по коду
    const unitById = new Map<number, typeof allUnits[0]>();
    const unitByCode = new Map<string, typeof allUnits[0]>();
    for (const u of allUnits) {
      unitById.set(u.id, u);
      unitByCode.set(u.code, u);
    }
        // === Загружаем типы юнитов для приоритета ===
    const allUnitTypes = await ctx.db.select().from(unitTypes);
    const unitTypeNameById = new Map<number, string>();
    for (const ut of allUnitTypes) {
      unitTypeNameById.set(ut.id, ut.name);
    }
    // Порядок: ПОТОК (0), ГРУППА (1), ПОДГРУППА (2)
    const typeOrder = new Map<string, number>([
      ['ПОТОК', 0],
      ['ГРУППА', 1],
      ['ПОДГРУППА', 2],
    ]);
    const getTypePriority = (unitId: number) => {
      const unit = unitById.get(unitId);
      if (!unit) return 3; // низший приоритет
      const name = unitTypeNameById.get(unit.unitTypeId) ?? '';
      return typeOrder.get(name) ?? 3;
    };

    const unitRootsAll = await ctx.db.select().from(unitRoots);
    const groupsByUnit = new Map<string, Set<number>>();
    for (const ur of unitRootsAll) {
      if (!groupsByUnit.has(ur.unitCode)) groupsByUnit.set(ur.unitCode, new Set());
      groupsByUnit.get(ur.unitCode)!.add(ur.studyGroupId);
    }

    const allLessons = await ctx.db.select().from(lessons);
    const classroomByLesson = new Map<number, number[]>();
    const lcRows = await ctx.db.select().from(lessonClassrooms);
    for (const lc of lcRows) {
      if (!classroomByLesson.has(lc.lessonId)) classroomByLesson.set(lc.lessonId, []);
      classroomByLesson.get(lc.lessonId)!.push(lc.classroomId);
    }

    // Заполняем начальную занятость от закреплённых записей
    for (const ps of pinnedSchedule) {
      const key = slotKey(ps.weekNumber, ps.dayOfWeekId, ps.pairNumberId);
      if (!occBySlot.has(key)) occBySlot.set(key, { teacherIds: new Set(), classroomIds: new Set(), groupIds: new Set() });
      const occ = occBySlot.get(key)!;
      const lesson = allLessons.find(l => l.id === ps.lessonId);
      if (lesson) {
        const unit = lesson.unitId ? unitById.get(lesson.unitId) : undefined;
        if (unit) {
          const grps = groupsByUnit.get(unit.code) ?? new Set();
          grps.forEach(g => occ.groupIds.add(g));
        }
        if (lesson.teacherId) occ.teacherIds.add(lesson.teacherId);
      }
      if (ps.classroomId) occ.classroomIds.add(ps.classroomId);
    }

    // ─── 4. Подготовка к размещению ─────────────────────────────────────
    const placedLessons = new Set(pinned.map(p => p.lessonId));
    const bufferLessons = new Set(buffer.map(b => b.lessonId));
    const lessonsToPlace = allLessons.filter(l => !placedLessons.has(l.id) && !bufferLessons.has(l.id));

    const days = await ctx.db.select().from(daysOfWeek).orderBy(daysOfWeek.id);
    const pairsList = await ctx.db.select().from(pairs).orderBy(pairs.number);
    const weeksList = await ctx.db.select().from(weeks).orderBy(weeks.id);

    const cycleLength = weeksList.length;
    const totalWeeks = 18;
    const step = Math.ceil(totalWeeks / cycleLength);

    const cycleSlots: { weekNum: number; day: typeof days[0]; pair: typeof pairsList[0] }[] = [];
    for (const w of weeksList) {
      for (const day of days) {
        for (const pair of pairsList) {
          cycleSlots.push({ weekNum: w.id, day, pair });
        }
      }
    }
    let currentSlotIndex = 0;

    // ─── 5. Этап слияний ────────────────────────────────────────────────
    const mergeGroups = new Map<number, typeof allLessons[0][]>();
    const standalone: typeof allLessons[0][] = [];
    for (const l of lessonsToPlace) {
      const mn = mergeMap.get(l.id);
      if (mn && mn > 0) {
        if (!mergeGroups.has(mn)) mergeGroups.set(mn, []);
        mergeGroups.get(mn)!.push(l);
      } else {
        standalone.push(l);
      }
    }
    
    

    const scheduleInserts: ScheduleInsert[] = [];
    type ScheduleDisplayInsert = Omit<typeof scheduleDisplay.$inferInsert, 'id'>;
    const bufferInserts: ScheduleDisplayInsert[] = [];

    const tryPlaceMerge = (lessons: typeof allLessons[0][]): boolean => {
      const mergeNum = mergeMap.get(lessons[0].id)!;
      const data = lessons.map(l => {
        const unit = l.unitId ? unitById.get(l.unitId) : undefined;
        const unitCode = unit?.code ?? '';
        const groups = unitCode ? groupsByUnit.get(unitCode) ?? new Set<number>() : new Set<number>();
        const cids = classroomByLesson.get(l.id) || [];
        return { lesson: l, groups, cids, unitCode };
      });

      const teacherSet = new Set<number>();
      for (const d of data) {
        if (d.lesson.teacherId) {
          if (teacherSet.has(d.lesson.teacherId)) return false;
          teacherSet.add(d.lesson.teacherId);
        }
      }
      const alGroups = new Set<number>();
      data.forEach(d => d.groups.forEach(g => alGroups.add(g)));

      for (let attempt = 0; attempt < cycleSlots.length; attempt++) {
        const idx = (currentSlotIndex + attempt) % cycleSlots.length;
        const { weekNum, day, pair } = cycleSlots[idx];
        const ext = occBySlot.get(slotKey(weekNum, day.id, pair.id));

        if (ext && [...alGroups].some(g => ext.groupIds.has(g))) continue;

        const localTeachers = new Set<number>();
        const localRooms = new Set<number>();
        const chosenRooms: number[] = [];
        let ok = true;

        for (const d of data) {
          if (d.lesson.teacherId) {
            if ((ext?.teacherIds.has(d.lesson.teacherId)) || localTeachers.has(d.lesson.teacherId)) {
              ok = false; break;
            }
            localTeachers.add(d.lesson.teacherId);
          }
          let freeRoom: number | null = null;
          for (const rid of d.cids) {
            if (!ext?.classroomIds.has(rid) && !localRooms.has(rid)) {
              freeRoom = rid; break;
            }
          }
          if (freeRoom === null) { ok = false; break; }
          chosenRooms.push(freeRoom);
          localRooms.add(freeRoom);
        }

        if (ok) {
          const realOcc = occBySlot.get(slotKey(weekNum, day.id, pair.id)) || {
            teacherIds: new Set(), classroomIds: new Set(), groupIds: new Set()
          };
          if (!occBySlot.has(slotKey(weekNum, day.id, pair.id))) {
            occBySlot.set(slotKey(weekNum, day.id, pair.id), realOcc);
          }
          data.forEach((d, i) => {
            scheduleInserts.push({
              weekNumber: weekNum,
              dayOfWeekId: day.id,
              pairNumberId: pair.id,
              lessonId: d.lesson.id,
              classroomId: chosenRooms[i],
              mergeFlag: mergeNum,
            });
            realOcc.teacherIds.add(d.lesson.teacherId!);
            realOcc.classroomIds.add(chosenRooms[i]);
          });
          alGroups.forEach(g => realOcc.groupIds.add(g));
          currentSlotIndex = (idx + 1) % cycleSlots.length;
          return true;
        }
      }
      return false;
    };

    const sortedMerges = [...mergeGroups.entries()].sort((a, b) => b[1].length - a[1].length);
    let unplacedMergeCount = 0;
    for (const [_, lessons] of sortedMerges) {
      if (!tryPlaceMerge(lessons)) {
        for (const l of lessons) {
          const unit = l.unitId ? unitById.get(l.unitId) : undefined;
          const unitCode = unit?.code ?? '';
          // Получаем данные для отображения
          const disc = (await ctx.db.select({ abbr: disciplines.abbreviation })
            .from(disciplines).where(eq(disciplines.id, l.disciplineId)).limit(1))[0]?.abbr ?? '';
          const lt = (await ctx.db.select({ name: lessonTypes.name })
            .from(lessonTypes).where(eq(lessonTypes.id, l.lessonTypeId)).limit(1))[0]?.name ?? '';
          const teacher = l.teacherId ? (await ctx.db.select({ s: employees.surname, n: employees.name, p: employees.patronymic })
            .from(employees).innerJoin(employeesDepartments, eq(employeesDepartments.employeeId, employees.id))
            .where(eq(employeesDepartments.id, l.teacherId)).limit(1))[0] : null;
          const teacherStr = teacher ? `${teacher.s} ${teacher.n[0]}.${teacher.p?.[0] ?? ''}` : '';
          const types: Record<string, string> = { lecture: 'лек.', lab: 'лаб.', workshop: 'пр.', guidedStudy: 'кср.' };
          const ta = types[lt] || lt;
          const text = `[${unitCode}] ${ta}${disc} – ${teacherStr}, б/а`;
          bufferInserts.push({
            lessonId: l.id,
            weekNumber: 0,
            dayOfWeekId: 0,
            pairNumberId: 0,
            unitCode, // будет '' только если unit не найден, такое допустимо? Внешний ключ требует существующий код. Если unitCode '', нарушится constraint. Лучше null, если поле допускает NULL. Мы временно оставим '', но если constraint ругается, замените на null и проверьте поле в схеме.
            displayText: `(неразмещённое слияние) ${text}`,
            mergeNumber: mergeMap.get(l.id) ?? 0,
            positionFlag: false,
            classroomFlag: false,
          });
        }
        unplacedMergeCount += lessons.length;
      }
    }

        // ─── 6. Этап обычных занятий (строгая привязка к неделям) ─────
    const debugInfo: any[] = []; // собираем отладку по первым 5 урокам

    const unitSize = (code: string) => groupsByUnit.get(code)?.size ?? 0;
    const typePriority = (code: string) => {
      const u = unitByCode.get(code);
      if (!u) return 3;
      return u.unitTypeId;
    };

        const standaloneSorted = standalone
      .filter(l => l.countPerSemester && l.countPerSemester > 0 && l.teacherId)
      .sort((a, b) => {
        // Сначала сравниваем по ТИПУ юнита (поток > группа > подгруппа)
        const pa = getTypePriority(a.unitId!);
        const pb = getTypePriority(b.unitId!);
        if (pa !== pb) return pa - pb; // меньшее значение = выше приоритет
        // При одинаковом типе – по размеру юнита (больше → раньше)
        const ua = unitById.get(a.unitId!)?.code ?? '';
        const ub = unitById.get(b.unitId!)?.code ?? '';
        return (groupsByUnit.get(ub)?.size ?? 0) - (groupsByUnit.get(ua)?.size ?? 0);
      });

  
    

    // РАСШИРЕННАЯ ОТЛАДКА: теперь standaloneSorted уже определён
    const allStandaloneDebug = standaloneSorted.map(l => {
      const u = unitById.get(l.unitId!);
      return {
        lessonId: l.id,
        unitCode: u?.code ?? '❌ нет юнита',
        unitTypeId: u?.unitTypeId,
        teacherId: l.teacherId,
        countPerSemester: l.countPerSemester,
        hasClassrooms: (classroomByLesson.get(l.id) || []).length > 0,
        classroomIds: classroomByLesson.get(l.id) || [],
      };
    });
    debugInfo.push({ allStandalone: allStandaloneDebug });

    let debugCount = 0;
    for (const lesson of standaloneSorted) {
      const unit = unitById.get(lesson.unitId!);
      if (!unit) continue;
      const unitCode = unit.code;
      const groups = groupsByUnit.get(unitCode) ?? new Set();
      const cids = classroomByLesson.get(lesson.id) || [];
      if (cids.length === 0) continue;

      const totalPairs = lesson.countPerSemester!;
      const S = Math.ceil(totalPairs / step);
      const base = Math.floor(S / cycleLength);
      const rem = S % cycleLength;
      const weekLoad = new Array(cycleLength).fill(base);
      for (let i = 0; i < rem; i++) weekLoad[i]++;

      // Отладка первых 5 уроков
      if (debugCount < 5) {
        debugInfo.push({
          lessonId: lesson.id,
          unitCode,
          totalPairs,
          S,
          weekLoad: [...weekLoad],
        });
        debugCount++;
      }

      let placed = 0;
      for (let cw = 0; cw < cycleLength; cw++) {
        const needed = weekLoad[cw];
        for (let s = 0; s < needed; s++) {
          if (placed >= S) break;
          let placedInSlot = false;
          for (let attempt = 0; attempt < cycleSlots.length; attempt++) {
            const idx = (currentSlotIndex + attempt) % cycleSlots.length;
            const { weekNum, day, pair } = cycleSlots[idx];
            if (weekNum !== cw + 1) continue;

            const occ = occBySlot.get(slotKey(weekNum, day.id, pair.id)) ?? {
              teacherIds: new Set(), classroomIds: new Set(), groupIds: new Set()
            };
            if (!occBySlot.has(slotKey(weekNum, day.id, pair.id))) {
              occBySlot.set(slotKey(weekNum, day.id, pair.id), occ);
            }
            if (lesson.teacherId && occ.teacherIds.has(lesson.teacherId)) continue;
            if ([...groups].some(g => occ.groupIds.has(g))) continue;
            let freeCid: number | null = null;
            for (const cid of cids) {
              if (!occ.classroomIds.has(cid)) { freeCid = cid; break; }
            }
            if (freeCid === null) continue;

            scheduleInserts.push({
              weekNumber: weekNum,
              dayOfWeekId: day.id,
              pairNumberId: pair.id,
              lessonId: lesson.id,
              classroomId: freeCid,
              mergeFlag: mergeMap.get(lesson.id) ?? 0,
            });
            occ.teacherIds.add(lesson.teacherId!);
            occ.classroomIds.add(freeCid);
            groups.forEach(g => occ.groupIds.add(g));
            placed++;
            currentSlotIndex = (idx + 1) % cycleSlots.length;
            placedInSlot = true;
            break;
          }
          if (!placedInSlot) break;
        }
      }

      if (placed < S) {
        // неразмещённые пары в буфер (но мы не вставляем их в базу)
        const disc = (await ctx.db.select({ abbr: disciplines.abbreviation })
          .from(disciplines).where(eq(disciplines.id, lesson.disciplineId)).limit(1))[0]?.abbr ?? '';
        const lt = (await ctx.db.select({ name: lessonTypes.name })
          .from(lessonTypes).where(eq(lessonTypes.id, lesson.lessonTypeId)).limit(1))[0]?.name ?? '';
        const teacher = lesson.teacherId ? (await ctx.db.select({ s: employees.surname, n: employees.name, p: employees.patronymic })
          .from(employees).innerJoin(employeesDepartments, eq(employeesDepartments.employeeId, employees.id))
          .where(eq(employeesDepartments.id, lesson.teacherId)).limit(1))[0] : null;
        const teacherStr = teacher ? `${teacher.s} ${teacher.n[0]}.${teacher.p?.[0] ?? ''}` : '';
        const types: Record<string, string> = { lecture: 'лек.', lab: 'лаб.', workshop: 'пр.', guidedStudy: 'кср.' };
        const ta = types[lt] || lt;
        const text = `[${unitCode}] ${ta}${disc} – ${teacherStr}, б/а`;
        // Просто логируем, не кладём в bufferInserts
        debugInfo.push({
          unplaced: {
            lessonId: lesson.id,
            unitCode,
            needed: S,
            placed,
            text,
          }
        });
      }
    }

    // ─── 7. Сохранение результатов ──────────────────────────────────────
    if (scheduleInserts.length > 0) {
      await ctx.db.insert(schedule).values(scheduleInserts);
    }
    // if (bufferInserts.length > 0) {
    //   // Важно: убедитесь, что поле unitCode в таблице scheduleDisplay допускает NULL или имеет значения по умолчанию.
    //   // Если оно NOT NULL без default, замените '' на какой-то существующий код или разрешите NULL.
    //   await ctx.db.insert(scheduleDisplay).values(bufferInserts);
    // }

    // ─── 8. Формирование scheduleDisplay из schedule ────────────────────
    const allSched = await ctx.db.select().from(schedule);
    const enriched = await ctx.db
      .select({
        scheduleId: schedule.id,
        weekNumber: schedule.weekNumber,
        dayOfWeekId: schedule.dayOfWeekId,
        pairNumberId: schedule.pairNumberId,
        lessonId: schedule.lessonId,
        classroomId: schedule.classroomId,
        mergeFlag: schedule.mergeFlag,
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

    const pinnedKeys = new Set(pinned.map(p => `${p.lessonId}-${p.weekNumber}-${p.dayOfWeekId}-${p.pairNumberId}`));
    const displayRows: ScheduleDisplayInsert[] = [];
    for (const row of enriched) {
      const key = `${row.lessonId}-${row.weekNumber}-${row.dayOfWeekId}-${row.pairNumberId}`;
      const isPinned = pinnedKeys.has(key);
      const types: Record<string, string> = { lecture: 'лек.', lab: 'лаб.', workshop: 'пр.', guidedStudy: 'кср.' };
      const ta = types[row.lessonTypeName] || row.lessonTypeName;
      const teacher = `${row.teacherSurname} ${row.teacherName[0]}.${row.teacherPatronymic?.[0] ?? ''}`;
      const room = row.buildingNumber ? `${row.buildingNumber}-${row.roomNumber}` : 'б/а';
      const text = `[${row.unitCode}] ${ta}${row.disciplineAbbr} – ${teacher}, ${room}`;
      displayRows.push({
        lessonId: row.lessonId,
        weekNumber: row.weekNumber,
        dayOfWeekId: row.dayOfWeekId,
        pairNumberId: row.pairNumberId,
        unitCode: row.unitCode,
        displayText: text,
        mergeNumber: row.mergeFlag ?? 0,
        positionFlag: isPinned,
        classroomFlag: row.classroomId !== null,
      });
    }

    // Удаляем все display, кроме буфера (уже удалены, но перестрахуемся)
    await ctx.db.delete(scheduleDisplay).where(not(eq(scheduleDisplay.weekNumber, 0)));
    if (displayRows.length > 0) {
      await ctx.db.insert(scheduleDisplay).values(displayRows);
    }

            return {
              status: "regenerated",
              placedLessons: scheduleInserts.length,
              totalLessonsToPlace: lessonsToPlace.length,
              totalStandalone: standalone.length,
              bufferFilteredOut: bufferLessons.size,
              debug: debugInfo,
            };
  }),
});