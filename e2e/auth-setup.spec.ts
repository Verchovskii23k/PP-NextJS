import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  let adminLogin: string;
  let adminPassword: string;

  test.beforeAll(async ({ request }) => {
    const resp = await request.post('/api/trpc/e2eTestHelpers.resetAndSeed', {
      data: { adminEmail: 'admin@test.com' },
    });
    const result = await resp.json();
    console.log('API response:', JSON.stringify(result));
    const data = result.result?.data;
    if (!data || !data.login || !data.password) {
      throw new Error('Failed to seed admin: ' + JSON.stringify(result));
    }
    adminLogin = data.login;
    adminPassword = data.password;
    console.log('Admin login:', adminLogin);
  });

  test('login with seeded admin', async ({ page }) => {
    await page.goto('/login');

    const loginInput = page.locator('input[placeholder="Логин"]');
    await loginInput.waitFor({ state: 'visible', timeout: 10000 });

    // Ждём, чтобы useEffect отработал и очистка поля завершилась
    await page.waitForTimeout(300);

    await loginInput.fill(adminLogin);
    await page.fill('input[placeholder="Пароль"]', adminPassword);

    await page.click('button:has-text("Войти")');

    await page.waitForURL(/\/admin/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/admin/);
  });
});