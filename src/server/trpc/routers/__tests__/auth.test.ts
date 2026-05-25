import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import { clearAllTestData } from '@/test/helpers';
import { db } from '@/db';
import { users, employees } from '@/db/schema';


let caller: Awaited<ReturnType<typeof createTestCaller>>;
let adminUserId: string;
let adminEmail: string;

beforeAll(async () => {
  await clearAllTestData();

  // Создаём учётную запись админа напрямую
  const [user] = await db
    .insert(users)
    .values({
      email: 'admin@test.local',
      hashedPassword: 'hashed',
      role: 'admin',
    })
    .returning({ id: users.id });
  adminUserId = user.id;
  adminEmail = 'admin@test.local';

  // Привязываем сотрудника к этой учётной записи (чтобы me вернул fullName)
  await db.insert(employees).values({
    surname: 'Администратор',
    name: 'Тестовый',
    patronymic: 'Тестович',
    userId: adminUserId,
    isAdmin: true,
    isActive: true,
  });

  caller = await createTestCaller({ id: adminUserId, role: 'admin' });
});

describe('auth', () => {
  it('me возвращает текущего пользователя', async () => {
    const me = await caller.auth.me();
    expect(me).not.toBeNull();
    expect(me?.email).toBe(adminEmail);
    // Проверим, что fullName формируется
    expect(me?.fullName).toContain('Администратор');
  });

  it('forgotPassword возвращает сообщение (пользователь с email)', async () => {
    const result = await caller.auth.forgotPassword({ email: adminEmail });
    expect(result).toHaveProperty('message');
  }, 15000);
});