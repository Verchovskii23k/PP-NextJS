import { config } from 'dotenv';
import { resolve } from 'path';
import { vi } from 'vitest';
config({ path: resolve(__dirname, '../../.env.test') });

vi.mock('next/headers', () => {
  const cookieStore = {
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
  };
  return {
    cookies: vi.fn().mockResolvedValue(cookieStore),
  };
});