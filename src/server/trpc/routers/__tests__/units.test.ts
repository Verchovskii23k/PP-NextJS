import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import {
  clearAllTestData,
  createTestUnitType,
} from '@/test/helpers';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let unitTypeId: number;

beforeAll(async () => {
  await clearAllTestData();
  unitTypeId = await createTestUnitType();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('units CRUD', () => {
  let unitId: number;

  it('should create a unit', async () => {
    const [row] = await caller.units.create({
      code: 'TEST-UNIT',
      unitTypeId,
    });
    expect(row).toHaveProperty('id');
    unitId = row.id;
  });

  it('should reject empty code', async () => {
    await expect(
      caller.units.create({ code: '', unitTypeId })
    ).rejects.toThrow();
  });

  it('should list units with display field', async () => {
    const list = await caller.units.list();
    expect(list.some(u => u.id === unitId)).toBe(true);
    const created = list.find(u => u.id === unitId);
    expect(created?.display).toBeDefined();
    expect(created?.display).toContain('TEST-UNIT');
  });

  it('should get existing unit with display', async () => {
    const row = await caller.units.get({ id: unitId });
    expect(row).toMatchObject({ code: 'TEST-UNIT', unitTypeId });
    expect(row?.display).toBeDefined();
  });

  it('should return null for non-existent id', async () => {
    const row = await caller.units.get({ id: 9999 });
    expect(row).toBeNull();
  });

  it('should update code', async () => {
    await caller.units.update({ id: unitId, code: 'UPDATED-UNIT' });
    const row = await caller.units.get({ id: unitId });
    expect(row?.code).toBe('UPDATED-UNIT');
  });

  it('should reject update with empty code', async () => {
    await expect(
      caller.units.update({ id: unitId, code: '' })
    ).rejects.toThrow();
  });

  it('should not fail on non-existent id update', async () => {
    await expect(
      caller.units.update({ id: 9999, code: 'GHOST' })
    ).resolves.toBeDefined();
  });

  it('should delete existing unit', async () => {
    await caller.units.delete({ id: unitId });
    const row = await caller.units.get({ id: unitId });
    expect(row).toBeNull();
  });

  it('should not fail on non-existent id delete', async () => {
    await expect(
      caller.units.delete({ id: 9999 })
    ).resolves.toBeDefined();
  });
});