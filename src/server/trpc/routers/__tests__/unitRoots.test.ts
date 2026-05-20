// src/server/trpc/routers/__tests__/unitRoots.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import {
  clearAllTestData,
  createTestInstitute,
  createTestDepartment,
  createTestEducation,
  createTestSpecialty,
  createTestProfile,
  createTestStudyGroup,
  createTestUnitType,
  createTestUnit,
} from '@/test/helpers';
import { TRPCError } from '@trpc/server';
import { db } from '@/db';
import { unitRoots } from '@/db/schema';
import { eq } from 'drizzle-orm';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let unitCode: string;
let studyGroupId: number;
let educationId: number;
let specId: number;

beforeAll(async () => {
  await clearAllTestData();

  const instId = await createTestInstitute();
  const deptId = await createTestDepartment(instId);
  educationId = await createTestEducation();
  specId = await createTestSpecialty(deptId);
  const profileId = await createTestProfile(specId, educationId);
  studyGroupId = await createTestStudyGroup(profileId);

  const unitTypeId = await createTestUnitType();
  const unit = await createTestUnit(unitTypeId);
  unitCode = unit.code;

  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('unitRoots CRUD', () => {
  let rootId: number;

  it('should create a unit root', async () => {
    const [row] = await caller.unitRoots.create({
      unitCode,
      studyGroupId,
    });
    expect(row).toHaveProperty('id');
    rootId = row.id;
  });

  it('should reject non-existent unit code', async () => {
    await expect(
      caller.unitRoots.create({
        unitCode: 'NON_EXISTENT',
        studyGroupId,
      })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.unitRoots.create({
        unitCode: 'NON_EXISTENT',
        studyGroupId,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('BAD_REQUEST');
        expect(e.message).toBe('Юнит с таким кодом не найден');
      }
    }
  });

  it('should reject empty unitCode', async () => {
    await expect(
      caller.unitRoots.create({ unitCode: '', studyGroupId })
    ).rejects.toThrow();
  });

  it('should list unit roots', async () => {
    const list = await caller.unitRoots.list();
    expect(list.some(r => r.id === rootId)).toBe(true);
  });

  it('should get existing unit root', async () => {
    const row = await caller.unitRoots.get({ id: rootId });
    expect(row).toMatchObject({ unitCode, studyGroupId });
  });

  it('should return null for non-existent id', async () => {
    const row = await caller.unitRoots.get({ id: 9999 });
    expect(row).toBeNull();
  });

  it('should update studyGroupId', async () => {
    // Используем существующие educationId и specId
    const newProfileId = await createTestProfile(specId, educationId, {
      name: 'Другой профиль',
      letterCode: 'д',
    });
    const newGroupId = await createTestStudyGroup(newProfileId, { code: 'NEWGRP' });

    await caller.unitRoots.update({ id: rootId, studyGroupId: newGroupId });
    const row = await caller.unitRoots.get({ id: rootId });
    expect(row?.studyGroupId).toBe(newGroupId);
  });

  it('should not fail on non-existent id update', async () => {
    await expect(
      caller.unitRoots.update({ id: 9999, studyGroupId })
    ).resolves.toBeDefined();
  });

  it('should delete existing unit root', async () => {
    await caller.unitRoots.delete({ id: rootId });
    const row = await caller.unitRoots.get({ id: rootId });
    expect(row).toBeNull();
  });

  it('should not fail on non-existent id delete', async () => {
    await expect(
      caller.unitRoots.delete({ id: 9999 })
    ).resolves.toBeDefined();
  });
});