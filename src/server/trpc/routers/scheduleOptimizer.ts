// src/server/trpc/routers/scheduleOptimizer.ts
import { db } from "@/db";
import {
  scheduleDisplay as sdTable,
  lessons,
  unitRoots,
  weeks,
  daysOfWeek,
  pairs,
  settings as settingsTable,
  lessonTypes,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

type SlotKey = string;
type ScheduleEntry = typeof sdTable.$inferSelect;

interface Occupancy {
  teacherIds: Set<number>;
  groupIds: Set<number>;
}

interface OptimizationContext {
  entries: ScheduleEntry[];
  slots: { weekNum: number; dayId: number; pairId: number }[];
  occupancyBySlot: Map<SlotKey, Occupancy>;
  lessonTeacher: Map<number, number>;
  unitGroups: Map<string, Set<number>>;
  lessonLessonType: Map<number, string>;
  weights: {
    teacherWindow: number;
    groupWindow: number;
    dailyBalance: number;
    typeDiversity: number

  };
  teacherSchedule: Map<number, { dayId: number; pairId: number }[]>;
  groupSchedule: Map<number, { dayId: number; pairId: number }[]>;
}

const slotKey = (w: number, d: number, p: number): SlotKey => `${w}-${d}-${p}`;

async function loadWeights(): Promise<OptimizationContext["weights"]> {
  const defaultWeights = {
    teacherWindow: 4,
    groupWindow: 8,
    dailyBalance: 5,
    typeDiversity: 10,
  };

  const keys = [
    "opt_weight_teacher_window",
    "opt_weight_group_window",
    "opt_weight_daily_balance",
    "opt_weight_type_diversity",
  ];

  // Получаем существующие настройки
  const rows = await db
    .select({ key: settingsTable.key, value: settingsTable.value })
    .from(settingsTable)
    .where(inArray(settingsTable.key, keys));

  const existingKeys = new Set(rows.map(r => r.key));
  const result: Record<string, number> = {};

  // Заполняем результатами из базы (или подставляем дефолты на случай сбоя)
  for (const key of keys) {
    const row = rows.find(r => r.key === key);
    result[key] = row ? Number(row.value) : defaultWeights[key as keyof typeof defaultWeights];
  }

  // Автоматически добавляем недостающие ключи с дефолтными значениями
  const missing = keys.filter(k => !existingKeys.has(k));
  if (missing.length > 0) {
    await db
      .insert(settingsTable)
      .values(missing.map(k => ({
        key: k,
        value: String(defaultWeights[k as keyof typeof defaultWeights]),
      })))
      .onConflictDoNothing(); // если вдруг появились в параллельной сессии
  }

  return {
    teacherWindow: result["opt_weight_teacher_window"],
    groupWindow: result["opt_weight_group_window"],
    dailyBalance: result["opt_weight_daily_balance"],
    typeDiversity: result["opt_weight_type_diversity"],
  };
}

async function buildContext(entries: ScheduleEntry[]): Promise<OptimizationContext> {
  const allLessons = await db.select().from(lessons);
  const allUnitRoots = await db.select().from(unitRoots);
  const allDays = await db.select().from(daysOfWeek).orderBy(daysOfWeek.id);
  const allPairs = await db.select().from(pairs).orderBy(pairs.number);
  const allWeeks = await db.select().from(weeks).orderBy(weeks.id);
  const lessonLessonType = new Map<number, string>();
    const allLessonTypes = await db.select().from(lessonTypes);
    const typeNameById = new Map<number, string>();
    for (const lt of allLessonTypes) typeNameById.set(lt.id, lt.name);

    for (const l of allLessons) {
    if (l.lessonTypeId) {
        lessonLessonType.set(l.id, typeNameById.get(l.lessonTypeId) ?? 'unknown');
    }
    }

  const lessonTeacher = new Map<number, number>();
  for (const l of allLessons) {
    if (l.teacherId) lessonTeacher.set(l.id, l.teacherId);
  }

  const unitGroups = new Map<string, Set<number>>();
  for (const ur of allUnitRoots) {
    if (!unitGroups.has(ur.unitCode)) unitGroups.set(ur.unitCode, new Set());
    unitGroups.get(ur.unitCode)!.add(ur.studyGroupId);
  }

  const slots: { weekNum: number; dayId: number; pairId: number }[] = [];
  for (const w of allWeeks) {
    for (const d of allDays) {
      for (const p of allPairs) {
        slots.push({ weekNum: w.id, dayId: d.id, pairId: p.id });
      }
    }
  }

  const occupancyBySlot = new Map<SlotKey, Occupancy>();
  const teacherSchedule = new Map<number, { dayId: number; pairId: number }[]>();
  const groupSchedule = new Map<number, { dayId: number; pairId: number }[]>();

  for (const e of entries) {
    const key = slotKey(e.weekNumber, e.dayOfWeekId, e.pairNumberId);
    if (!occupancyBySlot.has(key)) {
      occupancyBySlot.set(key, { teacherIds: new Set(), groupIds: new Set() });
    }
    const occ = occupancyBySlot.get(key)!;

    const teacherId = lessonTeacher.get(e.lessonId!);
    if (teacherId) {
      occ.teacherIds.add(teacherId);
      if (!teacherSchedule.has(teacherId)) teacherSchedule.set(teacherId, []);
      teacherSchedule.get(teacherId)!.push({ dayId: e.dayOfWeekId, pairId: e.pairNumberId });
    }

    const groups = unitGroups.get(e.unitCode);
    if (groups) {
      groups.forEach((g) => {
        occ.groupIds.add(g);
        if (!groupSchedule.has(g)) groupSchedule.set(g, []);
        groupSchedule.get(g)!.push({ dayId: e.dayOfWeekId, pairId: e.pairNumberId });
      });
    }
  }

  return {
    entries,
    slots,
    occupancyBySlot,
    lessonTeacher,
    unitGroups,
    weights: await loadWeights(),
    teacherSchedule,
    groupSchedule,
    lessonLessonType,
  };
}

function canMoveToSlot(
  ctx: OptimizationContext,
  entry: ScheduleEntry,
  week: number,
  dayId: number,
  pairId: number
): boolean {
  if (entry.positionFlag) return false;
  const key = slotKey(week, dayId, pairId);
  const occ = ctx.occupancyBySlot.get(key);
  if (!occ) return true;

  const teacherId = ctx.lessonTeacher.get(entry.lessonId!);
  if (teacherId && occ.teacherIds.has(teacherId)) return false;

  const groups = ctx.unitGroups.get(entry.unitCode);
  if (groups && [...groups].some((g) => occ.groupIds.has(g))) return false;

  // Упрощённая проверка иерархии юнитов: если в целевом слоте уже есть занятие того же unitCode, запрещаем
  // (это не полноценная иерархия, но предотвращает две группы одного юнита в одном слоте)
  // Можно расширить при необходимости.
  if (occ.groupIds.size > 0) {
    const entryGroups = ctx.unitGroups.get(entry.unitCode);
    if (entryGroups && [...entryGroups].some(g => occ.groupIds.has(g))) return false;
  }

  return true;
}

function updateOccupancy(
  ctx: OptimizationContext,
  entry: ScheduleEntry,
  oldWeek: number,
  oldDay: number,
  oldPair: number,
  newWeek: number,
  newDay: number,
  newPair: number
) {
  const oldKey = slotKey(oldWeek, oldDay, oldPair);
  const newKey = slotKey(newWeek, newDay, newPair);

  const oldOcc = ctx.occupancyBySlot.get(oldKey);
  if (oldOcc) {
    const teacherId = ctx.lessonTeacher.get(entry.lessonId!);
    if (teacherId) oldOcc.teacherIds.delete(teacherId);
    const groups = ctx.unitGroups.get(entry.unitCode);
    if (groups) groups.forEach((g) => oldOcc.groupIds.delete(g));
  }

  if (!ctx.occupancyBySlot.has(newKey)) {
    ctx.occupancyBySlot.set(newKey, { teacherIds: new Set(), groupIds: new Set() });
  }
  const newOcc = ctx.occupancyBySlot.get(newKey)!;
  const teacherId = ctx.lessonTeacher.get(entry.lessonId!);
  if (teacherId) newOcc.teacherIds.add(teacherId);
  const groups = ctx.unitGroups.get(entry.unitCode);
  if (groups) groups.forEach((g) => newOcc.groupIds.add(g));
}

function evaluateState(ctx: OptimizationContext): number {
  const teacherSch = new Map<number, { dayId: number; pairId: number }[]>();
  const groupSch = new Map<number, { dayId: number; pairId: number }[]>();
  for (const e of ctx.entries) {
    const tId = ctx.lessonTeacher.get(e.lessonId!);
    if (tId) {
      if (!teacherSch.has(tId)) teacherSch.set(tId, []);
      teacherSch.get(tId)!.push({ dayId: e.dayOfWeekId, pairId: e.pairNumberId });
    }
    const grps = ctx.unitGroups.get(e.unitCode);
    if (grps) {
      grps.forEach((g) => {
        if (!groupSch.has(g)) groupSch.set(g, []);
        groupSch.get(g)!.push({ dayId: e.dayOfWeekId, pairId: e.pairNumberId });
      });
    }
  }


  let score = 0;
  const { weights } = ctx;

  // Окна преподавателей
  for (const [, slots] of teacherSch) {
    const byDay = new Map<number, number[]>();
    slots.forEach((s) => {
      if (!byDay.has(s.dayId)) byDay.set(s.dayId, []);
      byDay.get(s.dayId)!.push(s.pairId);
    });
    for (const [, pairs] of byDay) {
      pairs.sort((a, b) => a - b);
      for (let i = 1; i < pairs.length; i++) {
        const gap = pairs[i] - pairs[i - 1] - 1;
        if (gap > 0) score += gap * weights.teacherWindow;
      }
    }
  }

  // Окна групп
  for (const [, slots] of groupSch) {
    const byDay = new Map<number, number[]>();
    slots.forEach((s) => {
      if (!byDay.has(s.dayId)) byDay.set(s.dayId, []);
      byDay.get(s.dayId)!.push(s.pairId);
    });
    for (const [, pairs] of byDay) {
      pairs.sort((a, b) => a - b);
      for (let i = 1; i < pairs.length; i++) {
        const gap = pairs[i] - pairs[i - 1] - 1;
        if (gap > 0) score += gap * weights.groupWindow;
      }
    }
  }

  // Дневной баланс для преподавателей
  const teacherPayPerDay = new Map<number, Map<number, number>>();
  for (const [tid, slots] of teacherSch) {
    const byDay = new Map<number, number>();
    slots.forEach(s => byDay.set(s.dayId, (byDay.get(s.dayId) || 0) + 1));
    teacherPayPerDay.set(tid, byDay);
  }
  for (const [, dayCounts] of teacherPayPerDay) {
    const counts = [...dayCounts.values()];
    if (counts.length < 2) continue;
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, c) => sum + (c - avg) ** 2, 0) / counts.length;
    score += Math.round(variance * weights.dailyBalance);
  }

  // Дневной баланс для групп
  const groupPayPerDay = new Map<number, Map<number, number>>();
  for (const [gid, slots] of groupSch) {
    const byDay = new Map<number, number>();
    slots.forEach(s => byDay.set(s.dayId, (byDay.get(s.dayId) || 0) + 1));
    groupPayPerDay.set(gid, byDay);
  }
  for (const [, dayCounts] of groupPayPerDay) {
    const counts = [...dayCounts.values()];
    if (counts.length < 2) continue;
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, c) => sum + (c - avg) ** 2, 0) / counts.length;
    score += Math.round(variance * weights.dailyBalance);
  }
