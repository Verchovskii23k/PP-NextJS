// src/server/trpc/routers/scheduleDisplay.ts
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { scheduleDisplay, daysOfWeek, pairs, unitRoots, studyGroups, weeks } from "@/db/schema";
import { lessons, lessonClassrooms } from "@/db/schema";
import { eq, inArray, asc, and } from "drizzle-orm";
import { optimizeSchedule } from "./scheduleOptimizer";

export const scheduleDisplayRouter = router({
getForWeekPair: adminProcedure
  .input(z.object({ weekBaseId: z.number().int().min(1).optional() }))
  .query(async ({ ctx }) => {
    // Все активные недели с типами
    const weeksList = await ctx.db
      .select({ id: weeks.id, type: weeks.type })
      .from(weeks)
      .where(eq(weeks.isActive, true))
      .orderBy(asc(weeks.id));

    // ВСЕ строки, не фильтруем по неделям
    const rows = await ctx.db
      .select()
      .from(scheduleDisplay)
      .where(eq(scheduleDisplay.isBuffered, false))
      .orderBy(
        asc(scheduleDisplay.weekId),
        asc(scheduleDisplay.dayOfWeekId),
        asc(scheduleDisplay.pairNumberId),
        asc(scheduleDisplay.unitCode)
      );

    const days = await ctx.db.select().from(daysOfWeek).orderBy(asc(daysOfWeek.id));
    const pairsList = await ctx.db.select().from(pairs).orderBy(asc(pairs.number));

    return { rows, days, pairs: pairsList, weeks: weeksList };
  }),

getByGroup: adminProcedure
  .input(z.object({ studyGroupCode: z.string().min(1), weekBaseId: z.number().int().min(1).optional() }))
  .query(async ({ ctx, input }) => {
    const weeksList = await ctx.db
      .select({ id: weeks.id, type: weeks.type })
      .from(weeks)
      .where(eq(weeks.isActive, true))
      .orderBy(asc(weeks.id));

    const unitLinks = await ctx.db
      .select({ unitCode: unitRoots.unitCode })
      .from(unitRoots)
      .innerJoin(studyGroups, eq(unitRoots.studyGroupId, studyGroups.id))
      .where(eq(studyGroups.code, input.studyGroupCode));
    if (unitLinks.length === 0) return { rows: [], days: [], pairs: [], weeks: weeksList };

    const unitCodes = [...new Set(unitLinks.map(u => u.unitCode))];

    const rows = await ctx.db
      .select()
      .from(scheduleDisplay)
      .where(and(
        inArray(scheduleDisplay.unitCode, unitCodes),
        eq(scheduleDisplay.isBuffered, false)
      ))
      .orderBy(
        asc(scheduleDisplay.weekId),
        asc(scheduleDisplay.dayOfWeekId),
        asc(scheduleDisplay.pairNumberId),
        asc(scheduleDisplay.unitCode)
      );

    const days = await ctx.db.select().from(daysOfWeek).orderBy(asc(daysOfWeek.id));
    const pairsList = await ctx.db.select().from(pairs).orderBy(asc(pairs.number));

    return { rows, days, pairs: pairsList, weeks: weeksList };
  }),

getByStudyGroups: adminProcedure
  .input(z.object({ weekBaseId: z.number().int().min(1).optional() }))
  .query(async ({ ctx }) => {
    const weeksList = await ctx.db
      .select({ id: weeks.id, type: weeks.type })
      .from(weeks)
      .where(eq(weeks.isActive, true))
      .orderBy(asc(weeks.id));

    const roots = await ctx.db
      .select({ studyGroupCode: studyGroups.code, unitCode: unitRoots.unitCode })
      .from(unitRoots)
      .innerJoin(studyGroups, eq(unitRoots.studyGroupId, studyGroups.id))
      .innerJoin(scheduleDisplay, eq(unitRoots.unitCode, scheduleDisplay.unitCode))
      .where(eq(scheduleDisplay.isBuffered, false));

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
          weekId: scheduleDisplay.weekId,
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
          inArray(scheduleDisplay.unitCode, unitList),
          eq(scheduleDisplay.isBuffered, false)
        ));
      for (const row of groupRows) {
        allRows.push({
          ...row, studyGroupCode: groupCode,
          classroomId: null,
          isBuffered: false
        });
      }
    }

    allRows.sort((a, b) =>
      a.weekId - b.weekId ||
      a.dayOfWeekId - b.dayOfWeekId ||
      a.pairNumberId - b.pairNumberId ||
      a.studyGroupCode.localeCompare(b.studyGroupCode)
    );

    const days = await ctx.db.select().from(daysOfWeek).orderBy(asc(daysOfWeek.id));
    const pairsList = await ctx.db.select().from(pairs).orderBy(asc(pairs.number));

    return { rows: allRows, days, pairs: pairsList, weeks: weeksList };
  }),

  getBuffer: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(scheduleDisplay).where(eq(scheduleDisplay.isBuffered, true)).orderBy(asc(scheduleDisplay.id));
  }),

  moveToBuffer: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(scheduleDisplay).set({ isBuffered: true }).where(eq(scheduleDisplay.id, input.id));
      return { success: true };
    }),

  moveFromBuffer: adminProcedure
    .input(z.object({
      id: z.number(),
      targetWeekId: z.number().int().min(1),
      targetDayId: z.number().int(),
      targetPairId: z.number().int(),
      targetUnitCode: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const record = await ctx.db.select().from(scheduleDisplay).where(eq(scheduleDisplay.id, input.id)).limit(1);
      if (!record.length || !record[0].isBuffered) throw new Error('Запись не в буфере');

      const existing = await ctx.db
        .select()
        .from(scheduleDisplay)
        .where(and(
          eq(scheduleDisplay.weekId, input.targetWeekId),
          eq(scheduleDisplay.dayOfWeekId, input.targetDayId),
          eq(scheduleDisplay.pairNumberId, input.targetPairId),
          eq(scheduleDisplay.unitCode, input.targetUnitCode),
          eq(scheduleDisplay.isBuffered, false)
        ));
      if (existing.length > 0) throw new Error('Слот занят');

      await ctx.db.update(scheduleDisplay).set({
        weekId: input.targetWeekId,
        dayOfWeekId: input.targetDayId,
        pairNumberId: input.targetPairId,
        unitCode: input.targetUnitCode,
        isBuffered: false,
        positionFlag: false,
        mergeNumber: 0,
      }).where(eq(scheduleDisplay.id, input.id));

      return { success: true };
    }),

  checkSlots: adminProcedure
    .input(z.object({
      movingId: z.number(),
      slots: z.array(z.object({
        weekId: z.number().int(),
        dayId: z.number().int(),
        pairId: z.number().int(),
        unitCode: z.string(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const moving = await ctx.db.select().from(scheduleDisplay).where(eq(scheduleDisplay.id, input.movingId)).limit(1);
      if (!moving.length) throw new Error('Занятие не найдено');
      const m = moving[0];

      const movingUnitGroups = await ctx.db
        .select({ studyGroupId: unitRoots.studyGroupId })
        .from(unitRoots)
        .where(eq(unitRoots.unitCode, m.unitCode));
      const movingGroupIds = new Set(movingUnitGroups.map(r => r.studyGroupId));

      let mTeacherId: number | null = null;
      let mClassroomId: number | null = null;
      if (m.lessonId != null) {
        const [mTeacher, mClassroom] = await Promise.all([
          ctx.db.select({ teacherId: lessons.teacherId }).from(lessons).where(eq(lessons.id, m.lessonId)).limit(1),
          ctx.db.select({ classroomId: lessonClassrooms.classroomId }).from(lessonClassrooms).where(eq(lessonClassrooms.lessonId, m.lessonId)).limit(1),
        ]);
        mTeacherId = mTeacher[0]?.teacherId ?? null;
        mClassroomId = mClassroom[0]?.classroomId ?? null;
      }

      const oldSlot = m.isBuffered ? null : {
        weekId: m.weekId,
        dayId: m.dayOfWeekId,
        pairId: m.pairNumberId,
        unitCode: m.unitCode,
      };

      const results: Record<string, { status: string; swapId?: number }> = {};

      for (const slot of input.slots) {
        const key = `week-${slot.weekId}-${slot.dayId}-${slot.pairId}-${slot.unitCode}`;

        const allInSlot = await ctx.db
          .select()
          .from(scheduleDisplay)
          .where(and(
            eq(scheduleDisplay.weekId, slot.weekId),
            eq(scheduleDisplay.dayOfWeekId, slot.dayId),
            eq(scheduleDisplay.pairNumberId, slot.pairId),
            eq(scheduleDisplay.isBuffered, false)
          ));

        const others = allInSlot.filter(e => e.id !== input.movingId);
        const sameUnitEntry = others.find(e => e.unitCode === m.unitCode) ?? null;
        const differentUnitEntries = others.filter(e => e.unitCode !== m.unitCode);

        let directConflict = false;
        for (const other of differentUnitEntries) {
          const otherUnitGroups = await ctx.db
            .select({ studyGroupId: unitRoots.studyGroupId })
            .from(unitRoots)
            .where(eq(unitRoots.unitCode, other.unitCode));
          const otherGroupIds = new Set(otherUnitGroups.map(r => r.studyGroupId));

          let oTeacherId: number | null = null;
          let oClassroomId: number | null = null;
          if (other.lessonId != null) {
            const [otherTeacher, otherClassroom] = await Promise.all([
              ctx.db.select({ teacherId: lessons.teacherId }).from(lessons).where(eq(lessons.id, other.lessonId)).limit(1),
              ctx.db.select({ classroomId: lessonClassrooms.classroomId }).from(lessonClassrooms).where(eq(lessonClassrooms.lessonId, other.lessonId)).limit(1),
            ]);
            oTeacherId = otherTeacher[0]?.teacherId ?? null;
            oClassroomId = otherClassroom[0]?.classroomId ?? null;
          }

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

        if (sameUnitEntry) {
          if (m.isBuffered) {
            results[key] = { status: 'conflict' };
            continue;
          }

          let sTeacherId: number | null = null;
          let sClassroomId: number | null = null;
          if (sameUnitEntry.lessonId != null) {
            const [sameTeacher, sameClassroom] = await Promise.all([
              ctx.db.select({ teacherId: lessons.teacherId }).from(lessons).where(eq(lessons.id, sameUnitEntry.lessonId)).limit(1),
              ctx.db.select({ classroomId: lessonClassrooms.classroomId }).from(lessonClassrooms).where(eq(lessonClassrooms.lessonId, sameUnitEntry.lessonId)).limit(1),
            ]);
            sTeacherId = sameTeacher[0]?.teacherId ?? null;
            sClassroomId = sameClassroom[0]?.classroomId ?? null;
          }

          let mDisc: number | null = null;
          let sDisc: number | null = null;
          if (m.lessonId != null) {
            [mDisc] = (await ctx.db.select({ disciplineId: lessons.disciplineId }).from(lessons).where(eq(lessons.id, m.lessonId)).limit(1)).map(r => r.disciplineId) as number[];
          }
          if (sameUnitEntry.lessonId != null) {
            [sDisc] = (await ctx.db.select({ disciplineId: lessons.disciplineId }).from(lessons).where(eq(lessons.id, sameUnitEntry.lessonId)).limit(1)).map(r => r.disciplineId) as number[];
          }

          if (mTeacherId === sTeacherId && mClassroomId === sClassroomId && mDisc === sDisc) {
            results[key] = { status: 'conflict' };
            continue;
          }

          if (oldSlot) {
            const oldSlotAll = await ctx.db
              .select()
              .from(scheduleDisplay)
              .where(and(
                eq(scheduleDisplay.weekId, oldSlot.weekId),
                eq(scheduleDisplay.dayOfWeekId, oldSlot.dayId),
                eq(scheduleDisplay.pairNumberId, oldSlot.pairId),
                eq(scheduleDisplay.isBuffered, false)
              ));
            const oldOthers = oldSlotAll.filter(e => e.id !== input.movingId);

            let reverseConflict = false;
            const sameUnitGroups = await ctx.db
              .select({ studyGroupId: unitRoots.studyGroupId })
              .from(unitRoots)
              .where(eq(unitRoots.unitCode, sameUnitEntry.unitCode));
            const sameGroupIds = new Set(sameUnitGroups.map(r => r.studyGroupId));

            for (const oldOther of oldOthers) {
              const oldOtherUnitGroups = await ctx.db
                .select({ studyGroupId: unitRoots.studyGroupId })
                .from(unitRoots)
                .where(eq(unitRoots.unitCode, oldOther.unitCode));
              const oldOtherGroupIds = new Set(oldOtherUnitGroups.map(r => r.studyGroupId));

              let ooTId: number | null = null;
              let ooCId: number | null = null;
              if (oldOther.lessonId != null) {
                const [oldOtherTeacher, oldOtherClassroom] = await Promise.all([
                  ctx.db.select({ teacherId: lessons.teacherId }).from(lessons).where(eq(lessons.id, oldOther.lessonId)).limit(1),
                  ctx.db.select({ classroomId: lessonClassrooms.classroomId }).from(lessonClassrooms).where(eq(lessonClassrooms.lessonId, oldOther.lessonId)).limit(1),
                ]);
                ooTId = oldOtherTeacher[0]?.teacherId ?? null;
                ooCId = oldOtherClassroom[0]?.classroomId ?? null;
              }

              if (
                ([...sameGroupIds].some(g => oldOtherGroupIds.has(g))) ||
                (sTeacherId && ooTId && sTeacherId === ooTId) ||
                (sClassroomId && ooCId && sClassroomId === ooCId)
              ) {
                reverseConflict = true;
                break;
              }
            }
            results[key] = reverseConflict ? { status: 'conflict' } : { status: 'swap', swapId: sameUnitEntry.id };
          } else {
            results[key] = { status: 'conflict' };
          }
        } else {
          results[key] = { status: 'free' };
        }
      }
      return results;
    }),

  move: adminProcedure
    .input(z.object({
      id: z.number(),
      targetWeekId: z.number().int(),
      targetDayId: z.number().int(),
      targetPairId: z.number().int(),
      targetUnitCode: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(scheduleDisplay)
        .where(and(
          eq(scheduleDisplay.weekId, input.targetWeekId),
          eq(scheduleDisplay.dayOfWeekId, input.targetDayId),
          eq(scheduleDisplay.pairNumberId, input.targetPairId),
          eq(scheduleDisplay.unitCode, input.targetUnitCode),
          eq(scheduleDisplay.isBuffered, false)
        ));
      if (existing.length > 0) throw new Error('Слот занят');

      await ctx.db.update(scheduleDisplay).set({
        weekId: input.targetWeekId,
        dayOfWeekId: input.targetDayId,
        pairNumberId: input.targetPairId,
        unitCode: input.targetUnitCode,
        positionFlag: false,
        mergeNumber: 0,
      }).where(eq(scheduleDisplay.id, input.id));
      return { success: true };
    }),

  swap: adminProcedure
    .input(z.object({ id1: z.number(), id2: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [rec1, rec2] = await Promise.all([
        ctx.db.select().from(scheduleDisplay).where(eq(scheduleDisplay.id, input.id1)).limit(1),
        ctx.db.select().from(scheduleDisplay).where(eq(scheduleDisplay.id, input.id2)).limit(1),
      ]);
      const r1 = rec1[0] as typeof scheduleDisplay.$inferSelect;
      const r2 = rec2[0] as typeof scheduleDisplay.$inferSelect;

      if (r1.unitCode !== r2.unitCode) throw new Error('Обмен между разными юнитами запрещён');

      const slot1 = { weekId: r1.weekId, dayOfWeekId: r1.dayOfWeekId, pairNumberId: r1.pairNumberId, unitCode: r1.unitCode };
      const slot2 = { weekId: r2.weekId, dayOfWeekId: r2.dayOfWeekId, pairNumberId: r2.pairNumberId, unitCode: r2.unitCode };

      await Promise.all([
        ctx.db.update(scheduleDisplay).set({ ...slot2, positionFlag: false, mergeNumber: 0 }).where(eq(scheduleDisplay.id, input.id1)),
        ctx.db.update(scheduleDisplay).set({ ...slot1, positionFlag: false, mergeNumber: 0 }).where(eq(scheduleDisplay.id, input.id2)),
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
    return await optimizeSchedule();
  }),
});