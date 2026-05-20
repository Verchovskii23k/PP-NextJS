// src/server/trpc/routers/__tests__/institutes.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import {
  clearAllTestData,
  createTestEmployee,
  createTestDepartment,
  createTestStudyGroup,
  createTestEducation,
  createTestSpecialty,
  createTestProfile,
} from '@/test/helpers';
import { db } from '@/db';
import { institutes, departments, studyGroups } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await clearAllTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('institutes CRUD', () => {
  let instituteId: number;
  let secondInstituteId: number;
  let empId: number;
  let deptId: number;

  it('should create an institute', async () => {
    const [row] = await caller.institutes.create({
      name: 'Тестовый институт',
      universityCode: 100,
    });
    expect(row).toHaveProperty('id');
    instituteId = row.id;
  });

  it('should reject duplicate code or name', async () => {
    await expect(
      caller.institutes.create({
        name: 'Другой',
        universityCode: 100, // тот же код
      })
    ).rejects.toThrow(TRPCError);

    await expect(
      caller.institutes.create({
        name: 'Тестовый институт', // то же имя
        universityCode: 200,
      })
    ).rejects.toThrow(TRPCError);

    try {
      await caller.institutes.create({ name: 'Другой', universityCode: 100 });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
        expect(e.message).toBe('Институт с таким кодом или названием уже существует');
      }
    }
  });

  it('should reject empty name or invalid code', async () => {
    await expect(
      caller.institutes.create({ name: '', universityCode: 300 })
    ).rejects.toThrow();
    await expect(
      caller.institutes.create({ name: 'Институт', universityCode: 0 })
    ).rejects.toThrow();
  });

  it('should reject director who is a head of department', async () => {
    // Создаём сотрудника и делаем его завкафедрой
    const empId = await createTestEmployee();
    await createTestDepartment(instituteId, { headId: empId, departmentCode: 500 });

    await expect(
      caller.institutes.create({
        name: 'С директором-завкафедрой',
        universityCode: 400,
        directorId: empId,
      })
    ).rejects.toThrow(/Этот сотрудник уже является заведующим кафедрой/);
  });

  it('should reject director who is a curator', async () => {
    // Создаём сотрудника, кафедру, специальность, профиль, группу с куратором
    const empId = await createTestEmployee();
    const specDeptId = await createTestDepartment(instituteId, { departmentCode: 600 });
    const eduId = await createTestEducation();
    const specId = await createTestSpecialty(specDeptId);
    const profId = await createTestProfile(specId, eduId);
    await createTestStudyGroup(profId, { curatorId: empId });

    await expect(
      caller.institutes.create({
        name: 'С директором-куратором',
        universityCode: 700,
        directorId: empId,
      })
    ).rejects.toThrow(/Этот сотрудник уже является куратором/);
  });

  it('should list and contain created institute', async () => {
    const list = await caller.institutes.list();
    expect(list.some(i => i.id === instituteId)).toBe(true);
  });

  it('should get existing institute', async () => {
    const inst = await caller.institutes.get({ id: instituteId });
    expect(inst).toMatchObject({ name: 'Тестовый институт', universityCode: 100 });
  });

  it('should return null for non-existent id', async () => {
    const inst = await caller.institutes.get({ id: 9999 });
    expect(inst).toBeNull();
  });

  it('should update name', async () => {
    await caller.institutes.update({ id: instituteId, name: 'Обновлённый институт' });
    const inst = await caller.institutes.get({ id: instituteId });
    expect(inst?.name).toBe('Обновлённый институт');
  });

  it('should reject update to existing code or name', async () => {
    // Создаём второй институт
    const [inst2] = await caller.institutes.create({
      name: 'Второй институт',
      universityCode: 800,
    });
    secondInstituteId = inst2.id;

    await expect(
      caller.institutes.update({ id: secondInstituteId, universityCode: 100 })
    ).rejects.toThrow(TRPCError);
    await expect(
      caller.institutes.update({ id: secondInstituteId, name: 'Обновлённый институт' })
    ).rejects.toThrow(TRPCError);
  });

  it('should reject assigning director who is already director of another institute', async () => {
    // Назначаем сотрудника директором первого института
    const empId = await createTestEmployee();
    await caller.institutes.update({ id: instituteId, directorId: empId });

    // Пытаемся назначить его же во второй
    await expect(
      caller.institutes.update({ id: secondInstituteId, directorId: empId })
    ).rejects.toThrow(/Этот сотрудник уже является директором другого института/);
  });

  it('should cascade deactivation to departments', async () => {
    // Создаём кафедру, привязанную к instituteId
    deptId = await createTestDepartment(instituteId, { departmentCode: 900 });

    // Деактивируем институт
    await caller.institutes.update({ id: instituteId, isActive: false });

    const inst = await caller.institutes.get({ id: instituteId });
    expect(inst?.isActive).toBe(false);

    // Кафедра тоже должна стать неактивной
    const [dept] = await db
      .select({ isActive: departments.isActive })
      .from(departments)
      .where(eq(departments.id, deptId))
      .limit(1);
    expect(dept?.isActive).toBe(false);
  });

  it('should delete existing institute', async () => {
    await caller.institutes.delete({ id: secondInstituteId });
    const inst = await caller.institutes.get({ id: secondInstituteId });
    expect(inst).toBeNull();
  });

  it('should not fail on non-existent id delete', async () => {
    await expect(
      caller.institutes.delete({ id: 9999 })
    ).resolves.toBeDefined();
  });
});