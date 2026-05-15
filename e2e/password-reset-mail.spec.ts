import { test, expect } from '@playwright/test';

async function isMailpitRunning(): Promise<boolean> {
  try {
    const resp = await fetch('http://localhost:8025/api/v1/messages');
    return resp.ok;
  } catch {
    return false;
  }
}

async function getLastEmailToken(): Promise<string | null> {
  const resp = await fetch('http://localhost:8025/api/v1/messages');
  if (!resp.ok) {
    console.log('Mailpit API not ok:', resp.status);
    return null;
  }
  const data = await resp.json();
  const messages = Array.isArray(data) ? data : (data.messages || []);
  console.log('Mailpit messages count:', messages.length);
  if (messages.length === 0) return null;

  const lastMsg = messages[messages.length - 1];
  const detailResp = await fetch(`http://localhost:8025/api/v1/message/${lastMsg.ID}`);
  if (!detailResp.ok) return null;
  const detail = await detailResp.json();
  const body = detail.Text || detail.HTML || '';
  // Ищем токен в ссылке вида ?token=... или просто 64-символьную hex-строку
  const match = body.match(/token=([0-9a-f]{64})/i) || body.match(/[0-9a-f]{64}/i);
  return match ? match[1] || match[0] : null;
}

test.describe('Password reset via Mailpit', () => {
  let adminLogin: string;

  test.beforeAll(async ({ request }) => {
    if (!(await isMailpitRunning())) {
      console.warn('Mailpit is not running – skipping e2e mail tests');
      return;
    }
    const resp = await request.post('/api/trpc/e2eTestHelpers.resetAndSeed', {
      data: { adminEmail: 'admin@test.com' },
    });
    const result = await resp.json();
    const data = result.result?.data;
    adminLogin = data.login;
  });

  test('reset password via email', async ({ page }) => {
    if (!adminLogin) {
      console.warn('Mailpit unavailable, test skipped');
      return;
    }

    await page.goto('/login');
    await page.click('a:has-text("Забыли пароль?")');
    await page.waitForURL('/forgot-password');
    await page.waitForLoadState('networkidle');

    await page.locator('label:text("Логин") + input').waitFor({ timeout: 10000 });
    await page.fill('label:text("Логин") + input', adminLogin);
    await page.fill('input[type="email"]', 'admin@test.com');

    await page.click('button:has-text("Получить инструкцию")');

    // Ждём появления либо зелёного сообщения, либо жёлтого блока, либо ошибки
    const greenMessage = page.locator('.border-green-400');
    const yellowToken = page.locator('.border-yellow-400 .font-mono');
    const errorMessage = page.locator('.text-red-500');

    try {
      await Promise.race([
        greenMessage.waitFor({ state: 'visible', timeout: 20000 }),
        yellowToken.waitFor({ state: 'visible', timeout: 20000 }),
        errorMessage.waitFor({ state: 'visible', timeout: 20000 }),
      ]);
    } catch {
      // Если ничего не появилось – делаем скриншот и выводим текст страницы
      await page.screenshot({ path: 'debug-forgot.png' });
      const bodyText = await page.textContent('body');
      console.log('Page body:', bodyText);
      throw new Error('Neither success, token, nor error appeared');
    }

    const isGreen = await greenMessage.isVisible();
    const isYellow = await yellowToken.isVisible();

    if (isYellow) {
      console.warn('SMTP not configured, token shown on page. Skipping email test.');
      return;
    }

    if (isGreen) {
      const token = await getLastEmailToken();
      if (!token) throw new Error('Token not found in Mailpit email');
      console.log('Mail token:', token);

      await page.goto(`/reset-password?token=${token}`);
      await page.waitForSelector('input[type="password"]', { timeout: 10000 });

      const newPassword = 'mailPass456';
      await page.fill('input[type="password"]', newPassword);
      await page.click('button:has-text("Сохранить")');

      await page.waitForURL('/login');
      await expect(page).toHaveURL('/login');

      await page.fill('input[placeholder="Логин"]', adminLogin);
      await page.fill('input[placeholder="Пароль"]', newPassword);
      await page.click('button:has-text("Войти")');
      await page.waitForURL(/\/admin/);
      await expect(page).toHaveURL(/\/admin/);
    }
  });
});