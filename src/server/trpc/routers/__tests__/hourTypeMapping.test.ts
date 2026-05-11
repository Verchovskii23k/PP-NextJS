import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let ids: Awaited<ReturnType<typeof seedTestData>>;

beforeAll(async () => {
  ids = await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('hourTypeMapping CRUD', () => {
  let id: number;

  it('create', async () => {
    const [row] = await caller.hourTypeMapping.create({
      planHourColumn: 'hours_test',
      priorityColumn: 'priorityTest',
      lessonTypeId: ids.lessonTypes.lecture,
    });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.hourTypeMapping.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.hourTypeMapping.get({ id });
    expect(row?.planHourColumn).toBe('hours_test');
  });

  it('update', async () => {
    await caller.hourTypeMapping.update({ id, planHourColumn: 'hours_updated' });
    const row = await caller.hourTypeMapping.get({ id });
    expect(row?.planHourColumn).toBe('hours_updated');
  });

  it('delete', async () => {
    await caller.hourTypeMapping.delete({ id });
    const row = await caller.hourTypeMapping.get({ id });
    expect(row).toBeNull();
  });
});