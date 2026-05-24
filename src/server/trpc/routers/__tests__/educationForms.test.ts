import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import { clearAllTestData } from '@/test/helpers';
import { TRPCError } from '@trpc/server';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await clearAllTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('educationForms CRUD', () => {
  let formId: number;
  let secondFormId: number;

  it('should create a form', async () => {
    const [row] = await caller.educationForms.create({
      name: 'Очная',
      abbreviation: 'ОЧ',
    });
    expect(row).toHaveProperty('id');
    formId = row.id;
  });

  it('should reject duplicate name', async () => {
    await expect(
      caller.educationForms.create({ name: 'Очная' })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.educationForms.create({ name: 'Очная' });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
        expect(e.message).toBe('Форма обучения с таким названием уже существует');
      }
    }
  });

  it('should reject empty name', async () => {
    await expect(
      caller.educationForms.create({ name: '' })
    ).rejects.toThrow();
  });

  it('should list and contain created form', async () => {
    const list = await caller.educationForms.list();
    expect(list.some(f => f.id === formId)).toBe(true);
  });

  it('should get existing form', async () => {
    const row = await caller.educationForms.get({ id: formId });
    expect(row).toMatchObject({ name: 'Очная', abbreviation: 'ОЧ' });
  });

  it('should return null for non-existent id', async () => {
    const row = await caller.educationForms.get({ id: 9999 });
    expect(row).toBeNull();
  });

  it('should update name', async () => {
    await caller.educationForms.update({ id: formId, name: 'Заочная' });
    const row = await caller.educationForms.get({ id: formId });
    expect(row?.name).toBe('Заочная');
  });

  it('should reject update to existing name', async () => {
    const [row2] = await caller.educationForms.create({
      name: 'Вечерняя',
    });
    secondFormId = row2.id;

    await expect(
      caller.educationForms.update({ id: formId, name: 'Вечерняя' })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.educationForms.update({ id: formId, name: 'Вечерняя' });
    } catch (e) {
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
      }
    }
  });

  it('should reject update with empty name', async () => {
    await expect(
      caller.educationForms.update({ id: formId, name: '' })
    ).rejects.toThrow();
  });

  it('should not fail on non-existent id update', async () => {
    await expect(
      caller.educationForms.update({ id: 9999, name: 'Несуществующая' })
    ).resolves.toBeDefined();
  });

  it('should delete existing form', async () => {
    await caller.educationForms.delete({ id: secondFormId });
    const row = await caller.educationForms.get({ id: secondFormId });
    expect(row).toBeNull();
  });

  it('should not fail on non-existent id delete', async () => {
    await expect(
      caller.educationForms.delete({ id: 9999 })
    ).resolves.toBeDefined();
  });
});