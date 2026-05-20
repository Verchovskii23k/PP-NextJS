// src/server/trpc/routers/__tests__/lookup.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import { clearAllTestData } from '@/test/helpers';
import { db } from '@/db';
import { buildings } from '@/db/schema';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await clearAllTestData();
  // Создаём тестовое здание, чтобы был валидный id
  const [b] = await db.insert(buildings).values({ number: 1 }).returning({ id: buildings.id });
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('lookup', () => {
  it('should return a row for a valid table and id', async () => {
    const result = await caller.lookup.getRow({ tableName: 'buildings', id: 1 });
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('number');
    // Проверяем camelCase: в схеме колонка 'number', но в camelCase остаётся 'number' (не меняется)
    expect(result).toHaveProperty('number');
  });

  it('should return null for non-existent id', async () => {
    const result = await caller.lookup.getRow({ tableName: 'buildings', id: 99999 });
    expect(result).toBeNull();
  });

  it('should reject disallowed table', async () => {
    await expect(
      caller.lookup.getRow({ tableName: 'users', id: 1 })
    ).rejects.toThrow(/не разрешена/);
  });

  it('should reject missing table name', async () => {
    await expect(
      (caller.lookup.getRow as any)({ id: 1 })
    ).rejects.toThrow();
  });
});