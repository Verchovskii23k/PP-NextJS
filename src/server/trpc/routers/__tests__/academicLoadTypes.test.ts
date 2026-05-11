import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('academicLoadTypes CRUD', () => {
  let id: number;

  it('create', async () => {
    const [row] = await caller.academicLoadTypes.create({ name: 'Test', abbreviation: 'T' });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.academicLoadTypes.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.academicLoadTypes.get({ id });
    expect(row?.name).toBe('Test');
  });

  it('update', async () => {
    await caller.academicLoadTypes.update({ id, name: 'Updated' });
    const row = await caller.academicLoadTypes.get({ id });
    expect(row?.name).toBe('Updated');
  });

  it('delete', async () => {
    await caller.academicLoadTypes.delete({ id });
    const row = await caller.academicLoadTypes.get({ id });
    expect(row).toBeNull();
  });
});