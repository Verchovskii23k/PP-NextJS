import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let ids: Awaited<ReturnType<typeof seedTestData>>;

beforeAll(async () => {
  ids = await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('specialties CRUD', () => {
  let id: number;

  it('create', async () => {
    const [row] = await caller.specialties.create({
      code: '01.03.05',
      name: 'Тестовая специальность',
      departmentId: ids.departments.A,
    });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.specialties.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.specialties.get({ id });
    expect(row?.name).toBe('Тестовая специальность');
  });

  it('update', async () => {
    await caller.specialties.update({ id, name: 'Обновлённая специальность' });
    const row = await caller.specialties.get({ id });
    expect(row?.name).toBe('Обновлённая специальность');
  });

  it('should reject deletion if linked to profiles', async () => {
    // в фикстуре профили привязаны к специальностям, поэтому удаление специальности должно вызывать safeDelete
    await expect(
      caller.specialties.delete({ id: ids.specialties.A })
    ).rejects.toThrow(/Невозможно удалить/);
  });
});