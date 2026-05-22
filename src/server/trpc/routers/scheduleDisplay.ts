/**
 * ## Роутер `scheduleDisplayRouter`
 *
 * Отвечает за всё, что связано с отображением и редактированием расписания.
 * Предоставляет CRUD-подобные процедуры для таблицы `schedule_display`, а также
 * специализированные запросы для построения сетки расписания, буфера занятий,
 * проверки конфликтов при drag‑and‑drop и запуска оптимизатора.
 *
 * Все процедуры доступны только администраторам (adminProcedure).
 *
 * ---
 * ### 🔐 Версионирование данных
 *
 * Система поддерживает архивные версии расписания.
 * В зависимости от переданного `versionId` выбирается один из трёх режимов:
 * - `versionId === undefined` или `null` – **активное расписание** (`isActive = true`, `versionId IS NULL`).
 * - `versionId` – конкретная архивная версия (`isActive = false`, `versionId = переданному`).
 *
 * Это касается не только `scheduleDisplay`, но и связанных таблиц:
 * `unitRoots`, `lessons`, `lessonClassrooms`.
 *
 * Вспомогательные функции `scheduleVersionCondition`, `unitRootsVersionCondition` и т.д.
 * генерируют нужное условие для SQL-запроса.
 *
 * ---
 * ### 📋 Процедуры (endpoints)
 *
 * | Процедура          | Тип      | Описание                                                                                                    |
 * |--------------------|----------|-------------------------------------------------------------------------------------------------------------|
 * | `getForWeekPair`   | query    | Возвращает строки расписания, дни, пары и недели для режима "По юнитам".
 *                                   Фильтрует только активные (не буфер) записи с известными координатами.                                      |
 * | `getByGroup`       | query    | То же для одной учебной группы (по `studyGroupCode`).                                                       |
 * | `getByStudyGroups` | query    | Агрегирует расписание сразу по всем группам: для каждой группы 
 *                                   собирает связанные юниты и их строки. Используется в режиме "По группам".                                   |
 * | `getBuffer`        | query    | Возвращает все записи, находящиеся в буфере (`isBuffered = true`) для заданной версии.                      |
 * | `getBufferedCount` | query    | Возвращает количество записей в буфере. Используется для проверки необходимости диалога перед оптимизацией. |
 * | `moveToBuffer`     | mutation | Перемещает занятие в буфер: устанавливает `isBuffered = true` и **обнуляет координаты** 
 *                                  (`weekId`, `dayOfWeekId`, `pairNumberId`), чтобы слот освободился и не создавалось дубликатов.               |
 * | `moveFromBuffer`   | mutation | Возвращает занятие из буфера в указанную ячейку. Проверяет, что запись действительно в буфере, 
 *                                   и что целевой слот не занят. При успехе снимает флаг `isBuffered`, прописывает новые координаты и 
 *                                   сбрасывает флаги фиксации.                                                                                  |
 * | `checkSlots`       | mutation | **Ключевая логика drag‑and‑drop.** Для перетаскиваемого занятия (`movingId`) и массива 
 *                                   потенциальных слотов возвращает статус каждого слота: `"free"` (свободно), 
 *                                   `"conflict"` (конфликт) или `"swap"` (можно обменяться с находящимся там занятием). 
 *                                   Учитывает: группы юнита, преподавателя, аудиторию, дисциплину, а также обратный конфликт при swap. 
 *                                   Подробнее см. ниже.                                                                                         |
 * | `move`             | mutation | Прямое перемещение занятия в свободный слот. Сбрасывает флаги фиксации.                                     |
 * | `swap`             | mutation | Обмен двух записей одного юнита местами (с координатами). Сбрасывает флаги фиксации.                        |
 * | `updateFlags`      | mutation | Изменяет флаги (`mergeNumber`, `positionFlag`, `classroomFlag`) у конкретной записи.                        |
 * | `optimizeSchedule` | mutation | Запускает оптимизатор расписания. Если передан `includeBuffered: true`, предварительно снимает флаг
 *                                   буфера и сбрасывает все ограничивающие флаги у всех записей в буфере, чтобы они могли быть
 *                                   переставлены оптимизатором.                                                                                 |
 * | `resetFlags`       | mutation | Массовый сброс выбранных флагов (позиции, аудитории, слияния) у всех активных не-буферных записей.          |
 *
 * ---
 * ### 🧠 Логика проверки конфликтов в `checkSlots`
 *
 * Алгоритм для каждого слота:
 * 1. Если слот совпадает с исходной позицией перемещаемого занятия (и оно не в буфере) – сразу `"free"`.
 * 2. Загружаются все не-буферные записи в этом слоте.
 * 3. Выделяются:
 *    - `sameUnitEntry` – запись с тем же `unitCode`, что и у перетаскиваемого.
 *    - `differentUnitEntries` – записи с другими `unitCode`.
 * 4. **Прямой конфликт** проверяется только для `differentUnitEntries`: если хоть одна из них имеет общие группы с перемещаемым занятием, или того же преподавателя, или ту же аудиторию – статус `"conflict"`.
 * 5. Если есть `sameUnitEntry` и перемещаемое занятие **не из буфера**:
 *    - Сравниваются преподаватель, аудитория и дисциплина перемещаемого и найденного. Если все три совпадают – `"conflict"`.
 *    - Иначе вычисляется `oldSlot` (откуда тянут). Для всех оставшихся записей в исходном слоте проверяется **обратный конфликт**: не будут ли они конфликтовать с `sameUnitEntry`, если тот переместится в исходный слот. Если конфликт есть – `"conflict"`, иначе `"swap"` (с указанием `swapId`).
 * 6. Если `sameUnitEntry` нет – `"free"`.
 *
 * Эта логика гарантирует, что DnD не допустит двойного бронирования и предложит обмен там, где это возможно.
 */
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import {
  scheduleDisplay,
  daysOfWeek,
  pairs,
  unitRoots,
  studyGroups,
  weeks,
  lessons,
  lessonClassrooms,
} from "@/db/schema";
import { eq, inArray, asc, and, isNull, isNotNull } from "drizzle-orm";
import { optimizeSchedule } from "./scheduleOptimizer";
import { TRPCError } from "@trpc/server";

