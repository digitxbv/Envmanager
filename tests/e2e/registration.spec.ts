import { test, expect } from '@playwright/test'

test.describe('Registration Flow', () => {
  const testEmail = `test-${Date.now()}@example.com`
  const testPassword = 'ValidPassword123!'

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/register')
  })

  test('should display password requirements', async ({ page }) => {
    const passwordInput = page.getByLabel('Password', { exact: true })
    await passwordInput.fill('a')

    // Check that password requirements are visible
    await expect(page.getByText('At least 12 characters')).toBeVisible()
    await expect(page.getByText('uppercase', { exact: false })).toBeVisible()
    await expect(page.getByText('lowercase', { exact: false })).toBeVisible()
    await expect(page.getByText('number', { exact: false })).toBeVisible()
    await expect(page.getByText('special character', { exact: false })).toBeVisible()
  })

  test('should show real-time password strength indicator', async ({ page }) => {
    const passwordInput = page.getByLabel('Password', { exact: true })

    // Type weak password
    await passwordInput.fill('weak')

    // Should show weak strength
    await expect(page.getByText('Weak', { exact: false })).toBeVisible()

    // Type strong password
    await passwordInput.fill('StrongPassword123!')

    // Should show strong strength
    await expect(page.getByText('Strong', { exact: false })).toBeVisible()
  })

  test('should validate password confirmation mismatch', async ({ page }) => {
    const passwordInput = page.getByLabel('Password', { exact: true })
    const confirmInput = page.getByLabel('Confirm Password')

    await passwordInput.fill('ValidPassword123!')
    await confirmInput.fill('DifferentPassword123!')

    // Blur the confirm field to trigger validation
    await confirmInput.blur()

    // Should show error
    await expect(page.getByText('Passwords do not match', { exact: false })).toBeVisible()
  })

  test('should require terms acceptance', async ({ page }) => {
    const emailInput = page.getByLabel('Email')
    const passwordInput = page.getByLabel('Password', { exact: true })
    const confirmInput = page.getByLabel('Confirm Password')
    const submitButton = page.getByRole('button', { name: /sign up|create account/i })

    await emailInput.fill(testEmail)
    await passwordInput.fill(testPassword)
    await confirmInput.fill(testPassword)

    // Submit button should be disabled without accepting terms
    await expect(submitButton).toBeDisabled()
  })

  test('should link to terms of service page', async ({ page }) => {
    const termsLink = page.locator('form').getByRole('link', { name: /terms of service/i }).first()

    await expect(termsLink).toBeVisible()
    await expect(termsLink).toHaveAttribute('href', '/terms')
  })

  test('should complete valid registration successfully', async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
    const emailInput = page.getByLabel('Email')
    const passwordInput = page.getByLabel('Password', { exact: true })
    const confirmInput = page.getByLabel('Confirm Password')
    const termsCheckbox = page.getByRole('checkbox', { name: /accept.*terms/i })
    const submitButton = page.getByRole('button', { name: /sign up|create account/i })

    // Fill form
    await emailInput.fill(uniqueEmail)
    await passwordInput.fill(testPassword)
    await confirmInput.fill(testPassword)
    await termsCheckbox.check()

    // Submit
    await submitButton.click()

    // Should show loading state
    await expect(submitButton).toBeDisabled()

    await expect(page).toHaveURL(/\/onboarding|\/dashboard/, { timeout: 10000 })

    if (page.url().includes('/dashboard')) {
      await expect(page.getByText(uniqueEmail)).toBeVisible()
    } else {
      await expect(page.getByText('Organization Name')).toBeVisible({ timeout: 5000 })
    }
  })

  test('should show error for duplicate registration', async ({ page }) => {
    const emailInput = page.getByLabel('Email')
    const passwordInput = page.getByLabel('Password', { exact: true })
    const confirmInput = page.getByLabel('Confirm Password')
    const termsCheckbox = page.getByRole('checkbox', { name: /accept.*terms/i })
    const submitButton = page.getByRole('button', { name: /sign up|create account/i })

    // Try to register with an existing email (use a known test account)
    const existingEmail = 'existing@example.com'

    // First, try to register (this might fail, which is ok)
    await emailInput.fill(existingEmail)
    await passwordInput.fill(testPassword)
    await confirmInput.fill(testPassword)
    await termsCheckbox.check()
    await submitButton.click()

    // Wait for any response
    await page.waitForTimeout(1000)

    // Now try again with the same email
    await page.goto('/auth/register')
    await emailInput.fill(existingEmail)
    await passwordInput.fill(testPassword)
    await confirmInput.fill(testPassword)
    await page.getByRole('checkbox', { name: /accept.*terms/i }).check()
    await page.getByRole('button', { name: /sign up|create account/i }).click()

    // Should show error message
    await expect(
      page.getByText(/already registered|already exists/i)
    ).toBeVisible({ timeout: 5000 })
  })

  test('should validate all password requirements', async ({ page }) => {
    const passwordInput = page.getByLabel('Password', { exact: true })

    // Test each requirement individually
    const requirements = [
      { password: 'short', shouldFail: '12 characters' },
      { password: 'nouppercase123!', shouldFail: 'uppercase' },
      { password: 'NOLOWERCASE123!', shouldFail: 'lowercase' },
      { password: 'NoNumbers!', shouldFail: 'number' },
      { password: 'NoSpecialChar123', shouldFail: 'special' }
    ]

    for (const req of requirements) {
      await passwordInput.fill(req.password)
      await expect(page.getByText(req.shouldFail, { exact: false })).toBeVisible()
    }
  })
})
