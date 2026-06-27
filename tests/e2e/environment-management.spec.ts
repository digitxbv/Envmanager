import { test, expect } from '@playwright/test'
import { loginAsSeededUser } from './helpers/auth.helper'
import { SEED_ORG, SEED_URLS } from './helpers/seed-data.helper'
import { upgradeToProPlan, resetToFreePlan } from './helpers/billing.helper'

test.describe.configure({ mode: 'serial' })

test.describe('Environment Management', () => {
  test.beforeAll(async () => {
    await upgradeToProPlan(SEED_ORG.id)
  })

  test.afterAll(async () => {
    await resetToFreePlan(SEED_ORG.id)
  })

  test.beforeEach(async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(SEED_URLS.projectSettings)
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 10000 })
  })

  test('should add a new environment', async ({ page }) => {
    const envName = `staging-${Date.now()}`
    
    await page.getByRole('button', { name: /add environment/i }).click()
    await page.locator('#environmentName').fill(envName)
    await page.getByRole('button', { name: 'Add', exact: true }).click()

    await expect(page.getByText(envName, { exact: true })).toBeVisible({ timeout: 10000 })
  })

  test('should rename an environment', async ({ page }) => {
    // First create an environment to rename
    const originalName = `rename-test-${Date.now()}`
    const newName = `renamed-${Date.now()}`
    
    // Create environment
    await page.getByRole('button', { name: /add environment/i }).click()
    await page.locator('#environmentName').fill(originalName)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText(originalName, { exact: true })).toBeVisible({ timeout: 5000 })
    
    // Find the environment row and click Rename
    // Environment rows are in div.divide-y > div.p-4 structure
    const envRow = page.locator('.divide-y > div').filter({ hasText: originalName })
    await envRow.getByRole('button', { name: /rename/i }).click()
    
    await page.locator('#environmentName').clear()
    await page.locator('#environmentName').fill(newName)
    await page.getByRole('button', { name: 'Update', exact: true }).click()
    
    // Verify new name appears
    await expect(page.getByText(newName, { exact: true })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(originalName, { exact: true })).not.toBeVisible()
    
    // Reload and verify persistence
    await page.reload()
    await expect(page.getByText(newName, { exact: true })).toBeVisible({ timeout: 10000 })
  })

  test('should clone an environment with variables', async ({ page }) => {
    const cloneName = `dev-clone-${Date.now()}`
    
    // Find development environment row and click Clone button
    const devRow = page.locator('.divide-y > div').filter({ hasText: 'development' })
    await devRow.getByRole('button', { name: /clone/i }).click()
    
    // Wait for clone modal to appear
    await expect(page.getByRole('heading', { name: 'Clone Environment' })).toBeVisible()
    
    // Fill the new environment name
    await page.locator('#newEnvironmentName').clear()
    await page.locator('#newEnvironmentName').fill(cloneName)
    
    await page.getByRole('button', { name: 'Clone', exact: true }).last().click()

    const cloneModalHeading = page.getByRole('heading', { name: 'Clone Environment' })
    if (await cloneModalHeading.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Cancel' }).last().click()
    }
    
    // Wait for environment to appear in list
    await expect(page.getByText(cloneName, { exact: true })).toBeVisible({ timeout: 10000 })
    
    // Navigate to project page and wait for it to load
    await page.goto(SEED_URLS.project)
    await page.waitForLoadState('networkidle')
    
    // Click on the cloned environment tab (wait for it to be available)
    await expect(page.getByRole('tab', { name: cloneName })).toBeVisible({ timeout: 10000 })
    await page.getByRole('tab', { name: cloneName }).click()
    
    // Verify variables exist (APP_NAME should be copied from development)
    await expect(page.getByText('APP_NAME')).toBeVisible({ timeout: 5000 })
  })

  test('should delete an environment', async ({ page }) => {
    // First create an environment to delete
    const envName = `delete-test-${Date.now()}`
    
    await page.getByRole('button', { name: /add environment/i }).click()
    await page.locator('#environmentName').fill(envName)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText(envName, { exact: true })).toBeVisible({ timeout: 5000 })
    
    const envRow = page.locator('.divide-y > div').filter({ hasText: envName })
    await envRow.locator('button').last().click()
    
    // Confirm deletion
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    
    // Wait a bit for toast to appear and disappear
    await page.waitForTimeout(1000)
    
    // Verify environment is removed from the list (not from toasts)
    const envRowAfter = page.locator('.divide-y > div').filter({ hasText: envName })
    await expect(envRowAfter).not.toBeVisible({ timeout: 5000 })
  })
})
