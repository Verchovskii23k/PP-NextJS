// src/server/trpc/routers/__tests__/education.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import { clearAllTestData } from '@/test/helpers';
import { TRPCError } from '@trpc/server';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let levelId: number;
let formId: number;
let level2Id: number;
let form2Id: number;

beforeAll(async () => {
  await clearAllTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });

  // Создаём два уровня и две формы для проверки дубликатов и конфликтов
  const [lvl1] = await caller.educationLevels.create({ name: 'Бакалавриат' });
  levelId = lvl1.id;
  const [lvl2] = await caller.educationLevels.create({ name: 'Магистратура' });
  level2Id = lvl2.id;

  const [frm1] = await caller.educationForms.create({ name: 'Очная' });
  formId = frm1.id;
  const [frm2] = await caller.educationForms.create({ name: 'Заочная' });
  form2Id = frm2.id;
});

describe('education CRUD', () => {
  let eduId: number;
  let edu2Id: number;

  it('should create an education entry', async () => {
    const [row] = await caller.education.create({
      levelId,
      formId,
      durationMonths: 48,
    });
    expect(row).toHaveProperty('id');
    eduId = row.id;
  });

  it('should reject duplicate combination (level + form)', async () => {
    await expect(
      caller.education.create({ levelId, formId, durationMonths: 36 })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.education.create({ levelId, formId, durationMonths: 36 });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
        expect(e.message).toBe('Такая комбинация уровня и формы уже существует');
      }
    }
  });

  it('should reject missing required fields', async () => {
    await expect(
      (caller.education.create as any)({ levelId })
    ).rejects.toThrow();
    await expect(
      (caller.education.create as any)({ formId })
    ).rejects.toThrow();
  });

  it('should list and contain created entry', async () => {
    const list = await caller.education.list();
    expect(list.some(e => e.id === eduId)).toBe(true);
    // Проверим наличие display (формируется через JOIN)
    const entry = list.find(e => e.id === eduId);
    expect(entry?.display).toBeDefined();
  });

  it('should get existing entry', async () => {
    const row = await caller.education.get({ id: eduId });
    expect(row).toMatchObject({
      levelId,
      formId,
      durationMonths: 48,
    });
    expect(row?.display).toBeDefined();
  });

  it('should return null for non-existent id', async () => {
    const row = await caller.education.get({ id: 9999 });
    expect(row).toBeNull();
  });

  it('should update durationMonths', async () => {
    await caller.education.update({ id: eduId, durationMonths: 24 });
    const row = await caller.education.get({ id: eduId });
    expect(row?.durationMonths).toBe(24);
  });

  it('should reject update to duplicate combination', async () => {
    // Создаём вторую запись с другой парой
    const [row2] = await caller.education.create({
      levelId: level2Id,
      formId: form2Id,
      durationMonths: 60,
    });
    edu2Id = row2.id;

    // Пытаемся обновить вторую запись на комбинацию первой (levelId, formId)
    await expect(
      caller.education.update({ id: edu2Id, levelId, formId })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.education.update({ id: edu2Id, levelId, formId });
    } catch (e) {
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
      }
    }
  });

  it('should not fail on non-existent id update', async () => {
    await expect(
      caller.education.update({ id: 9999, durationMonths: 10 })
    ).resolves.toBeDefined();
  });

  it('should delete existing entry', async () => {
    await caller.education.delete({ id: edu2Id });
    const row = await caller.education.get({ id: edu2Id });
    expect(row).toBeNull();
  });

  it('should not fail on non-existent id delete', async () => {
    await expect(
      caller.education.delete({ id: 9999 })
    ).resolves.toBeDefined();
  });
});