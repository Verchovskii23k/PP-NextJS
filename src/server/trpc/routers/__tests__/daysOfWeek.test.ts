import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('daysOfWeek CRUD', () => {
  let id: number;

  it('create', async () => {
    const [row] = await caller.daysOfWeek.create({ name: 'ВС' });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.daysOfWeek.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.daysOfWeek.get({ id });
    expect(row?.name).toBe('ВС');
  });

  it('update', async () => {
    await caller.daysOfWeek.update({ id, name: 'Воскресенье' });
    const row = await caller.daysOfWeek.get({ id });
    expect(row?.name).toBe('Воскресенье');
  });

  it('delete', async () => {
    await caller.daysOfWeek.delete({ id });
    const row = await caller.daysOfWeek.get({ id });
    expect(row).toBeNull();
  });
});