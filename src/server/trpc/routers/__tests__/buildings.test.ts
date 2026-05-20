// src/server/trpc/routers/__tests__/buildings.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import { clearTable } from '@/test/helpers';
import { buildings, classrooms } from '@/db/schema';
import { TRPCError } from '@trpc/server';
import { db } from '@/db';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  // Очищаем classrooms перед buildings из-за внешнего ключа
  await clearTable(classrooms);
  await clearTable(buildings);
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('buildings CRUD', () => {
  let buildingId: number;
  let secondBuildingId: number;

  it('create a building', async () => {
    const [bld] = await caller.buildings.create({ number: 99 });
    expect(bld).toHaveProperty('id');
    buildingId = bld.id;
  });

  it('reject duplicate number', async () => {
    await expect(
      caller.buildings.create({ number: 99 })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.buildings.create({ number: 99 });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
        expect(e.message).toBe('Корпус с таким номером уже существует');
      }
    }
  });

  it('reject zero or negative number', async () => {
    await expect(
      caller.buildings.create({ number: 0 })
    ).rejects.toThrow();
    await expect(
      caller.buildings.create({ number: -5 })
    ).rejects.toThrow();
  });

  it('list should include created building', async () => {
    const list = await caller.buildings.list();
    expect(list.some((b) => b.id === buildingId)).toBe(true);
  });

  it('get existing building', async () => {
    const bld = await caller.buildings.get({ id: buildingId });
    expect(bld).toMatchObject({ number: 99 });
  });

  it('get non-existent returns null', async () => {
    const bld = await caller.buildings.get({ id: 9999 });
    expect(bld).toBeNull();
  });

  it('update number', async () => {
    await caller.buildings.update({ id: buildingId, number: 100 });
    const bld = await caller.buildings.get({ id: buildingId });
    expect(bld?.number).toBe(100);
  });

  it('reject update to existing number', async () => {
    // Создаём второе здание
    const [bld2] = await caller.buildings.create({ number: 200 });
    secondBuildingId = bld2.id;

    // Пытаемся обновить первое здание на номер второго
    await expect(
      caller.buildings.update({ id: buildingId, number: 200 })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.buildings.update({ id: buildingId, number: 200 });
    } catch (e) {
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
      }
    }
  });

  it('reject update with invalid number', async () => {
    await expect(
      caller.buildings.update({ id: buildingId, number: 0 })
    ).rejects.toThrow();
    await expect(
      caller.buildings.update({ id: buildingId, number: -1 })
    ).rejects.toThrow();
  });

  it('update non-existent id does nothing', async () => {
    const result = await caller.buildings.update({
      id: 9999,
      number: 300,
    });
    expect(result).toBeDefined();
    const bld = await caller.buildings.get({ id: 9999 });
    expect(bld).toBeNull();
  });

  it('delete existing building', async () => {
    // Удаляем второе здание (неиспользуемое)
    await caller.buildings.delete({ id: secondBuildingId });
    const bld = await caller.buildings.get({ id: secondBuildingId });
    expect(bld).toBeNull();
  });

  it('delete non-existent does not fail', async () => {
    await expect(
      caller.buildings.delete({ id: 9999 })
    ).resolves.toBeDefined();
  });

  it('reject deletion of used building (with classrooms)', async () => {
    // Создаём здание и аудиторию, привязанную к нему
    const [bld] = await caller.buildings.create({ number: 400 });
    await db.insert(classrooms).values({
      buildingId: bld.id,
      roomNumber: '101',
      capacity: 30,
    });

    await expect(
      caller.buildings.delete({ id: bld.id })
    ).rejects.toThrow(/Невозможно удалить/);
  });
});