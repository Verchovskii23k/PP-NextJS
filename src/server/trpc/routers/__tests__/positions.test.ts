import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('positions CRUD', () => {
  let id: number;

  it('create', async () => {
    const [row] = await caller.positions.create({ name: 'Доцент' });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.positions.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.positions.get({ id });
    expect(row?.name).toBe('Доцент');
  });

  it('update', async () => {
    await caller.positions.update({ id, name: 'Профессор' });
    const row = await caller.positions.get({ id });
    expect(row?.name).toBe('Профессор');
  });

  it('delete', async () => {
    await caller.positions.delete({ id });
    const row = await caller.positions.get({ id });
    expect(row).toBeNull();
  });
});