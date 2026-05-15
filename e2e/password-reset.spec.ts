// e2e/password-reset.spec.ts
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

    // Заполняем логин и email
    await page.locator('label:text("Логин") + input').waitFor({ timeout: 10000 });
    await page.fill('label:text("Логин") + input', adminLogin);
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.click('button:has-text("Получить инструкцию")');

    // Ждём появления жёлтого блока с токеном или зелёного сообщения
    const tokenElement = page.locator('.border-yellow-400 .font-mono');
    const messageElement = page.locator('.border-green-400');
    await Promise.race([
      tokenElement.waitFor({ state: 'visible', timeout: 15000 }),
      messageElement.waitFor({ state: 'visible', timeout: 15000 }),
    ]);

    let token: string | null = null;
    if (await tokenElement.isVisible()) {
      token = await tokenElement.textContent();
    } else {
      // Пробуем получить токен из Mailpit, если появилось сообщение
      try {
        const mResp = await fetch('http://localhost:8025/api/v1/messages');
        if (mResp.ok) {
          const messages = await mResp.json() as any[];
          const lastMsg = messages?.[messages.length - 1];
          if (lastMsg) {
            const dResp = await fetch(`http://localhost:8025/api/v1/message/${lastMsg.ID}`);
            if (dResp.ok) {
              const detail = await dResp.json() as any;
              const body = detail.Text || detail.HTML || '';
              const match = body.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
              token = match ? match[0] : null;
            }
          }
        }
      } catch {}
    }

    if (!token) throw new Error('Token not found on page or in email');
    console.log('Token:', token);

    await page.goto(`/reset-password?token=${token}`);
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });

    const newPassword = 'newPass123';
    await page.fill('input[type="password"]', newPassword);
    await page.click('button:has-text("Сохранить")');

    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');

    await page.fill('input[placeholder="Логин"]', adminLogin);
    await page.fill('input[placeholder="Пароль"]', newPassword);
    await page.click('button:has-text("Войти")');
    await page.waitForURL(/\/admin/);
    await expect(page).toHaveURL(/\/admin/);
  });
});