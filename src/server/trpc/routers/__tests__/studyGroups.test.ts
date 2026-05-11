import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let ids: Awaited<ReturnType<typeof seedTestData>>;

beforeAll(async () => {
  ids = await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('studyGroups CRUD', () => {
  let id: number;

  it('create', async () => {
    const [row] = await caller.studyGroups.create({
      code: 'TESTGROUP',
      profileId: ids.profiles.A,
      course: 3,
      studentCount: 10,
    });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.studyGroups.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.studyGroups.get({ id });
    expect(row?.code).toBe('TESTGROUP');
  });

  it('update', async () => {
    await caller.studyGroups.update({ id, studentCount: 15 });
    const row = await caller.studyGroups.get({ id });
    expect(row?.studentCount).toBe(15);
  });

  it('delete', async () => {
    await caller.studyGroups.delete({ id });
    const row = await caller.studyGroups.get({ id });
    expect(row).toBeNull();
  });
});