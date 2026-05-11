import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData, seedAuthUser } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let adminUser: { login: string; password: string; userId: number };
let adminNoEmail: { login: string; password: string; userId: number };

beforeAll(async () => {
  await seedTestData();
  adminUser = await seedAuthUser('admin@test.local');       // с email
  adminNoEmail = await seedAuthUser(null);                  // без email
  caller = await createTestCaller({ id: adminUser.userId, role: 'admin' });
});

describe('auth', () => {
  it('should login with correct credentials', async () => {
    const result = await caller.auth.login({ login: adminUser.login, password: adminUser.password });
    expect(result).toHaveProperty('success', true);
  });

  it('should reject login with wrong password', async () => {
    await expect(
      caller.auth.login({ login: adminUser.login, password: 'wrong' })
    ).rejects.toThrow();
  });

  it('me should return current user', async () => {
    const me = await caller.auth.me();
    expect(me).not.toBeNull();
    expect(me?.login).toBe(adminUser.login);
  });

  it('forgotPassword should generate token (user without email)', async () => {
    const result = await caller.auth.forgotPassword({ login: adminNoEmail.login });
    // если email отсутствует, forgotPassword возвращает { token }
    expect(result).toHaveProperty('token');
  });

  it('resetPassword should work with valid token', async () => {
    const { token } = await caller.auth.forgotPassword({ login: adminNoEmail.login });
    if (!token) throw new Error('токен не получен');
    const result = await caller.auth.resetPassword({ token, newPassword: 'newpass123', newLogin: 'newadmin' });
    expect(result).toHaveProperty('success', true);
    // пробуем залогиниться с новым паролем
    const loginResult = await caller.auth.login({ login: 'newadmin', password: 'newpass123' });
    expect(loginResult).toHaveProperty('success', true);
  });
});