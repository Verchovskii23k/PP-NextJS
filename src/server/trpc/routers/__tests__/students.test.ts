import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let ids: Awaited<ReturnType<typeof seedTestData>>;

beforeAll(async () => {
  ids = await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('students CRUD', () => {
  let id: number;

  it('create', async () => {
    const [row] = await caller.students.create({
      surname: 'Тестов',
      name: 'Студент',
      admissionYear: 2023,
      profileId: ids.profiles.A,
    });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.students.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.students.get({ id });
    expect(row?.surname).toBe('Тестов');
  });

  it('update', async () => {
    await caller.students.update({ id, name: 'Обновлённый' });
    const row = await caller.students.get({ id });
    expect(row?.name).toBe('Обновлённый');
  });

  it('delete', async () => {
    await caller.students.delete({ id });
    const row = await caller.students.get({ id });
    expect(row).toBeNull();
  });
});