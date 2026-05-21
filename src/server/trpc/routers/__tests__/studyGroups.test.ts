// src/server/trpc/routers/__tests__/studyGroups.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import {
  clearAllTestData,
  createTestInstitute,
  createTestDepartment,
  createTestEducation,
  createTestSpecialty,
  createTestProfile,
  createTestEmployee,
  createTestEmployeeDepartment,
} from '@/test/helpers';
import { db } from '@/db';
import { institutes, departments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let profileId: number;
let deptId: number;
let empId: number;           // сотрудник, привязанный к кафедре deptId
let otherDeptId: number;     // другая кафедра
let otherEmpId: number;      // сотрудник другой кафедры

beforeAll(async () => {
  await clearAllTestData();

  const instId = await createTestInstitute();
  deptId = await createTestDepartment(instId, { abbreviation: 'ТК-1', departmentCode: 100 });
  otherDeptId = await createTestDepartment(instId, { abbreviation: 'ТК-2', departmentCode: 200 });
  const eduId = await createTestEducation();
  const specId = await createTestSpecialty(deptId);
  profileId = await createTestProfile(specId, eduId);

  // Сотрудник нашей кафедры
  empId = await createTestEmployee({ surname: 'Сотрудник', name: 'Наш', isActive: true });
  await createTestEmployeeDepartment(empId, deptId);

  // Сотрудник другой кафедры
  otherEmpId = await createTestEmployee({ surname: 'Сотрудник', name: 'Чужой', isActive: true });
  await createTestEmployeeDepartment(otherEmpId, otherDeptId);

  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('studyGroups CRUD', () => {
  let groupId: number;
  let secondGroupId: number;

  it('should create a study group without curator', async () => {
    const [row] = await caller.studyGroups.create({
      code: 'TEST-1',
      profileId,
      course: 3,
      studentCount: 10,
    });
    expect(row).toHaveProperty('id');
    groupId = row.id;
  });

  it('should reject duplicate code', async () => {
    await expect(
      caller.studyGroups.create({
        code: 'TEST-1',
        profileId,
        course: 2,
        studentCount: 5,
      })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.studyGroups.create({
        code: 'TEST-1',
        profileId,
        course: 2,
        studentCount: 5,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
        expect(e.message).toBe('Группа с таким кодом уже существует');
      }
    }
  });

  it('should reject empty code', async () => {
    await expect(
      caller.studyGroups.create({
        code: '',
        profileId,
        course: 1,
        studentCount: 1,
      })
    ).rejects.toThrow();
  });

  it('should list groups with display fields', async () => {
    const list = await caller.studyGroups.list();
    expect(list.some(g => g.id === groupId)).toBe(true);
    const created = list.find(g => g.id === groupId);
    expect(created?.display).toBeDefined();
    expect(created?.curatorDisplay).toBeNull(); // куратора нет
  });

  it('should get existing group with display', async () => {
    const row = await caller.studyGroups.get({ id: groupId });
    expect(row).toMatchObject({
      code: 'TEST-1',
      profileId,
      course: 3,
      studentCount: 10,
    });
    expect(row?.display).toBeDefined();
    expect(row?.curatorDisplay).toBeNull();
  });

  it('should return null for non-existent id', async () => {
    const row = await caller.studyGroups.get({ id: 9999 });
    expect(row).toBeNull();
  });

  it('should update studentCount (passing all mandatory fields)', async () => {
    // Теперь все поля кроме куратора обязательны
    await caller.studyGroups.update({
      id: groupId,
      code: 'TEST-1',          // обязательное поле
      profileId,                // обязательное
      course: 3,                // обязательное
      studentCount: 20,         // меняем
    });
    const row = await caller.studyGroups.get({ id: groupId });
    expect(row?.studentCount).toBe(20);
  });

  it('should reject update with missing mandatory fields', async () => {
    // Пытаемся обновить только studentCount, но без кода и профиля – Zod ошибка
    await expect(
      (caller.studyGroups.update as unknown as (data: Record<string, unknown>) => Promise<unknown>)({ id: groupId, studentCount: 5 })
    ).rejects.toThrow();
  });

  it('should reject update to existing code', async () => {
    // Создаём вторую группу
    const [row2] = await caller.studyGroups.create({
      code: 'TEST-2',
      profileId,
      course: 1,
      studentCount: 5,
    });
    secondGroupId = row2.id;

    // Пытаемся обновить вторую группу на код 'TEST-1'
    await expect(
      caller.studyGroups.update({
        id: secondGroupId,
        code: 'TEST-1',
        profileId,
        course: 1,
        studentCount: 5,
      })
    ).rejects.toThrow(TRPCError);
  });

  it('should reject curator who is a director', async () => {
    const directorId = await createTestEmployee({ surname: 'Директор', name: 'Иван' });
    await db.update(institutes)
      .set({ directorId })
      .where(eq(institutes.id, 1));

    await expect(
      caller.studyGroups.create({
        code: 'TEST-DIR',
        profileId,
        course: 1,
        studentCount: 5,
        curatorId: directorId,
      })
    ).rejects.toThrow(/Этот сотрудник уже является директором института/);
  });

  it('should reject curator who is a head of department', async () => {
    const headId = await createTestEmployee({ surname: 'Зав', name: 'Кафедрой' });
    await db.update(departments)
      .set({ headId })
      .where(eq(departments.id, deptId));

    await expect(
      caller.studyGroups.create({
        code: 'TEST-HEAD',
        profileId,
        course: 1,
        studentCount: 5,
        curatorId: headId,
      })
    ).rejects.toThrow(/Этот сотрудник уже является заведующим кафедрой/);
  });

  it('should reject curator not working at profile department', async () => {
    await expect(
      caller.studyGroups.create({
        code: 'TEST-WRONG',
        profileId,
        course: 1,
        studentCount: 5,
        curatorId: otherEmpId,
      })
    ).rejects.toThrow(/Выбранный куратор не работает на кафедре этого профиля/);
  });

  it('should reject curator who is already curator of another group', async () => {
    // Создаём группу с куратором empId
    await caller.studyGroups.create({
      code: 'TEST-CUR1',
      profileId,
      course: 1,
      studentCount: 5,
      curatorId: empId,
    });

    // Пытаемся создать ещё одну группу с тем же куратором – теперь должно быть отклонено
    await expect(
      caller.studyGroups.create({
        code: 'TEST-CUR2',
        profileId,
        course: 2,
        studentCount: 5,
        curatorId: empId,
      })
    ).rejects.toThrow(/Этот сотрудник уже является куратором другой группы/);
  });

  it('should delete existing group', async () => {
    await caller.studyGroups.delete({ id: secondGroupId });
    const row = await caller.studyGroups.get({ id: secondGroupId });
    expect(row).toBeNull();
  });

  it('should not fail on non-existent id delete', async () => {
    await expect(
      caller.studyGroups.delete({ id: 9999 })
    ).resolves.toBeDefined();
  });
});