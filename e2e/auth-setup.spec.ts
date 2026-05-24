import { test, expect } from '@playwright/test';

test.describe('Full registration and credentials generation flow', () => {
  const adminEmail = `admin-${Date.now()}@example.com`;
  const adminPassword = 'adminPass123';
  let employeeLogin: string;
  let employeePassword: string;

  test.beforeAll(async ({ request }) => {
    await request.post('/api/trpc/e2eTestHelpers.resetAndSeed', {
      data: {},
    });
  });

  test('register first admin, generate employee credentials, login as employee', async ({ page }) => {
    // === 1. Первичная регистрация ===
    await page.goto('/');
    await page.waitForTimeout(3000);

    const registerLink = page.locator('a:has-text("Зарегистрироваться")');
    await registerLink.waitFor({ state: 'visible', timeout: 10000 });
    await registerLink.click();
    await page.waitForURL('/setup');
    await page.waitForTimeout(3000);

    await page.fill('input[name="surname"]', 'Иванов');
    await page.fill('input[name="name"]', 'Иван');
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button:has-text("Создать администратора")');

    await expect(page.locator('text=Готово!')).toBeVisible({ timeout: 5000 });
    await page.click('a:has-text("Войти")');
    await page.waitForURL('/login');
    await page.waitForTimeout(3000);

    // === 2. Вход под администратором ===
    await page.fill('input[placeholder="Email"]', adminEmail);
    await page.fill('input[placeholder="Пароль"]', adminPassword);
    await page.click('button:has-text("Войти")');

    const adminDashboardLink = page.locator('a:has-text("Перейти в панель управления")');
    await adminDashboardLink.waitFor({ state: 'visible', timeout: 10000 });
    await adminDashboardLink.click();
    await page.waitForURL(/\/admin/);
    await page.waitForTimeout(3000);

    // === 3. Проверка прав администратора ===
    await page.goto('/admin/administrators');
    await page.waitForTimeout(3000);

    const adminRow = page.locator('tr', { hasText: 'Иванов Иван' });
    await expect(adminRow).toBeVisible();
    const toggle = adminRow.locator('button[class*="bg-primary"]');
    await expect(toggle).toBeVisible();

    // === 4. Генерация логинов и паролей ===
    await page.goto('/admin/credentials');
    await page.waitForTimeout(3000);

    const generateBtn = page.locator('button:has-text("Сгенерировать")');
    await generateBtn.click();

    const resultTable = page.locator('table');
    await resultTable.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(3000);

    const firstRow = resultTable.locator('tbody tr').first();
    const cells = firstRow.locator('td');
    employeeLogin = (await cells.nth(1).textContent())?.trim()!;
    employeePassword = (await cells.nth(2).textContent())?.trim()!;
    console.log(`Generated credentials: ${employeeLogin} / ${employeePassword}`);

    // === 5. Выход из системы ===
    const logoutBtn = page.locator('button:has-text("Выйти")');
    await logoutBtn.click();
    await expect(page).not.toHaveURL(/\/admin/, { timeout: 5000 });
    await page.waitForTimeout(3000);

    // === 6. Вход под новым сотрудником ===
    const loginLink = page.locator('a:has-text("Войти")');
    await loginLink.waitFor({ state: 'visible', timeout: 10000 });
    await loginLink.click();
    await page.waitForTimeout(3000);

    await page.fill('input[placeholder="Email"]', employeeLogin);
    await page.fill('input[placeholder="Пароль"]', employeePassword);
    const loginShowBtn = page.locator('button[aria-label="Показать пароль"]');
    await loginShowBtn.click();
    await page.click('button:has-text("Войти")');
    await page.waitForTimeout(3000);

    const teacherDashboardLink = page.locator('a:has-text("Перейти в панель управления")');
    await teacherDashboardLink.waitFor({ state: 'visible', timeout: 10000 });
    await teacherDashboardLink.click();
    await page.waitForTimeout(5000);

    await page.waitForURL(/\/teacher/);
    await expect(page).toHaveURL(/\/teacher/);
    await expect(page.locator('h1:has-text("Раздел преподавателя")')).toBeVisible();
  });
});