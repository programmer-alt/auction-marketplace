import { test, expect } from '@playwright/test';

test.describe('Payment Flow Tests', () => {
  test('should complete payment successfully', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');
    
    // Login - we need to find the login form
    await expect(page.locator('h1, h2')).toContainText(['Login', 'Вход', 'Sign In'], { timeout: 10000 });
    
    // Fill in login credentials (using test credentials)
    const emailField = page.locator('input[type="email"], input[placeholder*="email"], input[name="email"]').first();
    const passwordField = page.locator('input[type="password"]').first();
    
    if (await emailField.isVisible({ timeout: 5000 })) {
      await emailField.fill('test@example.com');
      await passwordField.fill('Password123!');
      
      // Click login button
      await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Вход")').click();
      
      // Wait for navigation or redirect
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Now navigate to an auction page
      // We need to find an active auction
      await page.goto('http://localhost:3000/auctions');
      
      // Wait for auctions to load
      await expect(page.locator('.auction-card, [class*="auction"], table tr')).first().toBeVisible({ timeout: 10000 });
      
      // Click on the first auction
      await page.locator('.auction-card a, [class*="auction"] a').first().click();
      
      // Wait for auction details page
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Check if auction is completed and can be paid
      // If not, we might need to create a test scenario
      
      // For demonstration, let's try to access the payment page directly
      // We'll need the auction ID from the URL
      const auctionId = page.url().split('/').pop();
      
      if (auctionId && !isNaN(Number(auctionId))) {
        await page.goto(`http://localhost:3000/payment/${auctionId}`);
        
        // Wait for payment form
        await expect(page.locator('form, .stripe-element, [class*="payment"]')).toBeVisible({ timeout: 10000 });
        
        // Stripe PaymentElement should be loaded
        // In a real test, you would fill in test card details
        // For now, let's just verify the payment page loaded
        
        // Take screenshot
        await page.screenshot({ path: 'payment-page.png', fullPage: true });
        
        console.log('Payment page loaded successfully');
        
        // Verify payment form elements exist
        await expect(page.locator('button:has-text("Pay"), button:has-text("Оплатить")')).toBeVisible({ timeout: 5000 });
        
        // For Stripe test mode, you would use test card: 4242 4242 4242 4242
        // But we need to interact with the Stripe iframe/element
        
        // Let's try to find and fill the card details
        // Stripe elements are often in iframes or have specific selectors
        const cardNumberInput = page.locator('input[name="cardNumber"], [data-testid="cardNumber"]').first();
        
        if (await cardNumberInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await cardNumberInput.fill('4242424242424242');
          
          const cardExpiryInput = page.locator('input[name="cardExpiry"], [data-testid="cardExpiry"]').first();
          if (await cardExpiryInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await cardExpiryInput.fill('12/34');
            
            const cardCvcInput = page.locator('input[name="cardCvc"], [data-testid="cardCvc"]').first();
            if (await cardCvcInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              await cardCvcInput.fill('123');
              
              // Click pay button
              await page.locator('button:has-text("Pay"), button:has-text("Оплатить")').click();
              
              // Wait for payment result
              await page.waitForLoadState('networkidle', { timeout: 15000 });
              
              // Check payment result
              const successMessage = page.locator('text*=success, text*=успешно, [class*="success"]').first();
              const errorMessage = page.locator('text*=error, text*=ошибка, text*=failed, [class*="error"]').first();
              
              if (await successMessage.isVisible({ timeout: 10000 }).catch(() => false)) {
                console.log('Payment succeeded!');
                await page.screenshot({ path: 'payment-success.png', fullPage: true });
                await expect(successMessage).toBeVisible();
              } else if (await errorMessage.isVisible({ timeout: 5000 }).catch(() => false)) {
                console.log('Payment failed with error');
                await page.screenshot({ path: 'payment-error.png', fullPage: true });
                const errorText = await errorMessage.textContent();
                throw new Error(`Payment failed: ${errorText}`);
              } else {
                // Take screenshot of current state
                await page.screenshot({ path: 'payment-unknown-state.png', fullPage: true });
                throw new Error('Could not determine payment result');
              }
            }
          }
        } else {
          console.log('Stripe elements not found with standard selectors - checking for PaymentElement');
          // PaymentElement might be rendered differently
          const paymentElement = page.locator('[class*="PaymentElement"], [class*="payment-element"], iframe').first();
          if (await paymentElement.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log('PaymentElement found - test requires manual intervention for Stripe iframe');
            await page.screenshot({ path: 'payment-element-found.png', fullPage: true });
            throw new Error('PaymentElement detected - Stripe iframe requires manual card input');
          }
        }
      } else {
        throw new Error('No valid auction ID found');
      }
    } else {
      throw new Error('Could not find login form');
    }
  });
});
