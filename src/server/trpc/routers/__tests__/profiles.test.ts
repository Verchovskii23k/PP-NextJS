import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let ids: Awaited<ReturnType<typeof seedTestData>>;

beforeAll(async () => {
  ids = await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('profiles CRUD', () => {
  let id: number;

  it('create', async () => {
    const [row] = await caller.profiles.create({
      name: 'Тестовый профиль',
      specialtyId: ids.specialties.A,
      letterCode: 'т',
    });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.profiles.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.profiles.get({ id });
    expect(row?.name).toBe('Тестовый профиль');
  });

  it('update', async () => {
    await caller.profiles.update({ id, name: 'Обновлённый профиль' });
    const row = await caller.profiles.get({ id });
    expect(row?.name).toBe('Обновлённый профиль');
  });

  it('should reject deletion if linked to studyGroups or students', async () => {
    await expect(
      caller.profiles.delete({ id: ids.profiles.A })
    ).rejects.toThrow(/Невозможно удалить/);
  });
});