// Штраф за однообразие типов (больше 3 одинаковых типов в день)
const typePenaltyPerGroup = new Map<number, Map<number, Map<string, number>>>();
for (const e of ctx.entries) {
  const lt = ctx.lessonLessonType.get(e.lessonId!);
  if (!lt) continue;
  const groups = ctx.unitGroups.get(e.unitCode);
  if (!groups) continue;
  for (const g of groups) {
    if (!typePenaltyPerGroup.has(g)) typePenaltyPerGroup.set(g, new Map());
    const dayMap = typePenaltyPerGroup.get(g)!;
    if (!dayMap.has(e.dayOfWeekId)) dayMap.set(e.dayOfWeekId, new Map());
    const typeMap = dayMap.get(e.dayOfWeekId)!;
    typeMap.set(lt, (typeMap.get(lt) || 0) + 1);
  }
}

    for (const [, dayMap] of typePenaltyPerGroup) {
    for (const [, typeCounts] of dayMap) {
        for (const [, cnt] of typeCounts) {
        if (cnt > 3) score += (cnt - 3) * weights.typeDiversity;
        }
    }
    }
  return score;
}

export async function optimizeSchedule() {
  const allEntries = await db
    .select()
    .from(sdTable)
    .where(eq(sdTable.isBuffered, false));

  console.log(`[optimize] loaded ${allEntries.length} entries`);

  if (allEntries.length < 2) {
    return { iterations: 0, initialScore: 0, finalScore: 0, message: "Слишком мало занятий" };
  }

  const ctx = await buildContext(allEntries);
  let currentScore = evaluateState(ctx);
  const initialScore = currentScore;
  let iterations = 0;
  let accepted = 0;
  const MAX_ITER = 500;

  while (iterations < MAX_ITER) {
    // Случайно выбираем оператор
    const r = Math.random();
    // 70% swap, 30% move
    if (r < 0.7) {
      // Swap двух случайных занятий
      if (ctx.entries.length < 2) { iterations++; continue; }
      const i = Math.floor(Math.random() * ctx.entries.length);
      let j = Math.floor(Math.random() * (ctx.entries.length - 1));
      if (j >= i) j++;

      const a = ctx.entries[i];
      const b = ctx.entries[j];

      if (a.positionFlag || b.positionFlag) { iterations++; continue; }
      if (!canMoveToSlot(ctx, a, b.weekNumber, b.dayOfWeekId, b.pairNumberId) ||
          !canMoveToSlot(ctx, b, a.weekNumber, a.dayOfWeekId, a.pairNumberId)) {
        iterations++;
        continue;
      }

      const oldA = { w: a.weekNumber, d: a.dayOfWeekId, p: a.pairNumberId };
      const oldB = { w: b.weekNumber, d: b.dayOfWeekId, p: b.pairNumberId };
      a.weekNumber = oldB.w; a.dayOfWeekId = oldB.d; a.pairNumberId = oldB.p;
      b.weekNumber = oldA.w; b.dayOfWeekId = oldA.d; b.pairNumberId = oldA.p;
      updateOccupancy(ctx, a, oldA.w, oldA.d, oldA.p, a.weekNumber, a.dayOfWeekId, a.pairNumberId);
      updateOccupancy(ctx, b, oldB.w, oldB.d, oldB.p, b.weekNumber, b.dayOfWeekId, b.pairNumberId);
      const newScore = evaluateState(ctx);
      if (newScore < currentScore) {
        currentScore = newScore;
        accepted++;
        console.log(`[optimize] iter ${iterations}: swap accepted, score ${currentScore}`);
      } else {
        // откат
        a.weekNumber = oldA.w; a.dayOfWeekId = oldA.d; a.pairNumberId = oldA.p;
        b.weekNumber = oldB.w; b.dayOfWeekId = oldB.d; b.pairNumberId = oldB.p;
        updateOccupancy(ctx, a, a.weekNumber, a.dayOfWeekId, a.pairNumberId, oldA.w, oldA.d, oldA.p);
        updateOccupancy(ctx, b, b.weekNumber, b.dayOfWeekId, b.pairNumberId, oldB.w, oldB.d, oldB.p);
      }
    } else {
      // Move: берём случайное занятие и случайный свободный слот
      if (ctx.slots.length === 0) { iterations++; continue; }
      const entryIdx = Math.floor(Math.random() * ctx.entries.length);
      const entry = ctx.entries[entryIdx];
      if (entry.positionFlag) { iterations++; continue; }

      const slotIdx = Math.floor(Math.random() * ctx.slots.length);
      const targetSlot = ctx.slots[slotIdx];
      // Проверяем, свободен ли слот (without entry)
      if (!canMoveToSlot(ctx, entry, targetSlot.weekNum, targetSlot.dayId, targetSlot.pairId)) {
        iterations++;
        continue;
      }
      // Проверяем, что это другой слот
      if (entry.weekNumber === targetSlot.weekNum &&
          entry.dayOfWeekId === targetSlot.dayId &&
          entry.pairNumberId === targetSlot.pairId) {
        iterations++;
        continue;
      }

      const oldW = entry.weekNumber, oldD = entry.dayOfWeekId, oldP = entry.pairNumberId;
      entry.weekNumber = targetSlot.weekNum;
      entry.dayOfWeekId = targetSlot.dayId;
      entry.pairNumberId = targetSlot.pairId;
      updateOccupancy(ctx, entry, oldW, oldD, oldP, targetSlot.weekNum, targetSlot.dayId, targetSlot.pairId);
      const newScore = evaluateState(ctx);
      if (newScore < currentScore) {
        currentScore = newScore;
        accepted++;
        console.log(`[optimize] iter ${iterations}: move accepted, score ${currentScore}`);
      } else {
        // откат
        entry.weekNumber = oldW; entry.dayOfWeekId = oldD; entry.pairNumberId = oldP;
        updateOccupancy(ctx, entry, targetSlot.weekNum, targetSlot.dayId, targetSlot.pairId, oldW, oldD, oldP);
      }
    }
    iterations++;
  }

  console.log(`[optimize] finished: ${iterations} iters, ${accepted} accepted, score ${initialScore} -> ${currentScore}`);

  if (accepted > 0) {
    await db.transaction(async (tx) => {
      await tx.delete(sdTable).where(eq(sdTable.isBuffered, false));
      if (ctx.entries.length > 0) {
        // Удаляем id, чтобы не было конфликта автоинкремента
        await tx.insert(sdTable).values(ctx.entries.map(({ id, ...rest }) => rest as any));
      }
    });
  }

  return { iterations, initialScore, finalScore: currentScore };
}