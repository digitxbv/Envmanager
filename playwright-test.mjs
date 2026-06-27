import { chromium } from '@playwright/test';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  console.log('🏠 Navigating to homepage...');
  await page.goto('http://localhost:4400');
  await page.waitForLoadState('networkidle');
  await delay(2000);

  console.log('🔍 Looking for Sign Up button...');
  // Click on Sign Up button in the header
  await page.click('text=Sign Up');
  await page.waitForLoadState('networkidle');
  await delay(2000);

  console.log('📝 On registration page, filling form...');

  // Generate unique email for this test
  const timestamp = Date.now();
  const testEmail = `test${timestamp}@example.com`;
  const testPassword = 'TestPassword123!';

  console.log(`📧 Using email: ${testEmail}`);

  // Fill in the registration form
  await page.fill('input[type="email"]', testEmail);
  await delay(1000);

  await page.fill('input[type="password"]', testPassword);
  await delay(1000);

  console.log('🚀 Submitting registration form...');
  // Click the sign up button
  await page.click('button:has-text("Sign Up")');

  // Wait for response
  await delay(5000);

  // Check current URL and page state
  const currentUrl = page.url();
  console.log(`📍 Current URL after signup: ${currentUrl}`);

  // Check for any error messages
  const pageContent = await page.content();
  if (pageContent.includes('error') || pageContent.includes('Error')) {
    console.log('⚠️ Possible error detected on page');

    // Try to find and log any visible error messages
    const errorElements = await page.$$('[class*="error"], [class*="Error"], [role="alert"]');
    for (const element of errorElements) {
      const text = await element.textContent();
      if (text) console.log(`   Error message: ${text}`);
    }
  }

  // Check if we got redirected to dashboard or confirmation page
  if (currentUrl.includes('dashboard')) {
    console.log('✅ Successfully reached dashboard!');

    // Explore dashboard
    await delay(2000);
    console.log('🔍 Exploring dashboard...');

    // Look for "New Project" or "Create Project" button
    try {
      const newProjectBtn = await page.locator('button:has-text("New Project"), button:has-text("Create Project"), a:has-text("New Project")').first();
      if (await newProjectBtn.isVisible()) {
        console.log('📦 Found New Project button, clicking...');
        await newProjectBtn.click();
        await delay(3000);

        // Fill project creation form if it appears
        const projectNameInput = await page.locator('input[name="name"], input[placeholder*="project"], input[placeholder*="name"]').first();
        if (await projectNameInput.isVisible()) {
          console.log('📝 Filling project creation form...');
          await projectNameInput.fill(`Test Project ${timestamp}`);
          await delay(1000);

          // Look for submit button
          const submitBtn = await page.locator('button:has-text("Create"), button:has-text("Submit"), button[type="submit"]').first();
          if (await submitBtn.isVisible()) {
            console.log('📤 Submitting project creation...');
            await submitBtn.click();
            await delay(3000);

            console.log(`📍 Current URL after project creation: ${page.url()}`);
          }
        }
      }
    } catch (e) {
      console.log('⚠️ Could not find or interact with project creation elements');
    }

  } else if (currentUrl.includes('confirm') || currentUrl.includes('verify')) {
    console.log('📧 Email confirmation required - check your email');
  } else if (currentUrl.includes('login')) {
    console.log('🔄 Redirected to login page - registration might have succeeded');

    // Try to login with the credentials we just created
    console.log('🔐 Attempting to login with new credentials...');
    await page.fill('input[type="email"]', testEmail);
    await delay(1000);
    await page.fill('input[type="password"]', testPassword);
    await delay(1000);
    await page.click('button:has-text("Login"), button:has-text("Sign In")');
    await delay(3000);

    console.log(`📍 Current URL after login attempt: ${page.url()}`);
  }

  // Keep browser open for 30 seconds for observation
  console.log('👀 Keeping browser open for 30 seconds for observation...');
  await delay(30000);

  await browser.close();
  console.log('✅ Test complete');
})();