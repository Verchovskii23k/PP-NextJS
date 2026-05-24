import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import { clearAllTestData } from '@/test/helpers';
import { TRPCError } from '@trpc/server';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await clearAllTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('positions CRUD', () => {
  let posId: number;
  let secondPosId: number;

  it('should create a position', async () => {
    const [row] = await caller.positions.create({
      name: 'Доцент',
      abbreviation: 'доц',
    });
    expect(row).toHaveProperty('id');
    posId = row.id;
  });

  it('should reject duplicate name', async () => {
    await expect(
      caller.positions.create({ name: 'Доцент' })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.positions.create({ name: 'Доцент' });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
        expect(e.message).toBe('Должность с таким названием уже существует');
      }
    }
  });

  it('should reject empty name', async () => {
    await expect(
      caller.positions.create({ name: '' })
    ).rejects.toThrow();
  });

  it('should list and contain created position', async () => {
    const list = await caller.positions.list();
    expect(list.some(p => p.id === posId)).toBe(true);
  });

  it('should get existing position', async () => {
    const row = await caller.positions.get({ id: posId });
    expect(row).toMatchObject({ name: 'Доцент', abbreviation: 'доц' });
  });

  it('should return null for non-existent id', async () => {
    const row = await caller.positions.get({ id: 9999 });
    expect(row).toBeNull();
  });

  it('should update name', async () => {
    await caller.positions.update({ id: posId, name: 'Профессор' });
    const row = await caller.positions.get({ id: posId });
    expect(row?.name).toBe('Профессор');
  });

  it('should reject update to existing name', async () => {
    const [row2] = await caller.positions.create({ name: 'Старший преподаватель' });
    secondPosId = row2.id;

    await expect(
      caller.positions.update({ id: secondPosId, name: 'Профессор' })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.positions.update({ id: secondPosId, name: 'Профессор' });
    } catch (e) {
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
      }
    }
  });

  it('should reject update with empty name', async () => {
    await expect(
      caller.positions.update({ id: posId, name: '' })
    ).rejects.toThrow();
  });

  it('should not fail on non-existent id update', async () => {
    await expect(
      caller.positions.update({ id: 9999, name: 'Несуществующий' })
    ).resolves.toBeDefined();
  });

  it('should delete existing position', async () => {
    await caller.positions.delete({ id: secondPosId });
    const row = await caller.positions.get({ id: secondPosId });
    expect(row).toBeNull();
  });

  it('should not fail on non-existent id delete', async () => {
    await expect(
      caller.positions.delete({ id: 9999 })
    ).resolves.toBeDefined();
  });
});