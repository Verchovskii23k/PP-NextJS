import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('employmentTypes CRUD', () => {
  let id: number;

  it('create', async () => {
    const [row] = await caller.employmentTypes.create({ name: 'Ставка' });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.employmentTypes.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.employmentTypes.get({ id });
    expect(row?.name).toBe('Ставка');
  });

  it('update', async () => {
    await caller.employmentTypes.update({ id, name: '0.5 ставки' });
    const row = await caller.employmentTypes.get({ id });
    expect(row?.name).toBe('0.5 ставки');
  });

  it('delete', async () => {
    await caller.employmentTypes.delete({ id });
    const row = await caller.employmentTypes.get({ id });
    expect(row).toBeNull();
  });
});