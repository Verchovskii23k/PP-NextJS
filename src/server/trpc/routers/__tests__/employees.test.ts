import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('employees CRUD', () => {
  let id: number;

  it('create', async () => {
    const [row] = await caller.employees.create({
      surname: 'Новый', name: 'Сотрудник',
    });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.employees.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.employees.get({ id });
    expect(row?.surname).toBe('Новый');
  });

  it('update', async () => {
    await caller.employees.update({ id, surname: 'Обновлённый' });
    const row = await caller.employees.get({ id });
    expect(row?.surname).toBe('Обновлённый');
  });

  it('delete', async () => {
    await caller.employees.delete({ id });
    const row = await caller.employees.get({ id });
    expect(row).toBeNull();
  });
});