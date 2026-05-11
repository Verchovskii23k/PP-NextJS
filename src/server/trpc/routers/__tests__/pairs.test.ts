import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('pairs CRUD', () => {
  let id: number;

  it('create', async () => {
    const [row] = await caller.pairs.create({ number: 6 });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.pairs.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.pairs.get({ id });
    expect(row?.number).toBe(6);
  });

  it('update', async () => {
    await caller.pairs.update({ id, number: 7 });
    const row = await caller.pairs.get({ id });
    expect(row?.number).toBe(7);
  });

  it('delete', async () => {
    await caller.pairs.delete({ id });
    const row = await caller.pairs.get({ id });
    expect(row).toBeNull();
  });
});