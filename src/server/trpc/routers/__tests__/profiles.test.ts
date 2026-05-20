// src/server/trpc/routers/__tests__/profiles.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import {
  clearAllTestData,
  createTestInstitute,
  createTestDepartment,
  createTestSpecialty,
  createTestEducation,
  createTestProfile,
  createTestStudent,
  createTestStudyGroup,
} from '@/test/helpers';
import { db } from '@/db';
import { TRPCError } from '@trpc/server';
import { students, studyGroups } from '@/db/schema';
import { eq } from 'drizzle-orm';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let specialtyId: number;
let educationId: number;

beforeAll(async () => {
  await clearAllTestData();

  const instId = await createTestInstitute();
  const deptId = await createTestDepartment(instId);
  specialtyId = await createTestSpecialty(deptId);
  educationId = await createTestEducation();

  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('profiles CRUD', () => {
  let profileId: number;
  let secondProfileId: number;

  it('should create a profile', async () => {
    const [row] = await caller.profiles.create({
      name: 'Тестовый профиль',
      specialtyId,
      letterCode: 'т',
      educationId,
    });
    expect(row).toHaveProperty('id');
    profileId = row.id;
  });

  it('should reject duplicate letterCode + specialtyId', async () => {
    await expect(
      caller.profiles.create({
        name: 'Другой',
        specialtyId,
        letterCode: 'т',
      })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.profiles.create({
        name: 'Другой',
        specialtyId,
        letterCode: 'т',
      });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
        expect(e.message).toBe('Профиль с таким буквенным кодом и специальностью уже существует');
      }
    }
  });

  it('should reject empty name or letterCode', async () => {
    await expect(
      caller.profiles.create({
        name: '',
        specialtyId,
        letterCode: 'а',
      })
    ).rejects.toThrow();
    await expect(
      caller.profiles.create({
        name: 'Имя',
        specialtyId,
        letterCode: '',
      })
    ).rejects.toThrow();
  });

  it('should list profiles and contain created one', async () => {
    const list = await caller.profiles.list();
    expect(list.some(p => p.id === profileId)).toBe(true);
    // Проверим, что display поля заполнены
    const created = list.find(p => p.id === profileId);
    expect(created?.profileDisplay).toBeDefined();
    if (educationId) {
      expect(created?.educationDisplay).toBeDefined();
    }
  });

  it('should get existing profile', async () => {
    const row = await caller.profiles.get({ id: profileId });
    expect(row).toMatchObject({
      name: 'Тестовый профиль',
      specialtyId,
      letterCode: 'т',
    });
    expect(row?.profileDisplay).toBeDefined();
  });

  it('should return null for non-existent id', async () => {
    const row = await caller.profiles.get({ id: 9999 });
    expect(row).toBeNull();
  });

  it('should update name', async () => {
    await caller.profiles.update({ id: profileId, name: 'Обновлённый профиль' });
    const row = await caller.profiles.get({ id: profileId });
    expect(row?.name).toBe('Обновлённый профиль');
  });

  it('should reject update to duplicate letterCode+specialty', async () => {
    // Создаём второй профиль
    const [row2] = await caller.profiles.create({
      name: 'Второй',
      specialtyId,
      letterCode: 'к',
    });
    secondProfileId = row2.id;

    // Пытаемся обновить второй на комбинацию первого
    await expect(
      caller.profiles.update({ id: secondProfileId, letterCode: 'т', specialtyId })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.profiles.update({ id: secondProfileId, letterCode: 'т', specialtyId });
    } catch (e) {
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
      }
    }
  });

  it('should reject update with empty name', async () => {
    await expect(
      caller.profiles.update({ id: profileId, name: '' })
    ).rejects.toThrow();
  });

  it('should not fail on non-existent id update', async () => {
    await expect(
      caller.profiles.update({ id: 9999, name: 'Ghost' })
    ).resolves.toBeDefined();
  });

  it('should delete existing profile', async () => {
    await caller.profiles.delete({ id: secondProfileId });
    const row = await caller.profiles.get({ id: secondProfileId });
    expect(row).toBeNull();
  });

  it('should not fail on non-existent id delete', async () => {
    await expect(
      caller.profiles.delete({ id: 9999 })
    ).resolves.toBeDefined();
  });

  it('should reject deletion if linked to studyGroups or students', async () => {
    // Создаём профиль, привязываем к нему студента
    const [prof] = await caller.profiles.create({
      name: 'Связанный профиль',
      specialtyId,
      letterCode: 'с',
    });
    await db.insert(students).values({
      surname: 'Иванов',
      name: 'Иван',
      admissionYear: 2023,
      profileId: prof.id,
      isActive: true,
    });

    await expect(
      caller.profiles.delete({ id: prof.id })
    ).rejects.toThrow(/Невозможно удалить/);
  });
});