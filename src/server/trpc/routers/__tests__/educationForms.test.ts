import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('educationForms CRUD', () => {
  let id: number;

  it('create', async () => {
    const [row] = await caller.educationForms.create({ name: 'Очная' });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.educationForms.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.educationForms.get({ id });
    expect(row?.name).toBe('Очная');
  });

  it('update', async () => {
    await caller.educationForms.update({ id, name: 'Заочная' });
    const row = await caller.educationForms.get({ id });
    expect(row?.name).toBe('Заочная');
  });

  it('delete', async () => {
    await caller.educationForms.delete({ id });
    const row = await caller.educationForms.get({ id });
    expect(row).toBeNull();
  });
});