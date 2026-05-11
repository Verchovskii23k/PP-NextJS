import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('education CRUD', () => {
  let id: number;
  let levelId: number;
  let formId: number;

  beforeAll(async () => {
    const [level] = await caller.educationLevels.create({ name: 'Бакалавриат' });
    levelId = level.id;
    const [form] = await caller.educationForms.create({ name: 'Очная' });
    formId = form.id;
  });

  it('create', async () => {
    const [row] = await caller.education.create({ levelId, formId, durationMonths: 48 });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.education.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.education.get({ id });
    expect(row?.durationMonths).toBe(48);
  });

  it('update', async () => {
    await caller.education.update({ id, durationMonths: 24 });
    const row = await caller.education.get({ id });
    expect(row?.durationMonths).toBe(24);
  });

  it('delete', async () => {
    await caller.education.delete({ id });
    const row = await caller.education.get({ id });
    expect(row).toBeNull();
  });
});