import { test, expect } from '@playwright/test'
import { loginAsSeededUser, registerAndLogin, completeOnboarding } from './helpers/auth.helper'
import { SEED_PROJECT, SEED_URLS, SEED_ENVIRONMENTS, SEED_VARIABLES } from './helpers/seed-data.helper'

test.describe('Project Management', () => {

  test('should create a new project via onboarding', async ({ page }) => {
    // Use fresh user to avoid project limit on seed org
    await registerAndLogin(page)
    
    // Complete onboarding which creates the first project
    const { orgName, projectName } = await completeOnboarding(page)
    
    // Verify redirected to project page
    await expect(page).toHaveURL(/\/dashboard\/projects\/[a-f0-9-]+/, { timeout: 10000 })
    
    // Verify project name is visible
    await expect(page.getByRole('heading', { name: projectName })).toBeVisible({ timeout: 5000 })
  })

  test('should edit project settings', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(SEED_URLS.projectSettings)
    
    // Wait for settings to load
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 10000 })
    
    // Store original values for cleanup
    const originalName = SEED_PROJECT.name
    const newName = `Updated Project ${Date.now()}`
    const newDescription = `Updated description ${Date.now()}`
    
    // Update project name
    await page.locator('#name').clear()
    await page.locator('#name').fill(newName)
    
    // Update description
    await page.locator('#description').clear()
    await page.locator('#description').fill(newDescription)
    
    // Save changes
    await page.getByRole('button', { name: /save changes/i }).click()
    
    // Verify success toast
    await expect(page.getByText(/updated successfully/i)).toBeVisible({ timeout: 5000 })
    
    // Reload and verify persistence
    await page.reload()
    await expect(page.locator('#name')).toHaveValue(newName, { timeout: 10000 })
    
    // Restore original values (cleanup)
    await page.locator('#name').clear()
    await page.locator('#name').fill(originalName)
    await page.locator('#description').clear()
    await page.locator('#description').fill(SEED_PROJECT.description)
    await page.getByRole('button', { name: /save changes/i }).click()
    await expect(page.getByText(/updated successfully/i)).toBeVisible({ timeout: 5000 })
  })

  test('should navigate between environments', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(SEED_URLS.project)
    await page.waitForLoadState('networkidle')
    
    // Wait for page to load
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 })
    
    const developmentTab = page.getByRole('tab', { name: /development/i })
    const productionTab = page.getByRole('tab', { name: /production/i })
    await expect(developmentTab).toHaveAttribute('aria-selected', 'true')
    
    // Click production tab
    await productionTab.click()
    
    await expect(productionTab).toHaveAttribute('aria-selected', 'true')
    
    // Click development tab
    await developmentTab.click()
    
    await expect(developmentTab).toHaveAttribute('aria-selected', 'true')
  })

  test('should delete a project with confirmation', async ({ page, context }) => {
    // Create a fresh user and project to delete
    await registerAndLogin(page)
    const { projectName } = await completeOnboarding(page)
    
    // Navigate to project settings
    await page.getByRole('button', { name: /settings/i }).first().click()
    await expect(page.getByRole('heading', { name: /settings/i }).first()).toBeVisible({ timeout: 10000 })
    
    // Scroll to danger zone and click delete
    await page.getByRole('button', { name: 'Delete Project', exact: true }).click()
    
    // Verify confirmation modal appears (check for confirmation text)
    await expect(page.getByText(/type.*to confirm/i).first()).toBeVisible({ timeout: 3000 })
    
    // Get the input field
    const confirmInput = page.locator('input[placeholder*="Type project name"]')
    
    // Try typing wrong name - button should be disabled
    await confirmInput.fill('wrong name')
    await expect(page.locator('button').filter({ hasText: 'Delete Project' }).last()).toBeDisabled()
    
    // Type correct project name
    await confirmInput.clear()
    await confirmInput.fill(projectName)
    
    // Now button should be enabled
    const deleteBtn = page.locator('button').filter({ hasText: 'Delete Project' }).last()
    await expect(deleteBtn).toBeEnabled()
    
    // Click delete
    await deleteBtn.click()
    
    // Verify redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })
})
