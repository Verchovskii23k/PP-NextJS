import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';
import { beforeAll, describe, expect, it } from 'vitest';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let ids: Awaited<ReturnType<typeof seedTestData>>;

beforeAll(async () => {
  ids = await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('disciplines CRUD', () => {
  it('should create a discipline', async () => {
    const disc = await caller.disciplines.create({
      name: 'Новая дисциплина',
      abbreviation: 'НД',
      departmentId: ids.departments.A,
    });
    const created = disc[0];
    expect(created).toHaveProperty('id');
    const list = await caller.disciplines.list();
    expect(list.some(d => d.id === created.id)).toBe(true);
  });

  it('should reject deletion of department with disciplines', async () => {
    await expect(
      caller.departments.delete({ id: ids.departments.A })
    ).rejects.toThrow(/Невозможно удалить/);
  });
});