// src/server/trpc/routers/__tests__/hourTypeMapping.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import { clearAllTestData } from '@/test/helpers';
import { db } from '@/db';
import { lessonTypes } from '@/db/schema';
import { TRPCError } from '@trpc/server';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let lessonTypeId: number;

beforeAll(async () => {
  await clearAllTestData();
  
  // Создаём тип занятия, чтобы заполнить внешний ключ
  const [lt] = await db
    .insert(lessonTypes)
    .values({ name: 'lecture', abbreviation: 'ЛК' })
    .returning({ id: lessonTypes.id });
  lessonTypeId = lt.id;

  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('hourTypeMapping CRUD', () => {
  let mappingId: number;
  let secondMappingId: number;

  it('should create a mapping', async () => {
    const [row] = await caller.hourTypeMapping.create({
      planHourColumn: 'hours_test',
      priorityColumn: 'priorityTest',
      lessonTypeId,
    });
    expect(row).toHaveProperty('id');
    mappingId = row.id;
  });

  it('should reject duplicate planHourColumn', async () => {
    await expect(
      caller.hourTypeMapping.create({
        planHourColumn: 'hours_test',
        priorityColumn: 'other',
        lessonTypeId,
      })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.hourTypeMapping.create({
        planHourColumn: 'hours_test',
        priorityColumn: 'other',
        lessonTypeId,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
        expect(e.message).toBe('Маппинг с такой колонкой плана уже существует');
      }
    }
  });

  it('should reject empty planHourColumn or priorityColumn', async () => {
    await expect(
      caller.hourTypeMapping.create({
        planHourColumn: '',
        priorityColumn: 'p',
        lessonTypeId,
      })
    ).rejects.toThrow();
    await expect(
      caller.hourTypeMapping.create({
        planHourColumn: 'col',
        priorityColumn: '',
        lessonTypeId,
      })
    ).rejects.toThrow();
  });

  it('should reject missing lessonTypeId', async () => {
    await expect(
      (caller.hourTypeMapping.create as any)({
        planHourColumn: 'hours_x',
        priorityColumn: 'p',
      })
    ).rejects.toThrow();
  });

  it('should list and contain created mapping', async () => {
    const list = await caller.hourTypeMapping.list();
    expect(list.some(m => m.id === mappingId)).toBe(true);
  });

  it('should get existing mapping', async () => {
    const row = await caller.hourTypeMapping.get({ id: mappingId });
    expect(row).toMatchObject({
      planHourColumn: 'hours_test',
      priorityColumn: 'priorityTest',
      lessonTypeId,
    });
  });

  it('should return null for non-existent id', async () => {
    const row = await caller.hourTypeMapping.get({ id: 9999 });
    expect(row).toBeNull();
  });

  it('should update planHourColumn', async () => {
    await caller.hourTypeMapping.update({
      id: mappingId,
      planHourColumn: 'hours_updated',
    });
    const row = await caller.hourTypeMapping.get({ id: mappingId });
    expect(row?.planHourColumn).toBe('hours_updated');
  });

  it('should reject update to existing planHourColumn', async () => {
    // Создаём второй маппинг
    const [row2] = await caller.hourTypeMapping.create({
      planHourColumn: 'hours_second',
      priorityColumn: 'p2',
      lessonTypeId,
    });
    secondMappingId = row2.id;

    await expect(
      caller.hourTypeMapping.update({
        id: secondMappingId,
        planHourColumn: 'hours_updated',
      })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.hourTypeMapping.update({
        id: secondMappingId,
        planHourColumn: 'hours_updated',
      });
    } catch (e) {
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
      }
    }
  });

  it('should reject update with empty planHourColumn', async () => {
    await expect(
      caller.hourTypeMapping.update({ id: mappingId, planHourColumn: '' })
    ).rejects.toThrow();
  });

  it('should not fail on non-existent id update', async () => {
    await expect(
      caller.hourTypeMapping.update({
        id: 9999,
        planHourColumn: 'ghost',
      })
    ).resolves.toBeDefined();
  });

  it('should delete existing mapping', async () => {
    await caller.hourTypeMapping.delete({ id: secondMappingId });
    const row = await caller.hourTypeMapping.get({ id: secondMappingId });
    expect(row).toBeNull();
  });

  it('should not fail on non-existent id delete', async () => {
    await expect(
      caller.hourTypeMapping.delete({ id: 9999 })
    ).resolves.toBeDefined();
  });
});