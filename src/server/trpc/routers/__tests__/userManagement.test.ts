// src/server/trpc/routers/__tests__/userManagement.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/db';
import { users, employees, students, accounts, verificationTokens, profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createTestCaller } from '@/test/trpc';
import { clearAllTestData, createTestUser, createTestEmployee, createTestProfile, createTestSpecialty, createTestDepartment, createTestInstitute, createTestEducation } from '@/test/helpers';
import * as emailModule from '@/server/email';

vi.mock('@/server/email', () => ({
  sendResetCodeEmail: vi.fn().mockResolvedValue(undefined),
  sendNewCredentialsEmail: vi.fn().mockResolvedValue(undefined),
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

describe('userManagement', () => {
  beforeEach(async () => {
    await clearAllTestData();

    const instId = await createTestInstitute();
    const deptId = await createTestDepartment(instId);
    const specId = await createTestSpecialty(deptId);
    const eduId = await createTestEducation();
    await createTestProfile(specId, eduId);

    // Администратор
    const adminUserId = await createTestUser({ email: 'admin@test.com', role: 'admin' });
    await createTestEmployee({ userId: adminUserId, isAdmin: true });

    // Преподаватель
    const teacherUserId = await createTestUser({ email: 'teacher@test.com', role: 'teacher' });
    await createTestEmployee({ userId: teacherUserId, surname: 'Тестовый', name: 'Сотрудник', patronymic: 'Тестович' });

    // Студент
    const studentUserId = await createTestUser({ email: 'student@test.com', role: 'student' });
    const [profile] = await db.select({ id: profiles.id }).from(profiles).limit(1);
    if (profile) {
      await db.insert(students).values({
        surname: 'Тестов',
        name: 'Студент',
        admissionYear: 2023,
        profileId: profile.id,
        userId: studentUserId,
        isActive: true,
      });
    }

    // Полностью очищаем таблицу verificationTokens перед каждым тестом
    await db.delete(verificationTokens);

    caller = await createTestCaller({ id: adminUserId, role: 'admin' });
  });

  describe('getUsers', () => {
    it('должен вернуть список всех пользователей', async () => {
      const result = await caller.userManagement.getUsers({});
      expect(result).toHaveLength(3);
    });

    it('должен фильтровать по роли teacher', async () => {
      const result = await caller.userManagement.getUsers({ role: 'teacher' });
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('teacher');
    });

    it('должен фильтровать по роли student', async () => {
      const result = await caller.userManagement.getUsers({ role: 'student' });
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('student');
    });

    it('должен возвращать fullName для преподавателя', async () => {
      const result = await caller.userManagement.getUsers({ role: 'teacher' });
      expect(result[0].fullName).toBe('Тестовый Сотрудник Тестович');
    });

    it('должен возвращать fullName для студента', async () => {
      const result = await caller.userManagement.getUsers({ role: 'student' });
      expect(result[0].fullName).toBe('Тестов Студент');
    });
  });

  describe('updateRole', () => {
    it('должен изменить роль пользователя', async () => {
      const teacherUser = await db.select().from(users).where(eq(users.email, 'teacher@test.com')).limit(1);
      const teacherId = teacherUser[0].id;

      const result = await caller.userManagement.updateRole({
        userId: teacherId,
        newRole: 'student',
      });
      expect(result.success).toBe(true);

      const updated = await db.select().from(users).where(eq(users.id, teacherId)).limit(1);
      expect(updated[0].role).toBe('student');
    });

    it('должен вернуть ошибку при попытке изменить роль администратора', async () => {
      const adminUser = await db.select().from(users).where(eq(users.email, 'admin@test.com')).limit(1);
      const adminId = adminUser[0].id;

      await expect(caller.userManagement.updateRole({
        userId: adminId,
        newRole: 'student',
      })).rejects.toThrow('Нельзя изменить роль администратора');
    });

    it('должен вернуть ошибку при попытке изменить собственную роль (админ меняет админа) – та же ошибка', async () => {
      const adminUser = await db.select().from(users).where(eq(users.email, 'admin@test.com')).limit(1);
      const adminId = adminUser[0].id;

      await expect(caller.userManagement.updateRole({
        userId: adminId,
        newRole: 'student',
      })).rejects.toThrow('Нельзя изменить роль администратора');
    });

    it('должен вернуть ошибку если пользователь не найден', async () => {
      await expect(caller.userManagement.updateRole({
        userId: 'non-existent-id',
        newRole: 'teacher',
      })).rejects.toThrow('Пользователь не найден');
    });
  });

  describe('sendResetCode', () => {
    it('должен отправить код сброса на email пользователя', async () => {
      const teacherUser = await db.select().from(users).where(eq(users.email, 'teacher@test.com')).limit(1);
      const teacherId = teacherUser[0].id;

      const result = await caller.userManagement.sendResetCode({ userId: teacherId });
      expect(result.success).toBe(true);

      const tokens = await db.select().from(verificationTokens).where(eq(verificationTokens.identifier, teacherId));
      expect(tokens).toHaveLength(1);
      expect(tokens[0].token).toMatch(/^\d{3}$/);
      expect(tokens[0].expires).toBeInstanceOf(Date);

      expect(emailModule.sendResetCodeEmail).toHaveBeenCalledWith(teacherUser[0].email, tokens[0].token);
    });

    it('должен удалить старые коды перед созданием нового', async () => {
      const teacherUser = await db.select().from(users).where(eq(users.email, 'teacher@test.com')).limit(1);
      const teacherId = teacherUser[0].id;

      // Сначала создаём старый код через прямой вызов роутера (он генерирует уникальный код)
      await caller.userManagement.sendResetCode({ userId: teacherId });
      
      // Получаем первый код
      const firstTokens = await db.select().from(verificationTokens).where(eq(verificationTokens.identifier, teacherId));
      expect(firstTokens).toHaveLength(1);
      const firstToken = firstTokens[0].token;

      // Вызываем повторно - должен удалить старый и создать новый
      await caller.userManagement.sendResetCode({ userId: teacherId });

      // Проверяем, что осталась только одна запись и токен изменился
      const secondTokens = await db.select().from(verificationTokens).where(eq(verificationTokens.identifier, teacherId));
      expect(secondTokens).toHaveLength(1);
      expect(secondTokens[0].token).not.toBe(firstToken);
    });

    it('должен вернуть ошибку если пользователь не найден', async () => {
      await expect(caller.userManagement.sendResetCode({ userId: 'non-existent' }))
        .rejects.toThrow('Пользователь не найден');
    });
  });

  describe('confirmResetCode', () => {
    it('должен подтвердить код и сбросить пароль', async () => {
      const teacherUser = await db.select().from(users).where(eq(users.email, 'teacher@test.com')).limit(1);
      const teacherId = teacherUser[0].id;

      // Генерируем код через роутер, чтобы он был уникальным
      await caller.userManagement.sendResetCode({ userId: teacherId });
      const tokens = await db.select().from(verificationTokens).where(eq(verificationTokens.identifier, teacherId));
      const code = tokens[0].token;

      const result = await caller.userManagement.confirmResetCode({
        userId: teacherId,
        code,
      });
      expect(result.success).toBe(true);
      expect(result.newPassword).toBeNull();
      expect(result.message).toBe('Новый пароль отправлен на email');

      const [updatedUser] = await db.select().from(users).where(eq(users.id, teacherId));
      expect(updatedUser.hashedPassword).not.toBe(teacherUser[0].hashedPassword);

      const [account] = await db.select().from(accounts).where(eq(accounts.userId, teacherId));
      expect(account).toBeDefined();
      expect(account.providerId).toBe('credential');

      expect(emailModule.sendNewCredentialsEmail).toHaveBeenCalledWith(teacherUser[0].email, expect.any(String));

      const remainingTokens = await db.select().from(verificationTokens).where(eq(verificationTokens.identifier, teacherId));
      expect(remainingTokens).toHaveLength(0);
    });

    it('должен вернуть ошибку при неверном коде', async () => {
      const teacherUser = await db.select().from(users).where(eq(users.email, 'teacher@test.com')).limit(1);
      const teacherId = teacherUser[0].id;

      // Создаём код через роутер
      await caller.userManagement.sendResetCode({ userId: teacherId });
      const tokens = await db.select().from(verificationTokens).where(eq(verificationTokens.identifier, teacherId));
      const correctCode = tokens[0].token;

      // Пытаемся подтвердить с неверным кодом
      await expect(caller.userManagement.confirmResetCode({
        userId: teacherId,
        code: 'wrong',
      })).rejects.toThrow('Неверный или истёкший код');
    });

    it('должен вернуть ошибку при истёкшем коде', async () => {
      const teacherUser = await db.select().from(users).where(eq(users.email, 'teacher@test.com')).limit(1);
      const teacherId = teacherUser[0].id;

      // Создаём код, но с истекшим сроком (вручную обновляем expires)
      await caller.userManagement.sendResetCode({ userId: teacherId });
      await db.update(verificationTokens)
        .set({ expires: new Date(Date.now() - 10000) })
        .where(eq(verificationTokens.identifier, teacherId));

      const tokens = await db.select().from(verificationTokens).where(eq(verificationTokens.identifier, teacherId));
      const expiredCode = tokens[0].token;

      await expect(caller.userManagement.confirmResetCode({
        userId: teacherId,
        code: expiredCode,
      })).rejects.toThrow('Неверный или истёкший код');
    });
  });

  describe('resetUserPassword', () => {
    it('должен напрямую сбросить пароль пользователя (без кода)', async () => {
      const teacherUser = await db.select().from(users).where(eq(users.email, 'teacher@test.com')).limit(1);
      const teacherId = teacherUser[0].id;
      const oldHash = teacherUser[0].hashedPassword;

      const result = await caller.userManagement.resetUserPassword({ userId: teacherId });
      expect(result.success).toBe(true);
      expect(result.newPassword).toBeNull();

      const [updatedUser] = await db.select().from(users).where(eq(users.id, teacherId));
      expect(updatedUser.hashedPassword).not.toBe(oldHash);

      const [account] = await db.select().from(accounts).where(eq(accounts.userId, teacherId));
      expect(account).toBeDefined();
      expect(emailModule.sendNewCredentialsEmail).toHaveBeenCalledWith(teacherUser[0].email, expect.any(String));
    });

    it('должен вернуть ошибку если пользователь не найден', async () => {
      await expect(caller.userManagement.resetUserPassword({ userId: 'non-existent' }))
        .rejects.toThrow('Пользователь не найден');
    });
  });
});