// Вспомогательная функция для построения условия на scheduleDisplay
function scheduleVersionCondition(
  versionId: number | null | undefined
) {
  if (versionId === undefined) {
    // по умолчанию – активная версия
    return and(
      eq(scheduleDisplay.isActive, true),
      isNull(scheduleDisplay.versionId)
    );
  }
  if (versionId === null) {
    return and(
      eq(scheduleDisplay.isActive, true),
      isNull(scheduleDisplay.versionId)
    );
  }
  return and(
    eq(scheduleDisplay.isActive, false),
    eq(scheduleDisplay.versionId, versionId)
  );
}

// Условие для unitRoots (у них тоже isActive и versionId)
function unitRootsVersionCondition(
  versionId: number | null | undefined
) {
  if (versionId === undefined || versionId === null) {
    return and(
      eq(unitRoots.isActive, true),
      isNull(unitRoots.versionId)
    );
  }
  return and(
    eq(unitRoots.isActive, false),
    eq(unitRoots.versionId, versionId)
  );
}

// Условие для lessons и lessonClassrooms (у них isActive и versionId)
function lessonsVersionCondition(
  versionId: number | null | undefined
) {
  if (versionId === undefined || versionId === null) {
    return and(
      eq(lessons.isActive, true),
      isNull(lessons.versionId)
    );
  }
  return and(
    eq(lessons.isActive, false),
    eq(lessons.versionId, versionId)
  );
}

function lessonClassroomsVersionCondition(
  versionId: number | null | undefined
) {
  if (versionId === undefined || versionId === null) {
    return and(
      eq(lessonClassrooms.isActive, true),
      isNull(lessonClassrooms.versionId)
    );
  }
  return and(
    eq(lessonClassrooms.isActive, false),
    eq(lessonClassrooms.versionId, versionId)
  );
}

