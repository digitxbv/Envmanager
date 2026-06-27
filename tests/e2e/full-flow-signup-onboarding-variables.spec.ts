import { test, expect } from '@playwright/test'

/**
 * ============================================================================
 * ⚠️  MANDATORY BASELINE TEST - DO NOT MODIFY WITHOUT EXPLICIT APPROVAL  ⚠️
 * ============================================================================
 *
 * This test is a REQUIRED smoke test that MUST pass for every feature/PR.
 * It validates the core user journey and cannot be skipped or adjusted.
 *
 * To modify this test, you MUST have explicit written approval from the
 * project owner. Any changes without approval will be rejected.
 *
 * See: docs/prds/TEST_GUIDELINES.md
 * ============================================================================
 *
 * Full flow test: Signup → Onboarding → Add Variables → Verify Secret Decryption
 *
 * This test verifies the complete user journey:
 * 1. User signs up with email/password
 * 2. User completes onboarding (organization, project, environments)
 * 3. User adds a normal environment variable
 * 4. User adds a secret environment variable
 * 5. User verifies the secret can be decrypted and displayed
 */
test.describe('Full Flow: Signup → Onboarding → Variables', () => {
  // Generate unique test email to avoid conflicts
  const testEmail = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`
  const testPassword = 'TestPassword123!'

  // Test data
  const normalVarKey = 'API_URL'
  const normalVarValue = 'https://api.example.com/v1'
  const secretVarKey = 'DATABASE_PASSWORD'
  const secretVarValue = 'super_secret_password_123'

  test('should complete full flow: signup, onboarding, add variables, and verify secret decryption', async ({ page }) => {
    // Set light mode preference
    await page.emulateMedia({ colorScheme: 'light' })

    // Step 1: Navigate to registration page
    await page.goto('/auth/register')
    await expect(page).toHaveURL(/\/auth\/register/)

    // Step 2: Fill registration form
    await page.getByRole('textbox', { name: 'Email address' }).fill(testEmail)
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(testPassword)
    await page.getByRole('checkbox', { name: /accept.*terms/i }).check()

    // Verify form is valid and submit
    const submitButton = page.getByRole('button', { name: /create account/i })
    await expect(submitButton).toBeEnabled()
    await submitButton.click()

    // Wait for redirect to onboarding
    await page.waitForURL(/\/onboarding/, { timeout: 15000 })

    // Step 3: Onboarding is now automatic — wait for redirect straight to the project
    await page.waitForURL(/\/dashboard\/projects\/[^/]+/, { timeout: 20000 })

    // Wait for project to load
    await expect(page.locator('h1')).toBeVisible({ timeout: 5000 })

    // Step 6: Add normal environment variable
    await page.getByRole('button', { name: /add variable/i }).first().click()

    // Fill variable form (modal)
    await expect(page.getByRole('heading', { name: /add new variable/i })).toBeVisible({ timeout: 3000 })
    await page.getByRole('textbox', { name: 'Key' }).fill(normalVarKey)
    await page.getByRole('textbox', { name: 'Value' }).fill(normalVarValue)

    // Don't check secret checkbox (it's a normal variable)
    await expect(page.getByRole('checkbox', { name: /store as secret/i })).not.toBeChecked()

    // Submit form
    await page.getByRole('button', { name: 'Add', exact: true }).click()

    // Wait for modal to close and verify variable appears in table
    await expect(page.getByRole('heading', { name: /add new variable/i })).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('cell', { name: normalVarKey })).toBeVisible({ timeout: 5000 })
    await expect(page.locator('span').filter({ hasText: normalVarValue })).toBeVisible()
    await expect(page.getByText('Regular')).toBeVisible()

    // Step 7: Add secret environment variable
    await page.getByRole('button', { name: /add variable/i }).first().click()

    await expect(page.getByRole('heading', { name: /add new variable/i })).toBeVisible({ timeout: 3000 })
    await page.getByRole('textbox', { name: 'Key' }).fill(secretVarKey)
    await page.getByRole('textbox', { name: 'Value' }).fill(secretVarValue)

    // Check secret checkbox
    await page.getByRole('checkbox', { name: /store as secret/i }).check()
    await expect(page.getByRole('checkbox', { name: /store as secret/i })).toBeChecked()

    // Submit form
    await page.getByRole('button', { name: 'Add', exact: true }).click()

    // Wait for modal to close
    await expect(page.getByRole('heading', { name: /add new variable/i })).not.toBeVisible({ timeout: 5000 })

    // Verify secret variable appears in table (value should be masked)
    await expect(page.getByRole('cell', { name: secretVarKey })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Secret')).toBeVisible()

    // Verify secret value is masked (should show dots)
    const secretRow = page.locator('tr').filter({ hasText: secretVarKey })
    await expect(secretRow.getByText(/••••••••/)).toBeVisible({ timeout: 3000 })

    // Step 8: Verify secret can be decrypted/revealed
    const revealButton = secretRow.getByRole('button', { name: /reveal value/i })
    await expect(revealButton).toBeVisible({ timeout: 3000 })

    // Click to reveal the secret
    await revealButton.click()

    // Wait for secret to be revealed (decrypted value should appear)
    await expect(secretRow.locator('span').filter({ hasText: secretVarValue })).toBeVisible({ timeout: 5000 })

    // Verify the masked value is no longer visible
    await expect(secretRow.getByText(/••••••••/)).not.toBeVisible({ timeout: 3000 })

    // Verify the button changed to "Hide value"
    await expect(secretRow.getByRole('button', { name: /hide value/i })).toBeVisible({ timeout: 2000 })

    // Final verification: Check that both variables are present
    await expect(page.getByRole('cell', { name: normalVarKey })).toBeVisible()
    await expect(page.getByRole('cell', { name: secretVarKey })).toBeVisible()
  })
})
