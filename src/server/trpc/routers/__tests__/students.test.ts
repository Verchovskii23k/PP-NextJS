// src/server/trpc/routers/__tests__/students.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import {
  clearAllTestData,
  createTestInstitute,
  createTestDepartment,
  createTestEducation,
  createTestSpecialty,
  createTestProfile,
  createTestUser,
} from '@/test/helpers';
import { db } from '@/db';
import { students, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let profileId: number;
let adminUserId: string;

beforeAll(async () => {
  await clearAllTestData();

  const instId = await createTestInstitute();
  const deptId = await createTestDepartment(instId);
  const eduId = await createTestEducation();
  const specId = await createTestSpecialty(deptId);
  profileId = await createTestProfile(specId, eduId);

  // Создаём пользователя-админа, под которым работаем
  adminUserId = await createTestUser({ email: 'admin@test.local', role: 'admin' });

  caller = await createTestCaller({ id: adminUserId, role: 'admin' });
});

describe('students CRUD', () => {
  let studentId: number;
  let studentWithUserId: number;

  it('should create a student', async () => {
    const [row] = await caller.students.create({
      surname: 'Тестов',
      name: 'Студент',
      admissionYear: 2023,
      profileId,
    });
    expect(row).toHaveProperty('id');
    studentId = row.id;
  });

  it('should reject empty surname or name', async () => {
    await expect(
      caller.students.create({
        surname: '',
        name: 'Имя',
        admissionYear: 2023,
        profileId,
      })
    ).rejects.toThrow();
    await expect(
      caller.students.create({
        surname: 'Фамилия',
        name: '',
        admissionYear: 2023,
        profileId,
      })
    ).rejects.toThrow();
  });

  it('should reject missing profileId', async () => {
    await expect(
      (caller.students.create as any)({
        surname: 'Ф',
        name: 'И',
        admissionYear: 2023,
      })
    ).rejects.toThrow();
  });

  it('should list students', async () => {
    const list = await caller.students.list();
    expect(list.some(s => s.id === studentId)).toBe(true);
  });

  it('should get existing student', async () => {
    const row = await caller.students.get({ id: studentId });
    expect(row).toMatchObject({
      surname: 'Тестов',
      name: 'Студент',
      admissionYear: 2023,
      profileId,
    });
  });

  it('should return null for non-existent id', async () => {
    const row = await caller.students.get({ id: 9999 });
    expect(row).toBeNull();
  });

  it('should update a student', async () => {
    await caller.students.update({ id: studentId, name: 'Обновлённый' });
    const row = await caller.students.get({ id: studentId });
    expect(row?.name).toBe('Обновлённый');
  });

  it('should reject update with empty surname', async () => {
    await expect(
      caller.students.update({ id: studentId, surname: '' })
    ).rejects.toThrow();
  });

  it('should not fail on non-existent id update', async () => {
    await expect(
      caller.students.update({ id: 9999, name: 'Ghost' })
    ).resolves.toBeDefined();
  });

  it('should delete a student without user', async () => {
    // Удаляем первого студента (без учётной записи)
    await caller.students.delete({ id: studentId });
    const row = await caller.students.get({ id: studentId });
    expect(row).toBeNull();
  });

  it('should reject deleting yourself (student with same userId)', async () => {
    // Создаём студента, привязанного к текущему пользователю
    const [row] = await db
      .insert(students)
      .values({
        surname: 'Сам',
        name: 'Себя',
        admissionYear: 2023,
        profileId,
        userId: adminUserId,
        isActive: true,
      })
      .returning({ id: students.id });
    studentWithUserId = row.id;

    await expect(
      caller.students.delete({ id: studentWithUserId })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.students.delete({ id: studentWithUserId });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('FORBIDDEN');
        expect(e.message).toBe('Нельзя удалить самого себя');
      }
    }
  });

  it('should delete a student with user (unlink + remove user)', async () => {
    // Используем того же студента, но с другим userId (не текущим)
    const otherUserId = await createTestUser({ email: 'other@test.local', role: 'student' });
    await db.update(students)
      .set({ userId: otherUserId })
      .where(eq(students.id, studentWithUserId));

    // Теперь удаляем
    await caller.students.delete({ id: studentWithUserId });
    const deletedStudent = await caller.students.get({ id: studentWithUserId });
    expect(deletedStudent).toBeNull();

    // Пользователь тоже должен быть удалён
    const [deletedUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, otherUserId))
      .limit(1);
    expect(deletedUser).toBeUndefined(); // или проверка на undefined/ null
  });

  it('should reject deleting non-existent student', async () => {
    await expect(
      caller.students.delete({ id: 9999 })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.students.delete({ id: 9999 });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('NOT_FOUND');
      }
    }
  });
});