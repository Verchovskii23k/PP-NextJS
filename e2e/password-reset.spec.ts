import { test, expect } from '@playwright/test';

test.describe('Password reset', () => {
  let adminLogin: string;

  test.beforeAll(async ({ request }) => {
    const resp = await request.post('/api/trpc/e2eTestHelpers.resetAndSeed', {
      data: { adminEmail: 'admin@test.com' },
    });
    const result = await resp.json();
    const data = result.result?.data;
    adminLogin = data.login;
  });

  test('reset password via UI', async ({ page }) => {
    await page.goto('/login');
    await page.click('a:has-text("Забыли пароль?")');
    await page.waitForURL('/forgot-password');
    await page.waitForLoadState('networkidle');

    await page.locator('label:text("Логин") + input').waitFor({ timeout: 10000 });
    await page.fill('label:text("Логин") + input', adminLogin);
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.click('button:has-text("Получить инструкцию")');

    // Ждём появления токена
    const tokenElement = page.locator('.border-yellow-400 .font-mono');
    await tokenElement.waitFor({ state: 'visible', timeout: 15000 });
    const token = await tokenElement.textContent();
    if (!token) throw new Error('Token not found');
    console.log('Token:', token);

    await page.goto(`/reset-password?token=${token}`);
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });

    const newPassword = 'newPass123';
    await page.fill('input[type="password"]', newPassword);
    await page.click('button:has-text("Сохранить")');

    // Дожидаемся перехода на /login
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');

    // Ждём появления поля логина
    await page.waitForSelector('input[placeholder="Логин"]', { timeout: 15000 });
    await page.fill('input[placeholder="Логин"]', adminLogin);
    await page.fill('input[placeholder="Пароль"]', newPassword);
    await page.click('button:has-text("Войти")');

    // Ждём перехода в админку
    await page.waitForURL(/\/admin/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/admin/);
  });
});