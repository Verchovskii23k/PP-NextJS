// src/server/trpc/routers/scheduleDisplay.ts
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import {
  scheduleDisplay, daysOfWeek, pairs, unitRoots, studyGroups, unitTypes,
  employeesDepartments, classrooms, buildings, weeks, lessonTypes, disciplines
} from "@/db/schema";
import { lessons, lessonClassrooms, schedule, employees, units } from "@/db/schema";
import { eq, inArray, asc, and, or } from "drizzle-orm";
import { optimizeSchedule } from "./scheduleOptimizer";


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
          eq(scheduleDisplay.isBuffered, false)
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
          eq(scheduleDisplay.isBuffered, false)   // заменён gte
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
          eq(scheduleDisplay.isBuffered, false)   // заменён gte
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
            eq(scheduleDisplay.isBuffered, false)   // заменён gte
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
      .where(eq(scheduleDisplay.isBuffered, true))
      .orderBy(asc(scheduleDisplay.id));
  }),

  // Перенос в буфер
  moveToBuffer: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(scheduleDisplay)
        .set({ isBuffered: true })
        .where(eq(scheduleDisplay.id, input.id));
      return { success: true };
    }),

  // Возврат из буфера
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
      if (!record.length || !record[0].isBuffered) {
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
          eq(scheduleDisplay.isBuffered, false)
        ));
      if (existing.length > 0) throw new Error('Слот занят');

      await ctx.db
        .update(scheduleDisplay)
        .set({
          weekNumber: input.targetWeek,
          dayOfWeekId: input.targetDayId,
          pairNumberId: input.targetPairId,
          unitCode: input.targetUnitCode,
          isBuffered: false,
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

      const isBuffer = m.isBuffered;   // ← используем флаг

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
            eq(scheduleDisplay.isBuffered, false)   // исключаем буфер
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

        if (isBuffer) {
          results[key] = { status: 'free' };
          continue;
        }

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
          eq(scheduleDisplay.isBuffered, false)   // не учитываем буфер
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
    optimizeSchedule: adminProcedure.mutation(async () => {
      const result = await optimizeSchedule();
      return result;
    }),
});