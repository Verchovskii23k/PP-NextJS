import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let ids: Awaited<ReturnType<typeof seedTestData>>;

beforeAll(async () => {
  ids = await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('curriculum CRUD', () => {
  let id: number;

  it('create', async () => {
    const [row] = await caller.curriculum.create({
      course: 1,
      semester: 1,
      disciplineId: ids.disciplines.D1,
      hoursLecture: 30,
      hoursLab: 15,
    });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.curriculum.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.curriculum.get({ id });
    expect(row?.hoursLecture).toBe(30);
  });

  it('update', async () => {
    await caller.curriculum.update({ id, hoursLecture: 40 });
    const row = await caller.curriculum.get({ id });
    expect(row?.hoursLecture).toBe(40);
  });

  it('delete', async () => {
    await caller.curriculum.delete({ id });
    const row = await caller.curriculum.get({ id });
    expect(row).toBeNull();
  });
});