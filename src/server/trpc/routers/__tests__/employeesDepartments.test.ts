// src/server/trpc/routers/__tests__/employeesDepartments.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import {
  clearAllTestData,
  createTestInstitute,
  createTestDepartment,
  createTestEmployee,
  createTestEmploymentType,
  createTestPosition,
} from '@/test/helpers';
import { TRPCError } from '@trpc/server';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let deptAId: number;
let deptBId: number;
let empAId: number;
let empBId: number;
let employmentTypeId: number;
let positionId: number;

beforeAll(async () => {
  await clearAllTestData();

  const instId = await createTestInstitute();
  deptAId = await createTestDepartment(instId, { name: 'Кафедра А', abbreviation: 'КА', departmentCode: 100 });
  deptBId = await createTestDepartment(instId, { name: 'Кафедра Б', abbreviation: 'КБ', departmentCode: 200 });
  empAId = await createTestEmployee({ surname: 'Сотрудник', name: 'А', isActive: true });
  empBId = await createTestEmployee({ surname: 'Сотрудник', name: 'Б', isActive: true });
  employmentTypeId = await createTestEmploymentType();
  positionId = await createTestPosition();

  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('employeesDepartments CRUD', () => {
  let linkId: number;
  let link2Id: number;

  it('should create a link', async () => {
    const [row] = await caller.employeesDepartments.create({
      employeeId: empAId,
      departmentId: deptAId,
      employmentTypeId,
      positionId,
    });
    expect(row).toHaveProperty('id');
    linkId = row.id;
  });

  it('should reject duplicate employee+department', async () => {
    await expect(
      caller.employeesDepartments.create({
        employeeId: empAId,
        departmentId: deptAId,
      })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.employeesDepartments.create({
        employeeId: empAId,
        departmentId: deptAId,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
        expect(e.message).toBe('Этот сотрудник уже привязан к этой кафедре');
      }
    }
  });

  it('should reject missing required fields', async () => {
    await expect(
      (caller.employeesDepartments.create as unknown as (data: Record<string, unknown>) => Promise<unknown>)({ employeeId: empAId })
    ).rejects.toThrow();
    await expect(
      (caller.employeesDepartments.create as unknown as (data: Record<string, unknown>) => Promise<unknown>)({ departmentId: deptAId })
    ).rejects.toThrow();
  });

  it('should list all links (and filtered by departmentId/instituteId)', async () => {
    const list = await caller.employeesDepartments.list();
    expect(list.some(l => l.id === linkId)).toBe(true);

    // фильтр по кафедре
    const byDept = await caller.employeesDepartments.list({ departmentId: deptAId });
    expect(byDept.some(l => l.id === linkId)).toBe(true);

    // фильтр по институту
    const byInst = await caller.employeesDepartments.list({ instituteId: 1 }); // id института из createTestInstitute
    expect(byInst.some(l => l.id === linkId)).toBe(true);
  });

  it('should get existing link with display fields', async () => {
    const row = await caller.employeesDepartments.get({ id: linkId });
    expect(row).toMatchObject({
      employeeId: empAId,
      departmentId: deptAId,
      employmentTypeId,
      positionId,
    });
    expect(row?.display).toBeDefined();
    expect(row?.employmentTypeDisplay).toBe('Основная');
    expect(row?.positionDisplay).toBe('Доцент');
  });

  it('should return null for non-existent id', async () => {
    const row = await caller.employeesDepartments.get({ id: 9999 });
    expect(row).toBeNull();
  });

  it('should update employmentTypeId', async () => {
    const newTypeId = await createTestEmploymentType({ name: 'Совместитель', abbreviation: 'СОВМ' });
    await caller.employeesDepartments.update({ id: linkId, employmentTypeId: newTypeId });
    const row = await caller.employeesDepartments.get({ id: linkId });
    expect(row?.employmentTypeId).toBe(newTypeId);
  });

  it('should reject update to duplicate pair', async () => {
    // Создадим вторую связь
    const [row2] = await caller.employeesDepartments.create({
      employeeId: empBId,
      departmentId: deptBId,
    });
    link2Id = row2.id;

    // Попробуем обновить link2 на пару (empA, deptA), которая уже есть
    await expect(
      caller.employeesDepartments.update({
        id: link2Id,
        employeeId: empAId,
        departmentId: deptAId,
      })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.employeesDepartments.update({
        id: link2Id,
        employeeId: empAId,
        departmentId: deptAId,
      });
    } catch (e) {
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
      }
    }
  });

  it('should not fail on non-existent id update', async () => {
    await expect(
      caller.employeesDepartments.update({ id: 9999, isActive: false })
    ).resolves.toBeDefined();
  });

  it('should delete existing link', async () => {
    await caller.employeesDepartments.delete({ id: link2Id });
    const row = await caller.employeesDepartments.get({ id: link2Id });
    expect(row).toBeNull();
  });

  it('should not fail on non-existent id delete', async () => {
    await expect(
      caller.employeesDepartments.delete({ id: 9999 })
    ).resolves.toBeDefined();
  });
});