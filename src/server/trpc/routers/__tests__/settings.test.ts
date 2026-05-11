import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('settings', () => {
  it('should get an existing setting', async () => {
    const val = await caller.settings.get({ key: 'total_weeks' });
    expect(val).toBe('16');
  });

  it('should update a setting', async () => {
    await caller.settings.update({ key: 'total_weeks', value: '20' });
    const val = await caller.settings.get({ key: 'total_weeks' });
    expect(val).toBe('20');
    // вернём обратно
    await caller.settings.update({ key: 'total_weeks', value: '16' });
  });
});