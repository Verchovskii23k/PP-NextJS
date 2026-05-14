// src/server/trpc/routers/__tests__/generators-logic.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db";
import {
  studyGroups,
  students,
  units,
  unitRoots,
  scheduleDisplay,
  schedule,
  lessonClassrooms,
  lessons,
  securityCenter,
  employees,
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

// Группа тестов generateGroups
describe("generateGroups logic", () => {
  it("создаёт активные группы и привязывает студентов", async () => {
    await caller.generations.generateGroups();

    const groups = await db
      .select()
      .from(studyGroups)
      .where(eq(studyGroups.isActive, true));

    expect(groups.length).toBeGreaterThan(0);

    const codes = groups.map(g => g.code);
    expect(new Set(codes).size).toBe(codes.length);

    const assignedStudents = await db
      .select()
      .from(students)
      .where(eq(students.studyGroupId, groups[0].id));

    expect(assignedStudents.length).toBeGreaterThan(0);
  });

  it("при повторном запуске не создаёт дубликаты групп", async () => {
    await caller.generations.generateGroups();
    const before = await db
      .select({ cnt: count() })
      .from(studyGroups)
      .where(eq(studyGroups.isActive, true));
    const cntBefore = before[0]?.cnt ?? 0;

    await caller.generations.generateGroups();
    const after = await db
      .select({ cnt: count() })
      .from(studyGroups)
      .where(eq(studyGroups.isActive, true));
    const cntAfter = after[0]?.cnt ?? 0;

    expect(cntAfter).toBe(cntBefore);
  });
});

// Группа тестов generateUnits
describe("generateUnits logic", () => {
  it("создаёт юниты и связи unitRoots", async () => {
    await caller.generations.generateGroups();
    const result = await caller.generations.generateUnits();

    expect(result.createdUnits).toBeGreaterThan(0);
    expect(result.groups).toBeGreaterThan(0);
    expect(result.connections).toBeGreaterThan(0);

    const activeUnits = await db
      .select()
      .from(units)
      .where(and(eq(units.isActive, true), isNull(units.versionId)));

    expect(activeUnits.length).toBe(result.createdUnits);

    for (const unit of activeUnits) {
      const roots = await db
        .select()
        .from(unitRoots)
        .where(
          and(
            eq(unitRoots.unitCode, unit.code),
            eq(unitRoots.isActive, true),
            isNull(unitRoots.versionId)
          )
        );
      expect(roots.length).toBeGreaterThan(0);
    }

    const allRoots = await db
      .select()
      .from(unitRoots)
      .where(
        and(eq(unitRoots.isActive, true), isNull(unitRoots.versionId))
      );
    const activeGroupIds = (await db
      .select({ id: studyGroups.id })
      .from(studyGroups)
      .where(eq(studyGroups.isActive, true))
    ).map(g => g.id);
    for (const root of allRoots) {
      expect(activeGroupIds).toContain(root.studyGroupId);
    }
  });
});

// Группа тестов generateCredentials
describe("generateCredentials logic", () => {
  it("создаёт учётные записи сотрудникам и студентам", async () => {
    const result = await caller.generations.generateCredentials({
      securityLevel: "low",
      generateFor: ["employees", "students"],
    });

    expect(result.count).toBeGreaterThan(0);
    expect(result.credentials.length).toBe(result.count);

    for (const cred of result.credentials) {
      const [sec] = await db
        .select()
        .from(securityCenter)
        .where(eq(securityCenter.login, cred.login))
        .limit(1);
      expect(sec).toBeTruthy();
    }

    for (const cred of result.credentials) {
      if (cred.role === "Преподаватель" || cred.role === "Администратор") {
        expect(cred.login.startsWith("t_")).toBe(true);
      } else if (cred.role === "Студент") {
        expect(cred.login.startsWith("s_")).toBe(true);
      }
    }

    const updatedEmployees = await db
      .select()
      .from(employees)
      .where(isNull(employees.authenticationId));
    const updatedStudents = await db
      .select()
      .from(students)
      .where(isNull(students.authenticationId));

    expect(updatedEmployees.length).toBe(0);
    expect(updatedStudents.length).toBe(0);
  });

  it("не создаёт дубликаты при повторном запуске", async () => {
    const before = await db
      .select({ cnt: count() })
      .from(securityCenter);
    const cntBefore = before[0]?.cnt ?? 0;

    const result = await caller.generations.generateCredentials({
      securityLevel: "low",
      generateFor: ["employees", "students"],
    });

    expect(result.count).toBe(0);

    const after = await db
      .select({ cnt: count() })
      .from(securityCenter);
    const cntAfter = after[0]?.cnt ?? 0;

    expect(cntAfter).toBe(cntBefore);
  });
});

// Группа тестов версионирования
describe("версионирование (saveActive + restoreAsActive)", () => {
  let versionId: number;

  it("полный цикл генерации и сохранения версии", async () => {
    await caller.generations.generateGroups();
    await caller.generations.generateUnits();
    await caller.generations.generateLessons();
    await caller.generations.assignClassroomsAuto();
    await caller.generations.generateSchedule({ totalWeeks: 16 });

    const activeSchedule = await db
      .select({ cnt: count() })
      .from(scheduleDisplay)
      .where(and(eq(scheduleDisplay.isActive, true), isNull(scheduleDisplay.versionId)));
    expect(activeSchedule[0]?.cnt).toBeGreaterThan(0);

    const saveResult = await caller.scheduleVersions.saveActive({
      name: "Тестовая версия",
    });
    versionId = saveResult.versionId;
    expect(versionId).toBeGreaterThan(0);

    const activeAfterSave = await db
      .select({ cnt: count() })
      .from(scheduleDisplay)
      .where(and(eq(scheduleDisplay.isActive, true), isNull(scheduleDisplay.versionId)));
    expect(activeAfterSave[0]?.cnt).toBe(0);

    const archived = await db
      .select({ cnt: count() })
      .from(scheduleDisplay)
      .where(and(eq(scheduleDisplay.versionId, versionId), eq(scheduleDisplay.isActive, false)));
    expect(archived[0]?.cnt).toBeGreaterThan(0);
  });

  it("восстановление версии", async () => {
    await caller.scheduleVersions.restoreAsActive({ versionId });

    const activeAfterRestore = await db
      .select({ cnt: count() })
      .from(scheduleDisplay)
      .where(and(eq(scheduleDisplay.isActive, true), isNull(scheduleDisplay.versionId)));
    expect(activeAfterRestore[0]?.cnt).toBeGreaterThan(0);

    const stillArchived = await db
      .select({ cnt: count() })
      .from(scheduleDisplay)
      .where(eq(scheduleDisplay.versionId, versionId));
    expect(stillArchived[0]?.cnt).toBe(0);
  });
});

// Группа тестов очистки
describe("clearGeneratedData", () => {
  it("удаляет активные записи, оставляя архивные нетронутыми", async () => {
    await caller.generations.generateGroups();
    await caller.generations.generateUnits();
    await caller.generations.generateLessons();
    await caller.generations.assignClassroomsAuto();
    await caller.generations.generateSchedule({ totalWeeks: 16 });

    const { versionId: vId } = await caller.scheduleVersions.saveActive({
      name: "Для проверки очистки",
    });

    await caller.generations.resetGeneratedData();

    const tables = [scheduleDisplay, schedule, lessonClassrooms, lessons, unitRoots, units];
    for (const table of tables) {
      const activeRows = await db
        .select({ cnt: count() })
        .from(table)
        .where(and(eq(table.isActive, true), isNull(table.versionId)));
      expect(activeRows[0]?.cnt).toBe(0);
    }

    const archivedSchedule = await db
      .select({ cnt: count() })
      .from(scheduleDisplay)
      .where(and(eq(scheduleDisplay.versionId, vId), eq(scheduleDisplay.isActive, false)));
    expect(archivedSchedule[0]?.cnt).toBeGreaterThan(0);

    const activeGroups = await db
      .select({ cnt: count() })
      .from(studyGroups)
      .where(eq(studyGroups.isActive, true));
    expect(activeGroups[0]?.cnt).toBe(0);

    const assignedStudents = await db
      .select({ cnt: count() })
      .from(students)
      .where(isNull(students.studyGroupId));
    const totalStudents = await db.select({ cnt: count() }).from(students);
    expect(assignedStudents[0]?.cnt).toBe(totalStudents[0]?.cnt);
  });
});