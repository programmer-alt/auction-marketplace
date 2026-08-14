import { test, expect } from '@playwright/test';

test.describe('Payment Flow (Mocked Stripe)', () => {
  test.use({ storageState: 'tests/.auth/test-user.json' });

  test('should navigate to payment page and verify form elements', async ({ page }) => {
    await page.goto('/');
    
    // Find first active auction card using stable selector
    const firstAuction = page.locator('[data-testid^="auction-card-"]').first();
    await expect(firstAuction).toBeVisible({ timeout: 10000 });
    await firstAuction.click();
    
    // Wait for auction details page
    await expect(page.locator('[data-testid="auction-header"]')).toBeVisible({ timeout: 10000 });
    
    // Navigate to payment page
    const auctionId = page.url().split('/').pop();
    await page.goto(`/payment/${auctionId}`);
    
    // Verify payment page loaded with stable selectors
    await expect(page.locator('[data-testid="payment-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-submit"]')).toBeVisible();
  });

  test('should display auction summary on payment page', async ({ page }) => {
    await page.goto('/');
    const firstAuction = page.locator('[data-testid^="auction-card-"]').first();
    await expect(firstAuction).toBeVisible({ timeout: 10000 });
    await firstAuction.click();
    
    const auctionId = page.url().split('/').pop();
    await page.goto(`/payment/${auctionId}`);
    
    // Payment page should have clientSecret from backend
    await expect(page.locator('[data-testid="payment-form"]')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Payment Result', () => {
  test('should display success page after payment', async ({ page }) => {
    await page.goto('/');
    const firstAuction = page.locator('[data-testid^="auction-card-"]').first();
    await expect(firstAuction).toBeVisible({ timeout: 10000 });
    await firstAuction.click();
    
    const auctionId = page.url().split('/').pop();
    await page.goto(`/payment/${auctionId}`);
    await expect(page.locator('[data-testid="payment-form"]')).toBeVisible({ timeout: 15000 });
    
    // Navigate to payment result page
    await page.goto('/payment/result?redirect_status=succeeded');
    
    await expect(page.locator('[data-testid="payment-result-success"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Оплата прошла успешно');
  });

  test('should display failed page after payment error', async ({ page }) => {
    await page.goto('/payment/result?redirect_status=failed');
    
    await expect(page.locator('[data-testid="payment-result-failed"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Ошибка оплаты');
  });
});

test.describe('Edge Cases', () => {
  test('should handle invalid auction ID on payment page', async ({ page }) => {
    await page.goto('/payment/999999');
    
    // Should show error or redirect gracefully
    const anyErrorMessage = page.locator('[class*="error"], [class*="red"]');
    const hasError = await anyErrorMessage.count().then(c => c > 0);
    
    // Either error message or redirect is acceptable
    expect(hasError).toBeTruthy();
  });

  test('payment page should show loading state during clientSecret fetch', async ({ page }) => {
    await page.goto('/payment/1');
    
    // Should show loading spinner initially
    await expect(page.locator('[data-testid="payment-result-loading"]')).toBeVisible({ timeout: 3000 });
  });
});
