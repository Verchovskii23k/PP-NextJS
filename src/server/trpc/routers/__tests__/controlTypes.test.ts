import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import { clearTable } from '@/test/helpers';
import { controlTypes } from '@/db/schema';
import { TRPCError } from '@trpc/server';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await clearTable(controlTypes);
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('controlTypes CRUD', () => {
  let ctId: number;

  it('should create a control type', async () => {
    const [ct] = await caller.controlTypes.create({
      name: 'Зачёт',
      abbreviation: 'ЗЧ',
    });
    expect(ct).toHaveProperty('id');
    ctId = ct.id;
  });

  it('should reject duplicate name', async () => {
    await expect(
      caller.controlTypes.create({ name: 'Зачёт', abbreviation: 'ЗЧ2' })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.controlTypes.create({ name: 'Зачёт', abbreviation: 'ЗЧ2' });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
        expect(e.message).toBe('Тип контроля с таким названием уже существует');
      }
    }
  });

  it('should reject empty name', async () => {
    await expect(
      caller.controlTypes.create({ name: '', abbreviation: 'T' })
    ).rejects.toThrow();
  });

  it('should list control types and contain created one', async () => {
    const list = await caller.controlTypes.list();
    expect(list.some((c) => c.id === ctId)).toBe(true);
  });

  it('should get existing control type', async () => {
    const ct = await caller.controlTypes.get({ id: ctId });
    expect(ct).toMatchObject({ name: 'Зачёт', abbreviation: 'ЗЧ' });
  });

  it('should return null for non-existent id', async () => {
    const ct = await caller.controlTypes.get({ id: 9999 });
    expect(ct).toBeNull();
  });

  it('should update a control type', async () => {
    await caller.controlTypes.update({ id: ctId, name: 'Дифф. зачёт' });
    const ct = await caller.controlTypes.get({ id: ctId });
    expect(ct?.name).toBe('Дифф. зачёт');
  });

  it('should reject update to existing name', async () => {
    // создаём второй тип
    await caller.controlTypes.create({
      name: 'Экзамен',
      abbreviation: 'ЭКЗ',
    });

    // пытаемся обновить первый на имя второго
    await expect(
      caller.controlTypes.update({ id: ctId, name: 'Экзамен' })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.controlTypes.update({ id: ctId, name: 'Экзамен' });
    } catch (e) {
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
      }
    }
  });

  it('should reject update with empty name', async () => {
    await expect(
      caller.controlTypes.update({ id: ctId, name: '' })
    ).rejects.toThrow();
  });

  it('should not fail on non-existent id update', async () => {
    await expect(
      caller.controlTypes.update({ id: 9999, name: 'Ghost' })
    ).resolves.toBeDefined();
  });

  it('should delete a control type', async () => {
    await caller.controlTypes.delete({ id: ctId });
    const ct = await caller.controlTypes.get({ id: ctId });
    expect(ct).toBeNull();
  });

  it('should not fail on non-existent id delete', async () => {
    await expect(
      caller.controlTypes.delete({ id: 9999 })
    ).resolves.toBeDefined();
  });
});