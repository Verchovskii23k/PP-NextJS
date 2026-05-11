import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('educationLevels CRUD', () => {
  let id: number;

  it('create', async () => {
    const [row] = await caller.educationLevels.create({ name: 'Бакалавриат' });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.educationLevels.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.educationLevels.get({ id });
    expect(row?.name).toBe('Бакалавриат');
  });

  it('update', async () => {
    await caller.educationLevels.update({ id, name: 'Магистратура' });
    const row = await caller.educationLevels.get({ id });
    expect(row?.name).toBe('Магистратура');
  });

  it('delete', async () => {
    await caller.educationLevels.delete({ id });
    const row = await caller.educationLevels.get({ id });
    expect(row).toBeNull();
  });
});