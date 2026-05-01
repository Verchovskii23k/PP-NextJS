import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { scheduleDisplay, daysOfWeek, pairs, unitRoots, studyGroups } from "@/db/schema";
import { lessons, lessonClassrooms } from "@/db/schema";
import { eq, inArray, asc, and } from "drizzle-orm";

export const scheduleDisplayRouter = router({
  // Получить расписание для пары недель (нечётная + чётная)
  getForWeekPair: adminProcedure
    .input(z.object({
      weekBase: z.number().int().min(1),
    }))
    .query(async ({ ctx, input }) => {
      const { weekBase } = input;
      const weekEven = weekBase + 1;

      const rows = await ctx.db
        .select()
        .from(scheduleDisplay)
        .where(
          inArray(scheduleDisplay.weekNumber, [weekBase, weekEven])
        )
        .orderBy(
          asc(scheduleDisplay.weekNumber),
          asc(scheduleDisplay.dayOfWeekId),
          asc(scheduleDisplay.pairNumberId),
          asc(scheduleDisplay.unitCode)
        );

      const days = await ctx.db.select().from(daysOfWeek).orderBy(asc(daysOfWeek.id));
      const pairsList = await ctx.db.select().from(pairs).orderBy(asc(pairs.number));

      return {
        rows,
        days,
        pairs: pairsList,
      };
    }),

  // Расписание одной группы (по выбору)
  getByGroup: adminProcedure
    .input(z.object({
      studyGroupCode: z.string().min(1),
      weekBase: z.number().int().min(1),
    }))
    .query(async ({ ctx, input }) => {
      const { studyGroupCode, weekBase } = input;
      const weekEven = weekBase + 1;

      const unitLinks = await ctx.db
        .select({ unitCode: unitRoots.unitCode })
        .from(unitRoots)
        .innerJoin(studyGroups, eq(unitRoots.studyGroupId, studyGroups.id))
        .where(eq(studyGroups.code, studyGroupCode));

      if (unitLinks.length === 0) {
        return { rows: [], days: [], pairs: [] };
      }

      const unitCodes = [...new Set(unitLinks.map(u => u.unitCode))];

      const rows = await ctx.db
        .select()
        .from(scheduleDisplay)
        .where(and(
          inArray(scheduleDisplay.weekNumber, [weekBase, weekEven]),
          inArray(scheduleDisplay.unitCode, unitCodes)
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

  // Расписание, сгруппированное по учебным группам (все сразу)
  getByStudyGroups: adminProcedure
    .input(z.object({
      weekBase: z.number().int().min(1),
    }))
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
        .where(
          inArray(scheduleDisplay.weekNumber, [weekBase, weekEven])
        );

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
            inArray(scheduleDisplay.unitCode, unitList)
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

      return {
        rows: allRows,
        days,
        pairs: pairsList,
      };
    }),

  // Пакетная проверка слотов
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

      const movingUnitGroups = await ctx.db
        .select({ studyGroupId: unitRoots.studyGroupId })
        .from(unitRoots)
        .where(eq(unitRoots.unitCode, m.unitCode));
      const movingGroupIds = new Set(movingUnitGroups.map(r => r.studyGroupId));

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

      const results: Record<string, { status: string; swapId?: number }> = {};

      for (const slot of input.slots) {
        const key = `week-${slot.week}-${slot.dayId}-${slot.pairId}-${slot.unitCode}`;

        const existing = await ctx.db
          .select()
          .from(scheduleDisplay)
          .where(and(
            eq(scheduleDisplay.weekNumber, slot.week),
            eq(scheduleDisplay.dayOfWeekId, slot.dayId),
            eq(scheduleDisplay.pairNumberId, slot.pairId),
            eq(scheduleDisplay.unitCode, slot.unitCode),
          ));

        const others = existing.filter(e => e.id !== input.movingId);
        if (others.length === 0) {
          results[key] = { status: 'free' };
          continue;
        }

        let swapId: number | null = null;
        for (const o of others) {
          const oUnitGroups = await ctx.db
            .select({ studyGroupId: unitRoots.studyGroupId })
            .from(unitRoots)
            .where(eq(unitRoots.unitCode, o.unitCode));
          const oGroupIds = new Set(oUnitGroups.map(r => r.studyGroupId));
          const studentConflict = [...movingGroupIds].some(g => oGroupIds.has(g));

          const [oTeacher, oClassroom] = await Promise.all([
            ctx.db.select({ teacherId: lessons.teacherId })
              .from(lessons)
              .where(eq(lessons.id, o.lessonId))
              .limit(1),
            ctx.db.select({ classroomId: lessonClassrooms.classroomId })
              .from(lessonClassrooms)
              .where(eq(lessonClassrooms.lessonId, o.lessonId))
              .limit(1),
          ]);

          const teacherConflict = mTeacherId && oTeacher[0]?.teacherId && mTeacherId === oTeacher[0]?.teacherId;
          const roomConflict = mClassroomId && oClassroom[0]?.classroomId && mClassroomId === oClassroom[0]?.classroomId;

          if (studentConflict || teacherConflict || roomConflict) {
            swapId = null;
            break;
          } else {
            swapId = o.id;
          }
        }

        results[key] = swapId !== null
          ? { status: 'swap', swapId }
          : { status: 'conflict' };
      }

      return results;
    }),

  // Переместить занятие в пустой слот
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

  // Обменять два занятия местами
  swap: adminProcedure
    .input(z.object({
      id1: z.number(),
      id2: z.number(),
    }))
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

  // Обновить флаги
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
});