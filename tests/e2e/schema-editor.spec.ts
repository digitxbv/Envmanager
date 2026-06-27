import { test, expect } from '@playwright/test'

test.describe('Schema Editor', () => {
  const testEmail = `test-schema-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`
  const testPassword = 'TestPassword123!'
  const orgName = `Schema Test Org ${Date.now()}`
  const projectName = `Schema Test Project ${Date.now()}`

  test('should complete schema editor flow: signup, navigate to schema, add field, and save', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    
    await page.goto('/auth/register')
    await expect(page).toHaveURL(/\/auth\/register/)
    
    await page.getByRole('textbox', { name: 'Email address' }).fill(testEmail)
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(testPassword)
    await page.getByRole('textbox', { name: 'Confirm Password' }).fill(testPassword)
    await page.getByRole('checkbox', { name: /accept.*terms/i }).check()
    
    const submitButton = page.getByRole('button', { name: /create account/i })
    await expect(submitButton).toBeEnabled()
    await submitButton.click()
    
    await page.waitForURL(/\/onboarding/, { timeout: 15000 })
    
    await expect(page.getByText('Organization Name')).toBeVisible({ timeout: 5000 })
    await page.getByRole('textbox', { name: /acme/i }).fill(orgName)
    await page.getByRole('button', { name: /next/i }).click()
    
    await expect(page.getByText('Project Name')).toBeVisible({ timeout: 5000 })
    await page.getByRole('textbox', { name: /my app/i }).fill(projectName)
    await page.getByRole('button', { name: /next/i }).click()
    
    await expect(page.getByText('Select Environments')).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /complete setup/i }).click()
    
    await page.waitForURL(/\/dashboard\/projects\/[^/]+/, { timeout: 10000 })
    
    const currentUrl = page.url()
    const projectUrl = currentUrl.match(/\/dashboard\/projects\/[^/]+/)?.[0]
    expect(projectUrl).toBeTruthy()
    
    await page.goto(`${projectUrl}/schema`)
    
    await expect(page.getByRole('heading', { name: 'Environment Schema' })).toBeVisible({ timeout: 10000 })
    
    await expect(page.getByRole('tab', { name: /development/i })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('tab', { name: /production/i })).toBeVisible({ timeout: 5000 })
    
    const addFieldButton = page.getByRole('button', { name: 'Add Field' })
    await expect(addFieldButton).toBeVisible({ timeout: 5000 })
    await addFieldButton.click()
    
    const keyInput = page.locator('input[placeholder="VARIABLE_NAME"]').first()
    await expect(keyInput).toBeVisible({ timeout: 5000 })
    await keyInput.fill('DATABASE_URL')
    
    await page.locator('select').first().selectOption('url')
    
    await page.getByRole('checkbox', { name: /required/i }).check()
    
    await page.getByRole('button', { name: /save schema/i }).click()
    
    await expect(page.getByText(/saved|success/i)).toBeVisible({ timeout: 5000 })
    
    const prodTab = page.getByRole('tab', { name: /production/i })
    await prodTab.click()
    await expect(prodTab).toHaveAttribute('aria-selected', 'true')
    
    await page.goto(projectUrl || '/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/dashboard\/projects\/[0-9a-f-]{36}$/, { timeout: 5000 })
  })
})
