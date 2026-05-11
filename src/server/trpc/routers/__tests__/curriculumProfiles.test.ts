import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let ids: Awaited<ReturnType<typeof seedTestData>>;

beforeAll(async () => {
  ids = await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('curriculumProfiles CRUD', () => {
  let id: number;

  it('create', async () => {
    // нужно curriculum и profile
    const [curr] = await caller.curriculum.create({
      course: 1, semester: 1, disciplineId: ids.disciplines.D1, hoursLecture: 10, hoursLab: 5,
    });
    const [row] = await caller.curriculumProfiles.create({
      curriculumId: curr.id, profileId: ids.profiles.A,
    });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.curriculumProfiles.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.curriculumProfiles.get({ id });
    expect(row?.curriculumId).toBeDefined();
  });

  it('update', async () => {
    await caller.curriculumProfiles.update({ id, isActive: false });
    const row = await caller.curriculumProfiles.get({ id });
    expect(row?.isActive).toBe(false);
  });

  it('delete', async () => {
    await caller.curriculumProfiles.delete({ id });
    const row = await caller.curriculumProfiles.get({ id });
    expect(row).toBeNull();
  });
});