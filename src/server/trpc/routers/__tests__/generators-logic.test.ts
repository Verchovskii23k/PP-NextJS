// src/server/trpc/routers/__tests__/generators-logic.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db";
import {
  studyGroups, students, units, unitRoots,
  scheduleDisplay, schedule, lessonClassrooms, lessons,
  securityCenter, employees,
} from "@/db/schema";
import { eq, and, isNull, count } from "drizzle-orm";
import { createTestCaller } from "@/test/trpc";
import { seedTestData, clearDatabase } from "@/test/fixtures/fixtures";

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await clearDatabase();
  await seedTestData();
  caller = await createTestCaller({ id: 1, role: "admin" });
});

afterAll(async () => {
  await clearDatabase();
});

describe("generateGroups logic", () => {
  it("создаёт активные группы и привязывает студентов", async () => {
    await caller.generations.generateGroups();
    const groups = await db.select().from(studyGroups).where(eq(studyGroups.isActive, true));
    expect(groups.length).toBeGreaterThan(0);
    expect(new Set(groups.map(g => g.code)).size).toBe(groups.length);
    const assigned = await db.select().from(students).where(eq(students.studyGroupId, groups[0].id));
    expect(assigned.length).toBeGreaterThan(0);
  });

  it("при повторном запуске не создаёт дубликаты групп", async () => {
    await caller.generations.generateGroups();
    const cntBefore = (await db.select({ cnt: count() }).from(studyGroups).where(eq(studyGroups.isActive, true)))[0]?.cnt ?? 0;
    await caller.generations.generateGroups();
    const cntAfter = (await db.select({ cnt: count() }).from(studyGroups).where(eq(studyGroups.isActive, true)))[0]?.cnt ?? 0;
    expect(cntAfter).toBe(cntBefore);
  });
});

describe("generateUnits logic", () => {
  it("создаёт юниты и связи unitRoots", async () => {
    await caller.generations.generateGroups();
    const result = await caller.generations.generateUnits();
    expect(result.createdUnits).toBeGreaterThan(0);
    expect(result.groups).toBeGreaterThan(0);
    const activeUnits = await db.select().from(units).where(and(eq(units.isActive, true), isNull(units.versionId)));
    expect(activeUnits.length).toBe(result.createdUnits);
    for (const unit of activeUnits) {
      const roots = await db.select().from(unitRoots).where(and(eq(unitRoots.unitCode, unit.code), eq(unitRoots.isActive, true), isNull(unitRoots.versionId)));
      expect(roots.length).toBeGreaterThan(0);
    }
    const allRoots = await db.select().from(unitRoots).where(and(eq(unitRoots.isActive, true), isNull(unitRoots.versionId)));
    const activeGroupIds = (await db.select({ id: studyGroups.id }).from(studyGroups).where(eq(studyGroups.isActive, true))).map(g => g.id);
    for (const root of allRoots) {
      expect(activeGroupIds).toContain(root.studyGroupId);
    }
  });
});

describe("generateCredentials logic", () => {
  it("создаёт учётные записи сотрудникам и студентам", async () => {
    const result = await caller.generations.generateCredentials({ securityLevel: "low", generateFor: ["employees", "students"] });
    expect(result.count).toBeGreaterThan(0);
    expect(result.credentials.length).toBe(result.count);
    for (const cred of result.credentials) {
      const [sec] = await db.select().from(securityCenter).where(eq(securityCenter.login, cred.login)).limit(1);
      expect(sec).toBeTruthy();
      if (cred.role === "Преподаватель" || cred.role === "Администратор") expect(cred.login.startsWith("t_")).toBe(true);
      else if (cred.role === "Студент") expect(cred.login.startsWith("s_")).toBe(true);
    }
    const noAuthEmployees = await db.select().from(employees).where(isNull(employees.authenticationId));
    const noAuthStudents = await db.select().from(students).where(isNull(students.authenticationId));
    expect(noAuthEmployees.length).toBe(0);
    expect(noAuthStudents.length).toBe(0);
  });

  it("не создаёт дубликаты при повторном запуске", async () => {
    const cntBefore = (await db.select({ cnt: count() }).from(securityCenter))[0]?.cnt ?? 0;
    const result = await caller.generations.generateCredentials({ securityLevel: "low", generateFor: ["employees", "students"] });
    expect(result.count).toBe(0);
    const cntAfter = (await db.select({ cnt: count() }).from(securityCenter))[0]?.cnt ?? 0;
    expect(cntAfter).toBe(cntBefore);
  });
});

describe("версионирование (saveActive + restoreAsActive)", () => {
  let versionId: number;

  it("полный цикл генерации и сохранения версии", async () => {
    await caller.generations.generateGroups();
    await caller.generations.generateUnits();
    await caller.generations.generateLessons();
    await caller.generations.assignClassroomsAuto();
    await caller.generations.generateSchedule({ totalWeeks: 16 });

    const activeCnt = (await db.select({ cnt: count() }).from(scheduleDisplay).where(and(eq(scheduleDisplay.isActive, true), isNull(scheduleDisplay.versionId))))[0]?.cnt ?? 0;
    expect(activeCnt).toBeGreaterThan(0);

    const saveResult = await caller.scheduleVersions.saveActive({ name: "Тестовая версия" });
    versionId = saveResult.versionId;
    expect(versionId).toBeGreaterThan(0);

    const activeAfter = (await db.select({ cnt: count() }).from(scheduleDisplay).where(and(eq(scheduleDisplay.isActive, true), isNull(scheduleDisplay.versionId))))[0]?.cnt ?? 0;
    expect(activeAfter).toBe(0);

    const archivedCnt = (await db.select({ cnt: count() }).from(scheduleDisplay).where(and(eq(scheduleDisplay.versionId, versionId), eq(scheduleDisplay.isActive, false))))[0]?.cnt ?? 0;
    expect(archivedCnt).toBeGreaterThan(0);
  });

  it("восстановление версии", async () => {
    await caller.scheduleVersions.restoreAsActive({ versionId });
    const activeCnt = (await db.select({ cnt: count() }).from(scheduleDisplay).where(and(eq(scheduleDisplay.isActive, true), isNull(scheduleDisplay.versionId))))[0]?.cnt ?? 0;
    expect(activeCnt).toBeGreaterThan(0);
    const stillArchived = (await db.select({ cnt: count() }).from(scheduleDisplay).where(eq(scheduleDisplay.versionId, versionId)))[0]?.cnt ?? 0;
    expect(stillArchived).toBe(0);
  });
});

