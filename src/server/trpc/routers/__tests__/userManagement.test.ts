import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData, seedAuthUser } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let adminNoEmail: { login: string; password: string; userId: number };

beforeAll(async () => {
  await seedTestData();
  adminNoEmail = await seedAuthUser(null);  // без email
  caller = await createTestCaller({ id: adminNoEmail.userId, role: 'admin' });
});

describe('userManagement', () => {
  it('adminResetCredentials should return login and password when email is missing', async () => {
    const result = await caller.userManagement.adminResetCredentials({ userId: adminNoEmail.userId });
    expect(result).toHaveProperty('emailSent', false);
    expect(result).toHaveProperty('login');
    expect(result).toHaveProperty('password');
  });
});