import { test, expect } from '@playwright/test';

async function clearMailpit() {
  try {
    await fetch('http://localhost:8025/api/v1/messages', { method: 'DELETE' });
  } catch {}
}

interface MailpitMessage {
  ID: string;
}

interface MailpitMessageDetail {
  Text?: string;
  HTML?: string;
}

async function getLastEmailToken(): Promise<string | null> {
  const resp = await fetch('http://localhost:8025/api/v1/messages');
  if (!resp.ok) return null;
  const data: MailpitMessage[] | { messages: MailpitMessage[] } = await resp.json();
  const list: MailpitMessage[] = Array.isArray(data) ? data : (data.messages || []);
  if (list.length === 0) return null;

  const lastMsg = list[list.length - 1];
  const detailResp = await fetch(`http://localhost:8025/api/v1/message/${lastMsg.ID}`);
  if (!detailResp.ok) return null;
  const detail: MailpitMessageDetail = await detailResp.json();

  const body = detail.Text || detail.HTML || '';
  const match = body.match(/token=([0-9a-f]{64})/i) || body.match(/[0-9a-f]{64}/i);
  return match ? (match[1] || match[0]) : null;
}

test.describe('Password reset via Mailpit', () => {
  let adminLogin: string;

  test.beforeAll(async ({ request }) => {
    await clearMailpit();

    const resp = await request.post('/api/trpc/e2eTestHelpers.resetAndSeed', {
      data: { adminEmail: 'admin@test.com' },
    });
    const result = await resp.json();
    const data = result.result?.data;
    adminLogin = data.login;
  });

  test('reset password via email', async ({ page }) => {
    await page.goto('/login');
    await page.click('a:has-text("Забыли пароль?")');
    await page.waitForURL('/forgot-password');

    const emailInput = page.locator('input[type="email"]');
    await emailInput.waitFor({ timeout: 10000 });
    await emailInput.fill('admin@test.com');
    await page.click('button:has-text("Восстановить пароль")');

    // Ожидаем появления зелёного сообщения об успехе
    await page.waitForSelector('.text-green-600', { timeout: 15000 });

    const token = await getLastEmailToken();
    if (!token) throw new Error('Token not found in Mailpit');
    console.log('Mail token:', token);

    await page.goto(`/reset-password?token=${token}`);
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });

    const newPassword = 'mailPass456';
    await page.fill('input[type="password"]', newPassword);
    await page.click('button:has-text("Сохранить")');

    // Успешный сброс редиректит на /login
    await page.waitForURL('/login', { timeout: 10000 });
    await expect(page).toHaveURL('/login');

    // Логин с новым паролем
    await page.fill('input[placeholder="Email"]', adminLogin);
    await page.fill('input[placeholder="Пароль"]', newPassword);
    await page.click('button:has-text("Войти")');
    await page.waitForURL(/\/admin/);
    await expect(page).toHaveURL(/\/admin/);
  });
});