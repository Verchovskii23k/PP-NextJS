import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('controlTypes CRUD', () => {
  let ctId: number;

  it('should create a control type', async () => {
    const [ct] = await caller.controlTypes.create({ name: 'Зачёт', abbreviation: 'ЗЧ' });
    expect(ct).toHaveProperty('id');
    ctId = ct.id;
  });

  it('should list control types', async () => {
    const list = await caller.controlTypes.list();
    expect(list.some(c => c.id === ctId)).toBe(true);
  });

  it('should get a control type', async () => {
    const ct = await caller.controlTypes.get({ id: ctId });
    expect(ct?.name).toBe('Зачёт');
  });

  it('should update a control type', async () => {
    await caller.controlTypes.update({ id: ctId, name: 'Дифф. зачёт' });
    const ct = await caller.controlTypes.get({ id: ctId });
    expect(ct?.name).toBe('Дифф. зачёт');
  });

  it('should delete a control type', async () => {
    await caller.controlTypes.delete({ id: ctId });
    const ct = await caller.controlTypes.get({ id: ctId });
    expect(ct).toBeNull();
  });
});