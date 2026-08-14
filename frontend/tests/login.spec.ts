import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('[data-testid="login-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-submit"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Вход в аккаунт');
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.locator('[data-testid="login-submit"]').click();
    
    // React-hook-form should show validation errors
    await expect(page.locator('.text-red-600')).toBeVisible({ timeout: 5000 });
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    await page.locator('[data-testid="login-email"]').fill('test@example.com');
    await page.locator('[data-testid="login-password"]').fill('Password123!');
    await page.locator('[data-testid="login-submit"]').click();
    
    // Should redirect to home page after successful login
    await page.waitForURL(/^(http:\/\/localhost:3000\/)?$/, { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Аукционы');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.locator('[data-testid="login-email"]').fill('wrong@example.com');
    await page.locator('[data-testid="login-password"]').fill('WrongPassword123!');
    await page.locator('[data-testid="login-submit"]').click();
    
    // Should show toast error
    await expect(page.locator('[role="alert"], .toast, [class*="toast"]')).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to register page', async ({ page }) => {
    await page.locator('a[href="/register"]').click();
    await expect(page).toHaveURL('/register');
  });

  test('should disable submit button while loading', async ({ page }) => {
    await page.locator('[data-testid="login-email"]').fill('test@example.com');
    await page.locator('[data-testid="login-password"]').fill('Password123!');
    
    const submitButton = page.locator('[data-testid="login-submit"]');
    await submitButton.click();
    
    // Loading state should show spinner
    await expect(page.locator('.animate-spin')).toBeVisible({ timeout: 3000 });
    await expect(submitButton).toBeDisabled();
  });
});
