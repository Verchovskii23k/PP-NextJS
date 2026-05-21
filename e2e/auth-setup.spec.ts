import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  let adminLogin: string;
  let adminPassword: string;

  test.beforeAll(async ({ request }) => {
    const resp = await request.post('/api/trpc/e2eTestHelpers.resetAndSeed', {
      data: { adminEmail: 'admin@test.com' },
    });
    const result = await resp.json();
    const data = result.result?.data;
    if (!data || !data.login || !data.password) {
      throw new Error('Failed to seed admin: ' + JSON.stringify(result));
    }
    adminLogin = data.login;
    adminPassword = data.password;
  });

  test('login with seeded admin', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.locator('input[placeholder="Email"]');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });

    await emailInput.fill(adminLogin);
    await page.fill('input[placeholder="Пароль"]', adminPassword);

    await page.click('button:has-text("Войти")');

    await page.waitForURL(/\/admin/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/admin/);
  });
});