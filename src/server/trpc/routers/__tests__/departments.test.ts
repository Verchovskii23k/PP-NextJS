// src/server/trpc/routers/__tests__/departments.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import { 
  clearAllTestData, 
  createTestInstitute, 
  createTestDepartment,
  createTestEmployee,
  createTestStudyGroup,
  createTestEducation,
  createTestSpecialty,
  createTestProfile,
  createTestEmployeeDepartment,
} from '@/test/helpers';
import { TRPCError } from '@trpc/server';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let instituteId: number;

beforeAll(async () => {
  await clearAllTestData();
  instituteId = await createTestInstitute();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('departments CRUD', () => {
  let deptId: number;
  let secondDeptId: number;

  it('should create a department', async () => {
    const [dept] = await caller.departments.create({
      name: 'Тестовая кафедра',
      abbreviation: 'ТК',
      instituteId,
      departmentCode: 100,
    });
    expect(dept).toHaveProperty('id');
    deptId = dept.id;
  });

  it('should reject duplicate departmentCode', async () => {
    await expect(
      caller.departments.create({
        name: 'Другая',
        abbreviation: 'ДР',
        instituteId,
        departmentCode: 100,
      })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.departments.create({
        name: 'Другая',
        abbreviation: 'ДР',
        instituteId,
        departmentCode: 100,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
        expect(e.message).toBe('Кафедра с таким кодом уже существует');
      }
    }
  });

  it('should reject empty name or abbreviation', async () => {
    await expect(
      caller.departments.create({
        name: '',
        abbreviation: 'Т',
        instituteId,
        departmentCode: 200,
      })
    ).rejects.toThrow();
    await expect(
      caller.departments.create({
        name: 'Имя',
        abbreviation: '',
        instituteId,
        departmentCode: 201,
      })
    ).rejects.toThrow();
  });

  it('should list and contain created department', async () => {
    const list = await caller.departments.list();
    expect(list.some(d => d.id === deptId)).toBe(true);
  });

  it('should get existing department', async () => {
    const dept = await caller.departments.get({ id: deptId });
    expect(dept).toMatchObject({
      name: 'Тестовая кафедра',
      abbreviation: 'ТК',
      departmentCode: 100,
    });
  });

  it('should return null for non-existent id', async () => {
    const dept = await caller.departments.get({ id: 9999 });
    expect(dept).toBeNull();
  });

  it('should update fields', async () => {
    await caller.departments.update({ id: deptId, name: 'Обновлённая' });
    const dept = await caller.departments.get({ id: deptId });
    expect(dept?.name).toBe('Обновлённая');
  });

  it('should reject update to duplicate departmentCode', async () => {
    // Создаём вторую кафедру
    const [dept2] = await caller.departments.create({
      name: 'Вторая',
      abbreviation: 'ВТ',
      instituteId,
      departmentCode: 300,
    });
    secondDeptId = dept2.id;

    await expect(
      caller.departments.update({ id: secondDeptId, departmentCode: 100 })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.departments.update({ id: secondDeptId, departmentCode: 100 });
    } catch (e) {
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
      }
    }
  });

  it('should reject update with empty name', async () => {
    await expect(
      caller.departments.update({ id: deptId, name: '' })
    ).rejects.toThrow();
  });

  it('should reject assigning a head who is already a director', async () => {
    // Создаём сотрудника и делаем его директором института
    const empId = await createTestEmployee();
    await caller.institutes.update({ id: instituteId, directorId: empId });

    await expect(
      caller.departments.create({
        name: 'Кафедра с директором',
        abbreviation: 'ДИР',
        instituteId,
        departmentCode: 400,
        headId: empId,
      })
    ).rejects.toThrow(/Этот сотрудник уже является директором института/);
  });

  it('should reject assigning a head who is already a curator', async () => {
    // Создаём сотрудника и группу, назначаем куратора
    const empId = await createTestEmployee();
    const eduId = await createTestEducation();
    const specId = await createTestSpecialty(deptId); // нужна специальность с deptId, но у нас deptId уже есть
    const profId = await createTestProfile(specId, eduId);
    await createTestStudyGroup(profId, { curatorId: empId });

    await expect(
      caller.departments.create({
        name: 'Кафедра с куратором',
        abbreviation: 'КУР',
        instituteId,
        departmentCode: 500,
        headId: empId,
      })
    ).rejects.toThrow(/Этот сотрудник уже является куратором/);
  });

  it('should reject assigning a head who is already head of another department', async () => {
    // Создаём сотрудника, назначаем заведующим второй кафедры
    const empId = await createTestEmployee();
    await caller.departments.update({ id: deptId, headId: empId });

    await expect(
      caller.departments.create({
        name: 'Третья',
        abbreviation: 'ТР',
        instituteId,
        departmentCode: 600,
        headId: empId,
      })
    ).rejects.toThrow(/Этот сотрудник уже является заведующим другой кафедрой/);
  });

  it('should delete existing department', async () => {
    await caller.departments.delete({ id: secondDeptId });
    const dept = await caller.departments.get({ id: secondDeptId });
    expect(dept).toBeNull();
  });

  it('should not fail on non-existent id delete', async () => {
    await expect(
      caller.departments.delete({ id: 9999 })
    ).resolves.toBeDefined();
  });
});