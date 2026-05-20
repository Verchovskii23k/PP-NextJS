// src/server/trpc/routers/__tests__/educationLevels.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import { clearAllTestData } from '@/test/helpers';
import { TRPCError } from '@trpc/server';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await clearAllTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('educationLevels CRUD', () => {
  let levelId: number;
  let secondLevelId: number;

  it('should create a level', async () => {
    const [row] = await caller.educationLevels.create({
      name: 'Бакалавриат',
      abbreviation: 'БАК',
    });
    expect(row).toHaveProperty('id');
    levelId = row.id;
  });

  it('should reject duplicate name', async () => {
    await expect(
      caller.educationLevels.create({ name: 'Бакалавриат' })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.educationLevels.create({ name: 'Бакалавриат' });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
        expect(e.message).toBe('Уровень образования с таким названием уже существует');
      }
    }
  });

  it('should reject empty name', async () => {
    await expect(
      caller.educationLevels.create({ name: '' })
    ).rejects.toThrow();
  });

  it('should list and contain created level', async () => {
    const list = await caller.educationLevels.list();
    expect(list.some(l => l.id === levelId)).toBe(true);
  });

  it('should get existing level', async () => {
    const row = await caller.educationLevels.get({ id: levelId });
    expect(row).toMatchObject({ name: 'Бакалавриат', abbreviation: 'БАК' });
  });

  it('should return null for non-existent id', async () => {
    const row = await caller.educationLevels.get({ id: 9999 });
    expect(row).toBeNull();
  });

  it('should update name', async () => {
    await caller.educationLevels.update({ id: levelId, name: 'Магистратура' });
    const row = await caller.educationLevels.get({ id: levelId });
    expect(row?.name).toBe('Магистратура');
  });

  it('should reject update to existing name', async () => {
    const [row2] = await caller.educationLevels.create({ name: 'Специалитет' });
    secondLevelId = row2.id;

    await expect(
      caller.educationLevels.update({ id: levelId, name: 'Специалитет' })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.educationLevels.update({ id: levelId, name: 'Специалитет' });
    } catch (e) {
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
      }
    }
  });

  it('should reject update with empty name', async () => {
    await expect(
      caller.educationLevels.update({ id: levelId, name: '' })
    ).rejects.toThrow();
  });

  it('should not fail on non-existent id update', async () => {
    await expect(
      caller.educationLevels.update({ id: 9999, name: 'Несуществующий' })
    ).resolves.toBeDefined();
  });

  it('should delete existing level', async () => {
    await caller.educationLevels.delete({ id: secondLevelId });
    const row = await caller.educationLevels.get({ id: secondLevelId });
    expect(row).toBeNull();
  });

  it('should not fail on non-existent id delete', async () => {
    await expect(
      caller.educationLevels.delete({ id: 9999 })
    ).resolves.toBeDefined();
  });
});