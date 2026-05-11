import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('lookup', () => {
  it('should return a row for a valid table and id', async () => {
    // buildings уже существуют (id=1)
    const result = await caller.lookup.getRow({ tableName: 'buildings', id: 1 });
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('number');
  });

  it('should return null for non-existent id', async () => {
    const result = await caller.lookup.getRow({ tableName: 'buildings', id: 99999 });
    expect(result).toBeNull();
  });
});