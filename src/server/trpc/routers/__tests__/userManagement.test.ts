import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import { seedAuthUser, seedTestData } from '@/test/fixtures/fixtures';
import { db } from '@/db';
import { users } from '@/db/schema';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let adminUser: { email: string; password: string; userId: string };
let userWithoutEmailId: string;



describe('userManagement', () => {
  it('placeholder', () => { expect(true).toBe(true) });
});