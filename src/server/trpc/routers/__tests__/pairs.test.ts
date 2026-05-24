import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import { clearAllTestData } from '@/test/helpers';
import { TRPCError } from '@trpc/server';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await clearAllTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('pairs CRUD', () => {
  let pairId: number;
  let secondPairId: number;

  it('should create a pair', async () => {
    const [row] = await caller.pairs.create({ number: 1 });
    expect(row).toHaveProperty('id');
    pairId = row.id;
  });

  it('should reject duplicate number', async () => {
    await expect(
      caller.pairs.create({ number: 1 })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.pairs.create({ number: 1 });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
        expect(e.message).toBe('Пара с таким номером уже существует');
      }
    }
  });

  it('should reject zero or negative number', async () => {
    await expect(
      caller.pairs.create({ number: 0 })
    ).rejects.toThrow();
    await expect(
      caller.pairs.create({ number: -1 })
    ).rejects.toThrow();
  });

  it('should list and contain created pair', async () => {
    const list = await caller.pairs.list();
    expect(list.some(p => p.id === pairId)).toBe(true);
  });

  it('should get existing pair', async () => {
    const row = await caller.pairs.get({ id: pairId });
    expect(row?.number).toBe(1);
  });

  it('should return null for non-existent id', async () => {
    const row = await caller.pairs.get({ id: 9999 });
    expect(row).toBeNull();
  });

  it('should update number', async () => {
    await caller.pairs.update({ id: pairId, number: 5 });
    const row = await caller.pairs.get({ id: pairId });
    expect(row?.number).toBe(5);
  });

  it('should reject update to existing number', async () => {
    const [row2] = await caller.pairs.create({ number: 10 });
    secondPairId = row2.id;

    await expect(
      caller.pairs.update({ id: secondPairId, number: 5 })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.pairs.update({ id: secondPairId, number: 5 });
    } catch (e) {
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
      }
    }
  });

  it('should reject update with invalid number', async () => {
    await expect(
      caller.pairs.update({ id: pairId, number: 0 })
    ).rejects.toThrow();
    await expect(
      caller.pairs.update({ id: pairId, number: -1 })
    ).rejects.toThrow();
  });

  it('should not fail on non-existent id update', async () => {
    await expect(
      caller.pairs.update({ id: 9999, number: 8 })
    ).resolves.toBeDefined();
  });

  it('should delete existing pair', async () => {
    await caller.pairs.delete({ id: secondPairId });
    const row = await caller.pairs.get({ id: secondPairId });
    expect(row).toBeNull();
  });

  it('should not fail on non-existent id delete', async () => {
    await expect(
      caller.pairs.delete({ id: 9999 })
    ).resolves.toBeDefined();
  });
});