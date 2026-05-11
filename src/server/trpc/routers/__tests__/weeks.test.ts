import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('weeks CRUD', () => {
  let id: number;

  it('create', async () => {
    const [row] = await caller.weeks.create({ type: 'custom' });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.weeks.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.weeks.get({ id });
    expect(row?.type).toBe('custom');
  });

  it('update', async () => {
    await caller.weeks.update({ id, type: 'updated' });
    const row = await caller.weeks.get({ id });
    expect(row?.type).toBe('updated');
  });

  it('delete', async () => {
    await caller.weeks.delete({ id });
    const row = await caller.weeks.get({ id });
    expect(row).toBeNull();
  });
});