import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import { clearAllTestData } from '@/test/helpers';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await clearAllTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('settings', () => {
  const TEST_KEY = 'total_weeks';
  const TEST_VALUE = '16';

  it('should return null for non-existent key', async () => {
    const val = await caller.settings.get({ key: 'nonexistent' });
    expect(val).toBeNull();
  });

  it('should create a new setting', async () => {
    await caller.settings.update({ key: TEST_KEY, value: TEST_VALUE });
    const val = await caller.settings.get({ key: TEST_KEY });
    expect(val).toBe(TEST_VALUE);
  });

  it('should update an existing setting', async () => {
    await caller.settings.update({ key: TEST_KEY, value: '20' });
    const val = await caller.settings.get({ key: TEST_KEY });
    expect(val).toBe('20');
  });

  it('should reject empty key', async () => {
    await expect(
      caller.settings.get({ key: '' })
    ).rejects.toThrow();

    await expect(
      caller.settings.update({ key: '', value: 'x' })
    ).rejects.toThrow();
  });

  it('should reject empty value', async () => {
    await expect(
      caller.settings.update({ key: 'some', value: '' })
    ).rejects.toThrow();
  });
});