export const scheduleDisplayRouter = router({
  getForWeekPair: adminProcedure
    .input(
      z.object({
        weekBaseId: z.number().int().min(1).optional(),
        versionId: z.number().nullable().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const versionCond = scheduleVersionCondition(input.versionId);

      const weeksList = await ctx.db
        .select({ id: weeks.id, type: weeks.type })
        .from(weeks)
        .where(eq(weeks.isActive, true))
        .orderBy(asc(weeks.id));

      const rows = await ctx.db
        .select()
        .from(scheduleDisplay)
        .where(and(
          eq(scheduleDisplay.isBuffered, false),
          isNotNull(scheduleDisplay.weekId),
          isNotNull(scheduleDisplay.dayOfWeekId),
          isNotNull(scheduleDisplay.pairNumberId),
          versionCond
        ))

      const days = await ctx.db
        .select()
        .from(daysOfWeek)
        .orderBy(asc(daysOfWeek.id));
      const pairsList = await ctx.db
        .select()
        .from(pairs)
        .orderBy(asc(pairs.number));

      return { rows, days, pairs: pairsList, weeks: weeksList };
    }),

  getByGroup: adminProcedure
    .input(
      z.object({
        studyGroupCode: z.string().min(1),
        weekBaseId: z.number().int().min(1).optional(),
        versionId: z.number().nullable().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const versionCond = scheduleVersionCondition(input.versionId);
      const unitRootsCond = unitRootsVersionCondition(input.versionId);

      const weeksList = await ctx.db
        .select({ id: weeks.id, type: weeks.type })
        .from(weeks)
        .where(eq(weeks.isActive, true))
        .orderBy(asc(weeks.id));

      const unitLinks = await ctx.db
        .select({ unitCode: unitRoots.unitCode })
        .from(unitRoots)
        .innerJoin(studyGroups, eq(unitRoots.studyGroupId, studyGroups.id))
        .where(
          and(
            eq(studyGroups.code, input.studyGroupCode),
            unitRootsCond
          )
        );

      if (unitLinks.length === 0)
        return { rows: [], days: [], pairs: [], weeks: weeksList };

      const unitCodes = [...new Set(unitLinks.map((u) => u.unitCode))];

      const rows = await ctx.db
        .select()
        .from(scheduleDisplay)
        .where(and(
          inArray(scheduleDisplay.unitCode, unitCodes),
          eq(scheduleDisplay.isBuffered, false),
          isNotNull(scheduleDisplay.weekId),
          isNotNull(scheduleDisplay.dayOfWeekId),
          isNotNull(scheduleDisplay.pairNumberId),
          versionCond
        ))
        .orderBy(
          asc(scheduleDisplay.weekId),
          asc(scheduleDisplay.dayOfWeekId),
          asc(scheduleDisplay.pairNumberId),
          asc(scheduleDisplay.unitCode)
        );

      const days = await ctx.db
        .select()
        .from(daysOfWeek)
        .orderBy(asc(daysOfWeek.id));
      const pairsList = await ctx.db
        .select()
        .from(pairs)
        .orderBy(asc(pairs.number));

      return { rows, days, pairs: pairsList, weeks: weeksList };
    }),

  getByStudyGroups: adminProcedure
    .input(
      z.object({
        weekBaseId: z.number().int().min(1).optional(),
        versionId: z.number().nullable().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const versionCond = scheduleVersionCondition(input.versionId);
      const unitRootsCond = unitRootsVersionCondition(input.versionId);

      const weeksList = await ctx.db
        .select({ id: weeks.id, type: weeks.type })
        .from(weeks)
        .where(eq(weeks.isActive, true))
        .orderBy(asc(weeks.id));

      const roots = await ctx.db
        .select({
          studyGroupCode: studyGroups.code,
          unitCode: unitRoots.unitCode,
        })
        .from(unitRoots)
        .innerJoin(
          studyGroups,
          eq(unitRoots.studyGroupId, studyGroups.id)
        )
        .innerJoin(
          scheduleDisplay,
          eq(unitRoots.unitCode, scheduleDisplay.unitCode)
        )
        .where(and(
          eq(scheduleDisplay.isBuffered, false),
          isNotNull(scheduleDisplay.weekId),
          isNotNull(scheduleDisplay.dayOfWeekId),
          isNotNull(scheduleDisplay.pairNumberId),
          versionCond,
          unitRootsCond
        ))

      const groupUnitMap = new Map<string, Set<string>>();
      for (const { studyGroupCode, unitCode } of roots) {
        if (!groupUnitMap.has(studyGroupCode))
          groupUnitMap.set(studyGroupCode, new Set());
        groupUnitMap.get(studyGroupCode)!.add(unitCode);
      }

      const allRows: (typeof scheduleDisplay.$inferSelect & {
        studyGroupCode: string;
      })[] = [];

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
            versionId: scheduleDisplay.versionId,
            isActive: scheduleDisplay.isActive,
            classroomId: scheduleDisplay.classroomId,
            isBuffered: scheduleDisplay.isBuffered,
          })
          .from(scheduleDisplay)
          .where(and(
            inArray(scheduleDisplay.unitCode, unitList),
            eq(scheduleDisplay.isBuffered, false),
            isNotNull(scheduleDisplay.weekId),
            isNotNull(scheduleDisplay.dayOfWeekId),
            isNotNull(scheduleDisplay.pairNumberId),
            versionCond
          ))

        for (const row of groupRows) {
          allRows.push({
            ...row,
            studyGroupCode: groupCode,
          });
        }
      }

      allRows.sort(
        (a, b) =>
          a.weekId! - b.weekId! ||
          a.dayOfWeekId! - b.dayOfWeekId! ||
          a.pairNumberId! - b.pairNumberId! ||
          a.studyGroupCode.localeCompare(b.studyGroupCode)
      );

      const days = await ctx.db
        .select()
        .from(daysOfWeek)
        .orderBy(asc(daysOfWeek.id));
      const pairsList = await ctx.db
        .select()
        .from(pairs)
        .orderBy(asc(pairs.number));

      return { rows: allRows, days, pairs: pairsList, weeks: weeksList };
    }),

  getBuffer: adminProcedure
    .input(
      z.object({
        versionId: z.number().nullable().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const versionCond = scheduleVersionCondition(input.versionId);
      return ctx.db
        .select()
        .from(scheduleDisplay)
        .where(and(eq(scheduleDisplay.isBuffered, true), versionCond))
        .orderBy(asc(scheduleDisplay.id));
    }),
  getBufferedCount: adminProcedure
    .input(z.object({ versionId: z.number().nullable().optional() }))
    .query(async ({ ctx, input }) => {
      const versionCond = scheduleVersionCondition(input.versionId);
      const rows = await ctx.db
        .select()
        .from(scheduleDisplay)
        .where(and(eq(scheduleDisplay.isBuffered, true), versionCond));
      return { count: rows.length };
    }),
  moveToBuffer: adminProcedure
    .input(z.object({ id: z.number(), versionId: z.number().nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const versionCond = scheduleVersionCondition(input.versionId);
      await ctx.db
        .update(scheduleDisplay)
        .set({
          isBuffered: true,
          weekId: null,
          dayOfWeekId: null,
          pairNumberId: null,
        })
        .where(and(eq(scheduleDisplay.id, input.id), versionCond));
      return { success: true };
    }),

  moveFromBuffer: adminProcedure
    .input(
      z.object({
        id: z.number(),
        targetWeekId: z.number().int().min(1),
        targetDayId: z.number().int(),
        targetPairId: z.number().int(),
        targetUnitCode: z.string(),
        versionId: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const versionCond = scheduleVersionCondition(input.versionId);

      const record = await ctx.db
        .select()
        .from(scheduleDisplay)
        .where(and(eq(scheduleDisplay.id, input.id), versionCond))
        .limit(1);
      if (!record.length || !record[0].isBuffered)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Запись не в буфере' });

      const existing = await ctx.db
        .select()
        .from(scheduleDisplay)
        .where(
          and(
            eq(scheduleDisplay.weekId, input.targetWeekId),
            eq(scheduleDisplay.dayOfWeekId, input.targetDayId),
            eq(scheduleDisplay.pairNumberId, input.targetPairId),
            eq(scheduleDisplay.unitCode, input.targetUnitCode),
            eq(scheduleDisplay.isBuffered, false),
            versionCond
          )
        );
      if (existing.length > 0) throw new TRPCError({ code: 'CONFLICT', message: 'Слот занят' });

      await ctx.db
        .update(scheduleDisplay)
        .set({
          weekId: input.targetWeekId,
          dayOfWeekId: input.targetDayId,
          pairNumberId: input.targetPairId,
          unitCode: input.targetUnitCode,
          isBuffered: false,
          positionFlag: false,
          mergeNumber: 0,
        })
        .where(and(eq(scheduleDisplay.id, input.id), versionCond));
      return { success: true };
    }),

  checkSlots: adminProcedure
    .input(
      z.object({
        movingId: z.number(),
        slots: z.array(
          z.object({
            weekId: z.number().int(),
            dayId: z.number().int(),
            pairId: z.number().int(),
            unitCode: z.string(),
          })
        ),
        versionId: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const versionCond = scheduleVersionCondition(input.versionId);
      const unitRootsCond = unitRootsVersionCondition(input.versionId);
      const lessonsCond = lessonsVersionCondition(input.versionId);
      const lcCond = lessonClassroomsVersionCondition(input.versionId);

      const moving = await ctx.db
        .select()
        .from(scheduleDisplay)
        .where(and(eq(scheduleDisplay.id, input.movingId), versionCond))
        .limit(1);
      if (!moving.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'Занятие не найдено' });
      const m = moving[0];

      // Группы перемещаемого юнита
      const movingUnitRoots = await ctx.db
        .select({ studyGroupId: unitRoots.studyGroupId })
        .from(unitRoots)
        .where(
          and(
            eq(unitRoots.unitCode, m.unitCode),
            unitRootsCond
          )
        );
      const movingGroupIds = new Set(
        movingUnitRoots.map((r) => r.studyGroupId)
      );

      // Преподаватель и аудитория перемещаемого занятия
      let mTeacherId: number | null = null;
      let mClassroomId: number | null = null;
      if (m.lessonId != null) {
        const [mTeacher, mClassroom] = await Promise.all([
          ctx.db
            .select({ teacherId: lessons.teacherId })
            .from(lessons)
            .where(and(eq(lessons.id, m.lessonId), lessonsCond))
            .limit(1),
          ctx.db
            .select({ classroomId: lessonClassrooms.classroomId })
            .from(lessonClassrooms)
            .where(
              and(
                eq(lessonClassrooms.lessonId, m.lessonId),
                lcCond
              )
            )
            .limit(1),
        ]);
        mTeacherId = mTeacher[0]?.teacherId ?? null;
        mClassroomId = mClassroom[0]?.classroomId ?? null;
      }

      const oldSlot = m.isBuffered
        ? null
        : {
            weekId: m.weekId,
            dayId: m.dayOfWeekId,
            pairId: m.pairNumberId,
            unitCode: m.unitCode,
          };

      const results: Record<string, { status: string; swapId?: number }> = {};

      for (const slot of input.slots) {
        const key = `week-${slot.weekId}-${slot.dayId}-${slot.pairId}-${slot.unitCode}`;
        // Если это исходная позиция перемещаемого занятия – всегда "free"
        if (
          !m.isBuffered &&
          m.weekId === slot.weekId &&
          m.dayOfWeekId === slot.dayId &&
          m.pairNumberId === slot.pairId &&
          m.unitCode === slot.unitCode
        ) {
          results[key] = { status: "free" };
          continue;
        }

        const allInSlot = await ctx.db
          .select()
          .from(scheduleDisplay)
          .where(
            and(
              eq(scheduleDisplay.weekId, slot.weekId),
              eq(scheduleDisplay.dayOfWeekId, slot.dayId),
              eq(scheduleDisplay.pairNumberId, slot.pairId),
              eq(scheduleDisplay.isBuffered, false),
              versionCond
            )
          );

        const others = allInSlot.filter((e) => e.id !== input.movingId);
        const sameUnitEntry =
          others.find((e) => e.unitCode === m.unitCode) ?? null;
        const differentUnitEntries = others.filter(
          (e) => e.unitCode !== m.unitCode
        );

        // Проверка прямого конфликта
        let directConflict = false;
        for (const other of differentUnitEntries) {
          const otherUnitRoots = await ctx.db
            .select({ studyGroupId: unitRoots.studyGroupId })
            .from(unitRoots)
            .where(
              and(
                eq(unitRoots.unitCode, other.unitCode),
                unitRootsCond
              )
            );
          const otherGroupIds = new Set(
            otherUnitRoots.map((r) => r.studyGroupId)
          );

          let oTeacherId: number | null = null;
          let oClassroomId: number | null = null;
          if (other.lessonId != null) {
            const [otherTeacher, otherClassroom] = await Promise.all([
              ctx.db
                .select({ teacherId: lessons.teacherId })
                .from(lessons)
                .where(and(eq(lessons.id, other.lessonId), lessonsCond))
                .limit(1),
              ctx.db
                .select({ classroomId: lessonClassrooms.classroomId })
                .from(lessonClassrooms)
                .where(
                  and(
                    eq(lessonClassrooms.lessonId, other.lessonId),
                    lcCond
                  )
                )
                .limit(1),
            ]);
            oTeacherId = otherTeacher[0]?.teacherId ?? null;
            oClassroomId = otherClassroom[0]?.classroomId ?? null;
          }

          if (
            [...movingGroupIds].some((g) => otherGroupIds.has(g)) ||
            (mTeacherId && oTeacherId && mTeacherId === oTeacherId) ||
            (mClassroomId &&
              oClassroomId &&
              mClassroomId === oClassroomId)
          ) {
            directConflict = true;
            break;
          }
        }

        if (directConflict) {
          results[key] = { status: "conflict" };
          continue;
        }

        // Если есть запись того же юнита в слоте
        if (sameUnitEntry) {
          if (m.isBuffered) {
            results[key] = { status: "conflict" };
            continue;
          }

          // Данные того же юнита
          let sTeacherId: number | null = null;
          let sClassroomId: number | null = null;
          if (sameUnitEntry.lessonId != null) {
            const [sameTeacher, sameClassroom] = await Promise.all([
              ctx.db
                .select({ teacherId: lessons.teacherId })
                .from(lessons)
                .where(
                  and(eq(lessons.id, sameUnitEntry.lessonId), lessonsCond)
                )
                .limit(1),
              ctx.db
                .select({ classroomId: lessonClassrooms.classroomId })
                .from(lessonClassrooms)
                .where(
                  and(
                    eq(lessonClassrooms.lessonId, sameUnitEntry.lessonId),
                    lcCond
                  )
                )
                .limit(1),
            ]);
            sTeacherId = sameTeacher[0]?.teacherId ?? null;
            sClassroomId = sameClassroom[0]?.classroomId ?? null;
          }

          let mDisc: number | null = null;
          let sDisc: number | null = null;
          if (m.lessonId != null) {
            [mDisc] = (
              await ctx.db
                .select({ disciplineId: lessons.disciplineId })
                .from(lessons)
                .where(and(eq(lessons.id, m.lessonId), lessonsCond))
                .limit(1)
            ).map((r) => r.disciplineId) as number[];
          }
          if (sameUnitEntry.lessonId != null) {
            [sDisc] = (
              await ctx.db
                .select({ disciplineId: lessons.disciplineId })
                .from(lessons)
                .where(
                  and(eq(lessons.id, sameUnitEntry.lessonId), lessonsCond)
                )
                .limit(1)
            ).map((r) => r.disciplineId) as number[];
          }

          // Если полностью идентичны – конфликт
          if (
            mTeacherId === sTeacherId &&
            mClassroomId === sClassroomId &&
            mDisc === sDisc
          ) {
            results[key] = { status: "conflict" };
            continue;
          }

          // Проверка обратного конфликта (при swap)
          if (oldSlot) {
            const oldSlotAll = await ctx.db
              .select()
              .from(scheduleDisplay)
              .where(
                and(
                  eq(scheduleDisplay.weekId, oldSlot.weekId!),
                  eq(scheduleDisplay.dayOfWeekId, oldSlot.dayId!),
                  eq(scheduleDisplay.pairNumberId, oldSlot.pairId!),
                  eq(scheduleDisplay.isBuffered, false),
                  versionCond
                )
              );

            const oldOthers = oldSlotAll.filter(
              (e) => e.id !== input.movingId
            );

            let reverseConflict = false;
            const sameUnitGroups = await ctx.db
              .select({ studyGroupId: unitRoots.studyGroupId })
              .from(unitRoots)
              .where(
                and(
                  eq(unitRoots.unitCode, sameUnitEntry.unitCode),
                  unitRootsCond
                )
              );
            const sameGroupIds = new Set(
              sameUnitGroups.map((r) => r.studyGroupId)
            );

            for (const oldOther of oldOthers) {
              const oldOtherUnitRoots = await ctx.db
                .select({ studyGroupId: unitRoots.studyGroupId })
                .from(unitRoots)
                .where(
                  and(
                    eq(unitRoots.unitCode, oldOther.unitCode),
                    unitRootsCond
                  )
                );
              const oldOtherGroupIds = new Set(
                oldOtherUnitRoots.map((r) => r.studyGroupId)
              );

              let ooTId: number | null = null;
              let ooCId: number | null = null;
              if (oldOther.lessonId != null) {
                const [oldOtherTeacher, oldOtherClassroom] =
                  await Promise.all([
                    ctx.db
                      .select({ teacherId: lessons.teacherId })
                      .from(lessons)
                      .where(
                        and(eq(lessons.id, oldOther.lessonId), lessonsCond)
                      )
                      .limit(1),
                    ctx.db
                      .select({ classroomId: lessonClassrooms.classroomId })
                      .from(lessonClassrooms)
                      .where(
                        and(
                          eq(lessonClassrooms.lessonId, oldOther.lessonId),
                          lcCond
                        )
                      )
                      .limit(1),
                  ]);
                ooTId = oldOtherTeacher[0]?.teacherId ?? null;
                ooCId = oldOtherClassroom[0]?.classroomId ?? null;
              }

              if (
                [...sameGroupIds].some((g) => oldOtherGroupIds.has(g)) ||
                (sTeacherId && ooTId && sTeacherId === ooTId) ||
                (sClassroomId && ooCId && sClassroomId === ooCId)
              ) {
                reverseConflict = true;
                break;
              }
            }

            results[key] = reverseConflict
              ? { status: "conflict" }
              : { status: "swap", swapId: sameUnitEntry.id };
          } else {
            results[key] = { status: "conflict" };
          }
        } else {
          results[key] = { status: "free" };
        }
      }

      return results;
    }),

  move: adminProcedure
    .input(
      z.object({
        id: z.number(),
        targetWeekId: z.number().int(),
        targetDayId: z.number().int(),
        targetPairId: z.number().int(),
        targetUnitCode: z.string(),
        versionId: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const versionCond = scheduleVersionCondition(input.versionId);

      const existing = await ctx.db
        .select()
        .from(scheduleDisplay)
        .where(
          and(
            eq(scheduleDisplay.weekId, input.targetWeekId),
            eq(scheduleDisplay.dayOfWeekId, input.targetDayId),
            eq(scheduleDisplay.pairNumberId, input.targetPairId),
            eq(scheduleDisplay.unitCode, input.targetUnitCode),
            eq(scheduleDisplay.isBuffered, false),
            versionCond
          )
        );
      if (existing.length > 0 && existing[0].id !== input.id) throw new TRPCError({ code: 'CONFLICT', message: 'Слот занят' });

      await ctx.db
        .update(scheduleDisplay)
        .set({
          weekId: input.targetWeekId,
          dayOfWeekId: input.targetDayId,
          pairNumberId: input.targetPairId,
          unitCode: input.targetUnitCode,
          positionFlag: false,
          mergeNumber: 0,
        })
        .where(
          and(eq(scheduleDisplay.id, input.id), versionCond)
        );
      return { success: true };
    }),

  swap: adminProcedure
    .input(
      z.object({
        id1: z.number(),
        id2: z.number(),
        versionId: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const versionCond = scheduleVersionCondition(input.versionId);

      const rec1 = await ctx.db
        .select()
        .from(scheduleDisplay)
        .where(and(eq(scheduleDisplay.id, input.id1), versionCond))
        .limit(1);
      const rec2 = await ctx.db
        .select()
        .from(scheduleDisplay)
        .where(and(eq(scheduleDisplay.id, input.id2), versionCond))
        .limit(1);

      const r1 = rec1[0] as typeof scheduleDisplay.$inferSelect;
      const r2 = rec2[0] as typeof scheduleDisplay.$inferSelect;

      if (r1.unitCode !== r2.unitCode)
        throw new TRPCError({ code: 'CONFLICT', message: 'Обмен между разными юнитами запрещён' });

      const slot1 = {
        weekId: r1.weekId,
        dayOfWeekId: r1.dayOfWeekId,
        pairNumberId: r1.pairNumberId,
        unitCode: r1.unitCode,
      };
      const slot2 = {
        weekId: r2.weekId,
        dayOfWeekId: r2.dayOfWeekId,
        pairNumberId: r2.pairNumberId,
        unitCode: r2.unitCode,
      };

      await Promise.all([
        ctx.db
          .update(scheduleDisplay)
          .set({ ...slot2, positionFlag: false, mergeNumber: 0 })
          .where(and(eq(scheduleDisplay.id, input.id1), versionCond)),
        ctx.db
          .update(scheduleDisplay)
          .set({ ...slot1, positionFlag: false, mergeNumber: 0 })
          .where(and(eq(scheduleDisplay.id, input.id2), versionCond)),
      ]);
      return { success: true };
    }),

  updateFlags: adminProcedure
    .input(
      z.object({
        id: z.number(),
        mergeNumber: z.number().int().optional(),
        positionFlag: z.boolean().optional(),
        classroomFlag: z.boolean().optional(),
        versionId: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, versionId, ...data } = input;
      const versionCond = scheduleVersionCondition(versionId);
      await ctx.db
        .update(scheduleDisplay)
        .set(data)
        .where(and(eq(scheduleDisplay.id, id), versionCond));
      return { success: true };
    }),

  optimizeSchedule: adminProcedure
    .input(z.object({
      versionId: z.number().nullable().optional(),
      includeBuffered: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.includeBuffered) {
        const versionCond = scheduleVersionCondition(input.versionId);
        // Снимаем буфер и сбрасываем все флаги, которые мешают перемещению
        await ctx.db
          .update(scheduleDisplay)
          .set({
            isBuffered: false,
            positionFlag: false,
            mergeNumber: 0,
            classroomFlag: false,
          })
          .where(and(eq(scheduleDisplay.isBuffered, true), versionCond));
      }
      return await optimizeSchedule(input.versionId);
    }),
    resetFlags: adminProcedure
    .input(
      z.object({
        positionFlag: z.boolean().optional(),
        classroomFlag: z.boolean().optional(),
        mergeNumber: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const setData: Record<string, boolean | number> = {};
      if (input.positionFlag) setData.positionFlag = false;
      if (input.classroomFlag) setData.classroomFlag = false;
      if (input.mergeNumber) setData.mergeNumber = 0;

      if (Object.keys(setData).length === 0) {
        return { success: true };
      }

      await ctx.db
        .update(scheduleDisplay)
        .set(setData)
        .where(
          and(
            eq(scheduleDisplay.isActive, true),
            isNull(scheduleDisplay.versionId),
            eq(scheduleDisplay.isBuffered, false)
          )
        );
      return { success: true };
    }),
});