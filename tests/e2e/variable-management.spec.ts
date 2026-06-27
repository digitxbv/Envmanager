import { test, expect } from '@playwright/test'
import { loginAsSeededUser } from './helpers/auth.helper'
import { SEED_PROJECT, SEED_URLS, SEED_VARIABLES } from './helpers/seed-data.helper'

// Run tests serially to avoid parallel login conflicts with seed user
test.describe.configure({ mode: 'serial' })

test.describe('Variable Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(SEED_URLS.project)
    await page.waitForLoadState('networkidle')
    // Wait for variables table to load
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 })
  })

  test('should add a regular variable', async ({ page }) => {
    const varKey = `TEST_VAR_${Date.now()}`
    const varValue = 'test_value_123'

    // Click Add Variable button
    await page.getByRole('button', { name: /add variable/i }).first().click()
    
    // Fill the form
    await page.getByLabel('Key').fill(varKey)
    await page.locator('#variableValue').fill(varValue)
    
    // Ensure NOT a secret (checkbox unchecked)
    const secretCheckbox = page.getByRole('checkbox', { name: /store as secret/i })
    if (await secretCheckbox.isChecked()) {
      await secretCheckbox.uncheck()
    }
    
    // Submit
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    
    // Verify variable appears with "Regular" type
    await expect(page.getByRole('cell', { name: varKey })).toBeVisible({ timeout: 5000 })
    await expect(page.locator('tr').filter({ hasText: varKey }).getByText('Regular')).toBeVisible()
    
    // Verify value is visible (not masked)
    await expect(page.locator('tr').filter({ hasText: varKey }).getByText(varValue)).toBeVisible()
  })

  test('should add a secret variable', async ({ page }) => {
    const varKey = `SECRET_VAR_${Date.now()}`
    const varValue = 'super_secret_value'

    await page.getByRole('button', { name: /add variable/i }).first().click()
    
    await page.getByLabel('Key').fill(varKey)
    await page.locator('#variableValue').fill(varValue)
    
    // Check "Store as secret" checkbox
    await page.getByRole('checkbox', { name: /store as secret/i }).check()
    
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    
    // Verify variable appears with "Secret" type badge
    await expect(page.getByRole('cell', { name: varKey })).toBeVisible({ timeout: 5000 })
    const row = page.locator('tr').filter({ hasText: varKey })
    await expect(row.getByText('Secret', { exact: true }).first()).toBeVisible()
    
    // Verify value is MASKED (dots)
    await expect(row.getByText(/•+/)).toBeVisible()
  })

  test('should reveal and hide secret value', async ({ page }) => {
    // Find the API_KEY row (seed data secret)
    const row = page.locator('tr').filter({ hasText: 'API_KEY' })
    await expect(row).toBeVisible({ timeout: 5000 })
    
    // Verify initially masked
    await expect(row.getByText(/•+/)).toBeVisible()
    
    // Click reveal button (eye icon)
    await row.locator('button').filter({ has: page.locator('svg') }).first().click()
    
    // Wait for decryption and verify value is visible
    await expect(row.getByText('dev-secret-api-key-12345')).toBeVisible({ timeout: 5000 })
    
    // Click hide button
    await row.locator('button').filter({ has: page.locator('svg') }).first().click()
    
    // Verify masked again
    await expect(row.getByText(/•+/)).toBeVisible({ timeout: 3000 })
  })

  test('should edit variable value', async ({ page }) => {
    // Find APP_NAME row (seed regular variable)
    const row = page.locator('tr').filter({ hasText: 'APP_NAME' })
    await expect(row).toBeVisible({ timeout: 5000 })
    
    await row.locator('button').nth(2).click()
    
    // Wait for edit modal
    await expect(page.getByRole('heading', { name: 'Edit Variable' })).toBeVisible({ timeout: 5000 })
    
    // Update value
    const newValue = `Updated Value ${Date.now()}`
    await page.locator('#variableValue').clear()
    await page.locator('#variableValue').fill(newValue)
    
    // Save
    await page.getByRole('button', { name: /update|save/i }).click()
    
    // Verify new value in table
    await expect(row.getByText(newValue)).toBeVisible({ timeout: 5000 })
    
    // Reload and verify persistence
    await page.reload()
    await expect(page.locator('tr').filter({ hasText: 'APP_NAME' }).getByText(newValue)).toBeVisible({ timeout: 10000 })
  })

  test('should delete a variable', async ({ page }) => {
    // First create a variable to delete
    const varKey = `DELETE_ME_${Date.now()}`
    
    await page.getByRole('button', { name: /add variable/i }).first().click()
    await page.getByLabel('Key').fill(varKey)
    await page.locator('#variableValue').fill('to_delete')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    
    // Wait for it to appear
    await expect(page.getByRole('cell', { name: varKey })).toBeVisible({ timeout: 5000 })
    
    // Find the row and click delete
    const row = page.locator('tr').filter({ hasText: varKey })
    await row.locator('button').last().click()  // Delete is usually last button
    
    // Confirm deletion in modal
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    
    // Verify removed from table
    await expect(page.getByRole('cell', { name: varKey })).not.toBeVisible({ timeout: 5000 })
  })

  test('should show error for duplicate key', async ({ page }) => {
    // Try to add APP_NAME which already exists
    await page.getByRole('button', { name: /add variable/i }).first().click()
    
    await page.getByLabel('Key').fill('APP_NAME')
    await page.locator('#variableValue').fill('duplicate_value')
    
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    
    // Verify error message appears (toast or modal error)
    await expect(page.getByText(/already exists|duplicate/i)).toBeVisible({ timeout: 5000 })
  })
})
