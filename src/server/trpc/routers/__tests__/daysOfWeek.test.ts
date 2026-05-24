import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import { clearTable } from '@/test/helpers';
import { daysOfWeek } from '@/db/schema';
import { TRPCError } from '@trpc/server';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await clearTable(daysOfWeek);
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('daysOfWeek CRUD', () => {
  let id: number;

  it('should create a day', async () => {
    const [row] = await caller.daysOfWeek.create({ name: 'ВС' });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('should reject duplicate name', async () => {
    await expect(
      caller.daysOfWeek.create({ name: 'ВС' })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.daysOfWeek.create({ name: 'ВС' });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
        expect(e.message).toBe('День недели с таким названием уже существует');
      }
    }
  });

  it('should reject empty name', async () => {
    await expect(
      caller.daysOfWeek.create({ name: '' })
    ).rejects.toThrow();
  });

  it('should list and contain created day', async () => {
    const list = await caller.daysOfWeek.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('should get existing day', async () => {
    const row = await caller.daysOfWeek.get({ id });
    expect(row?.name).toBe('ВС');
  });

  it('should return null for non-existent id', async () => {
    const row = await caller.daysOfWeek.get({ id: 9999 });
    expect(row).toBeNull();
  });

  it('should update name', async () => {
    await caller.daysOfWeek.update({ id, name: 'Воскресенье' });
    const row = await caller.daysOfWeek.get({ id });
    expect(row?.name).toBe('Воскресенье');
  });

  it('should reject update to existing name', async () => {
    await caller.daysOfWeek.create({ name: 'ПН' });

    await expect(
      caller.daysOfWeek.update({ id, name: 'ПН' })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.daysOfWeek.update({ id, name: 'ПН' });
    } catch (e) {
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
      }
    }
  });

  it('should reject update with empty name', async () => {
    await expect(
      caller.daysOfWeek.update({ id, name: '' })
    ).rejects.toThrow();
  });

  it('should not fail on non-existent id update', async () => {
    await expect(
      caller.daysOfWeek.update({ id: 9999, name: 'Несуществующий' })
    ).resolves.toBeDefined();
  });

  it('should delete existing day', async () => {
    await caller.daysOfWeek.delete({ id });
    const row = await caller.daysOfWeek.get({ id });
    expect(row).toBeNull();
  });

  it('should not fail on non-existent id delete', async () => {
    await expect(
      caller.daysOfWeek.delete({ id: 9999 })
    ).resolves.toBeDefined();
  });
});