describe("clearGeneratedData", () => {
  it("удаляет активные записи, оставляя архивные нетронутыми", async () => {
    await caller.generations.generateGroups();
    await caller.generations.generateUnits();
    await caller.generations.generateLessons();
    await caller.generations.assignClassroomsAuto();
    await caller.generations.generateSchedule({ totalWeeks: 16 });
    const { versionId: vId } = await caller.scheduleVersions.saveActive({ name: "Для проверки очистки" });
    await caller.generations.resetGeneratedData();
    const tables = [scheduleDisplay, schedule, lessonClassrooms, lessons, unitRoots, units];
    for (const table of tables) {
      const cnt = (await db.select({ cnt: count() }).from(table).where(and(eq(table.isActive, true), isNull(table.versionId))))[0]?.cnt ?? 0;
      expect(cnt).toBe(0);
    }
    const archivedCnt = (await db.select({ cnt: count() }).from(scheduleDisplay).where(and(eq(scheduleDisplay.versionId, vId), eq(scheduleDisplay.isActive, false))))[0]?.cnt ?? 0;
    expect(archivedCnt).toBeGreaterThan(0);
    const activeGroups = (await db.select({ cnt: count() }).from(studyGroups).where(eq(studyGroups.isActive, true)))[0]?.cnt ?? 0;
    expect(activeGroups).toBe(0);
    const assignedStudents = (await db.select({ cnt: count() }).from(students).where(isNull(students.studyGroupId)))[0]?.cnt ?? 0;
    const totalStudents = (await db.select({ cnt: count() }).from(students))[0]?.cnt ?? 0;
    expect(assignedStudents).toBe(totalStudents);
  });
});

describe("generateLessons logic", () => {
  it("создаёт занятия после групп и юнитов", async () => {
    await caller.generations.generateGroups();
    await caller.generations.generateUnits();
    const result = await caller.generations.generateLessons();
    expect(Number(result.lessonsCreated)).toBeGreaterThan(0);
    const activeLessons = await db.select().from(lessons).where(and(eq(lessons.isActive, true), isNull(lessons.versionId)));
    expect(activeLessons.length).toBe(Number(result.lessonsCreated));
    for (const lesson of activeLessons) {
      expect(lesson.teacherId).not.toBeNull();
    }
  });
});

describe("assignClassrooms logic", () => {
  it("назначает аудитории для всех активных занятий", async () => {
    await caller.generations.generateGroups();
    await caller.generations.generateUnits();
    await caller.generations.generateLessons();
    const assignResult = await caller.generations.assignClassroomsAuto();
    expect(assignResult.assignedClassrooms).toBeGreaterThan(0);
    const activeLessons = await db.select().from(lessons).where(and(eq(lessons.isActive, true), isNull(lessons.versionId)));
    for (const lesson of activeLessons) {
      const link = await db.select().from(lessonClassrooms).where(and(eq(lessonClassrooms.lessonId, lesson.id), eq(lessonClassrooms.isActive, true), isNull(lessonClassrooms.versionId)));
      expect(link.length).toBeGreaterThan(0);
    }
  });
});

describe("generateSchedule logic", () => {
  it("создаёт расписание без конфликтов", async () => {
    await caller.generations.generateGroups();
    await caller.generations.generateUnits();
    await caller.generations.generateLessons();
    await caller.generations.assignClassroomsAuto();

    const scheduleResult = await caller.generations.generateSchedule({ totalWeeks: 16 });
    expect(scheduleResult.totalSlots).toBeGreaterThan(0);

    const displayRows = await db
      .select()
      .from(scheduleDisplay)
      .where(and(eq(scheduleDisplay.isActive, true), isNull(scheduleDisplay.versionId)));

    expect(displayRows.length).toBeGreaterThan(0);

    // Проверка на дублирование преподавателей в одном слоте
    const teacherSlots = new Map<string, Set<number>>();
    for (const row of displayRows) {
      if (!row.lessonId) continue;
      const [lesson] = await db
        .select({ teacherId: lessons.teacherId })
        .from(lessons)
        .where(eq(lessons.id, row.lessonId))
        .limit(1);
      if (!lesson?.teacherId) continue;

      const slotKey = `${row.weekId}-${row.dayOfWeekId}-${row.pairNumberId}`;
      const key = `${slotKey}-t${lesson.teacherId}`;
      if (teacherSlots.has(key)) {
        throw new Error(`Обнаружен дубликат преподавателя ${lesson.teacherId} в слоте ${slotKey}`);
      }
      teacherSlots.set(key, new Set());
    }
  });
});