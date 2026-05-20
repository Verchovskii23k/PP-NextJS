// src/server/trpc/routers/__tests__/academicLoadTypes.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import { clearTable } from '@/test/helpers';
import { academicLoadTypes } from '@/db/schema';
import { TRPCError } from '@trpc/server';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await clearTable(academicLoadTypes);
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('academicLoadTypes CRUD', () => {
  let id: number;
  let secondId: number;

  it('create a new type', async () => {
    const [row] = await caller.academicLoadTypes.create({
      name: 'Test',
      abbreviation: 'T',
    });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('reject duplicate name', async () => {
    await expect(
      caller.academicLoadTypes.create({ name: 'Test', abbreviation: 'T2' })
    ).rejects.toThrow(TRPCError);
    // Проверим код ошибки, если нужно
    try {
      await caller.academicLoadTypes.create({ name: 'Test', abbreviation: 'T2' });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
        expect(e.message).toBe('Тип нагрузки с таким названием уже существует');
      }
    }
  });

  it('reject empty name', async () => {
    await expect(
      caller.academicLoadTypes.create({ name: '', abbreviation: 'E' })
    ).rejects.toThrow();
  });

  it('list should contain created item', async () => {
    const list = await caller.academicLoadTypes.list();
    expect(list.some((r) => r.id === id)).toBe(true);
  });

  it('get returns correct item', async () => {
    const row = await caller.academicLoadTypes.get({ id });
    expect(row).toMatchObject({ name: 'Test', abbreviation: 'T' });
  });

  it('get non-existent returns null', async () => {
    const row = await caller.academicLoadTypes.get({ id: 9999 });
    expect(row).toBeNull();
  });

  it('update name', async () => {
    await caller.academicLoadTypes.update({ id, name: 'Updated' });
    const row = await caller.academicLoadTypes.get({ id });
    expect(row?.name).toBe('Updated');
  });

  it('reject update to existing name', async () => {
    // Создаём вторую запись
    const [row2] = await caller.academicLoadTypes.create({
      name: 'Another',
      abbreviation: 'A',
    });
    secondId = row2.id;

    // Пытаемся обновить первую запись на имя второй
    await expect(
      caller.academicLoadTypes.update({ id, name: 'Another' })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.academicLoadTypes.update({ id, name: 'Another' });
    } catch (e) {
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
      }
    }
  });

  it('reject update with empty name', async () => {
    await expect(
      caller.academicLoadTypes.update({ id, name: '' })
    ).rejects.toThrow();
  });

  it('update non-existent id does nothing', async () => {
    // Не должно бросать ошибку
    const result = await caller.academicLoadTypes.update({
      id: 9999,
      name: 'Ghost',
    });
    expect(result).toBeDefined();
    // Убедимся, что запись с id=9999 не появилась
    const row = await caller.academicLoadTypes.get({ id: 9999 });
    expect(row).toBeNull();
  });

  it('delete existing item', async () => {
    await caller.academicLoadTypes.delete({ id });
    const row = await caller.academicLoadTypes.get({ id });
    expect(row).toBeNull(); // safeDelete делает запись неактивной
  });

  it('delete non-existent item does not fail', async () => {
    await expect(
      caller.academicLoadTypes.delete({ id: 9999 })
    ).resolves.toBeDefined();
  });
});