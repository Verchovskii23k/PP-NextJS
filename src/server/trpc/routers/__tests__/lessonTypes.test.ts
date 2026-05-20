// src/server/trpc/routers/__tests__/lessonTypes.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import { clearAllTestData } from '@/test/helpers';
import { TRPCError } from '@trpc/server';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await clearAllTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('lessonTypes CRUD', () => {
  let typeId: number;
  let secondTypeId: number;

  it('should create a lesson type', async () => {
    const [row] = await caller.lessonTypes.create({
      name: 'custom',
      abbreviation: 'CUST',
    });
    expect(row).toHaveProperty('id');
    typeId = row.id;
  });

  it('should reject duplicate name', async () => {
    await expect(
      caller.lessonTypes.create({ name: 'custom', abbreviation: 'C2' })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.lessonTypes.create({ name: 'custom', abbreviation: 'C2' });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
        expect(e.message).toBe('Тип занятия с таким системным именем уже существует');
      }
    }
  });

  it('should reject empty name or abbreviation', async () => {
    await expect(
      caller.lessonTypes.create({ name: '', abbreviation: 'A' })
    ).rejects.toThrow();
    await expect(
      caller.lessonTypes.create({ name: 'n', abbreviation: '' })
    ).rejects.toThrow();
  });

  it('should list lesson types with display field', async () => {
    const list = await caller.lessonTypes.list();
    expect(list.some(t => t.id === typeId)).toBe(true);
    // Проверим наличие поля display (оно не пустое)
    const created = list.find(t => t.id === typeId);
    expect(created?.display).toBeDefined();
    expect(created?.display).toBeTruthy();
  });

  it('should get existing lesson type with display', async () => {
    const row = await caller.lessonTypes.get({ id: typeId });
    expect(row).toMatchObject({
      name: 'custom',
      abbreviation: 'CUST',
    });
    expect(row?.display).toBeDefined();
    expect(row?.display).toBeTruthy();
    // Для несистемных имён display = name
    expect(row?.display).toBe('custom');
  });

  it('should return null for non-existent id', async () => {
    const row = await caller.lessonTypes.get({ id: 9999 });
    expect(row).toBeNull();
  });

  it('should update abbreviation', async () => {
    await caller.lessonTypes.update({ id: typeId, abbreviation: 'CST' });
    const row = await caller.lessonTypes.get({ id: typeId });
    expect(row?.abbreviation).toBe('CST');
  });

  it('should reject update to existing name', async () => {
    // Создаём второй тип
    const [row2] = await caller.lessonTypes.create({
      name: 'workshop_new',
      abbreviation: 'WN',
    });
    secondTypeId = row2.id;

    // Пытаемся обновить первый тип на имя второго
    await expect(
      caller.lessonTypes.update({ id: typeId, name: 'workshop_new' })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.lessonTypes.update({ id: typeId, name: 'workshop_new' });
    } catch (e) {
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
      }
    }
  });

  it('should reject update with empty name', async () => {
    await expect(
      caller.lessonTypes.update({ id: typeId, name: '' })
    ).rejects.toThrow();
  });

  it('should not fail on non-existent id update', async () => {
    await expect(
      caller.lessonTypes.update({ id: 9999, abbreviation: 'NONE' })
    ).resolves.toBeDefined();
  });

  it('should delete existing type', async () => {
    await caller.lessonTypes.delete({ id: secondTypeId });
    const row = await caller.lessonTypes.get({ id: secondTypeId });
    expect(row).toBeNull();
  });

  it('should not fail on non-existent id delete', async () => {
    await expect(
      caller.lessonTypes.delete({ id: 9999 })
    ).resolves.toBeDefined();
  });
});