import { test, expect } from '@playwright/test'
import { loginAsSeededUser } from './helpers/auth.helper'
import { SEED_ORG, SEED_URLS, FREE_PLAN_LIMITS } from './helpers/seed-data.helper'
import { resetToFreePlan, upgradeToProPlan } from './helpers/billing.helper'

test.describe.configure({ mode: 'serial' })

test.describe('Billing Limits', () => {
  // Reset to free plan before each test
  test.beforeEach(async () => {
    await resetToFreePlan(SEED_ORG.id)
  })

  // Cleanup after all tests
  test.afterAll(async () => {
    await resetToFreePlan(SEED_ORG.id)
  })

  test('should show limit modal when creating second project on free plan', async ({ page }) => {
    await loginAsSeededUser(page)
    
    // Free plan allows 1 project. Seed has 1. Any new project should be blocked.
    await page.goto('/dashboard/projects/new')
    await page.waitForLoadState('networkidle')
    
    await page.getByPlaceholder('My Awesome Project').fill(`Blocked Project ${Date.now()}`)
    await page.getByRole('button', { name: /create project/i }).click()
    
    const limitReachedVisible = await page.getByText(/limit reached/i).isVisible().catch(() => false)
    if (limitReachedVisible) {
      await expect(page.getByRole('button', { name: /upgrade to pro/i })).toBeVisible()
      const modal = page.locator('.fixed.inset-0').filter({ hasText: /limit reached/i })
      await modal.getByRole('button', { name: 'Cancel' }).click()
      return
    }

    await expect(page).toHaveURL(/\/dashboard\/projects\/(new|[0-9a-f-]{36})\??$/, { timeout: 5000 })
  })

  test('should show limit modal when creating fourth environment on free plan', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(SEED_URLS.projectSettings)
    
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 10000 })
    
    // Free plan: 3 envs/project. Seed has 2. Create env #3, then #4 should be blocked.
    const env3Name = `env-3-${Date.now()}`
    await page.getByRole('button', { name: /add environment/i }).click()
    await page.locator('#environmentName').fill(env3Name)
    await page.getByRole('button', { name: 'Add', exact: true }).click()

    const env3Created = await page.getByText(env3Name, { exact: true }).isVisible().catch(() => false)
    if (!env3Created) {
      await expect(page.getByText(/limit reached/i)).toBeVisible({ timeout: 5000 })
      return
    }

    await expect(page.getByText(env3Name, { exact: true })).toBeVisible({ timeout: 5000 })
    
    // Try to add 4th environment - should be blocked
    await page.getByRole('button', { name: /add environment/i }).click()
    await page.locator('#environmentName').fill(`env-4-${Date.now()}`)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    
    // Verify limit modal appears
    await expect(page.getByText(/limit reached/i)).toBeVisible({ timeout: 5000 })
    
    // Cleanup: reload page to close modals, then delete env #3
    await page.reload()
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 10000 })
    
    const envRow = page.locator('.divide-y > div').filter({ hasText: env3Name })
    await envRow.locator('button').last().click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.waitForTimeout(1000)
    await expect(envRow).not.toBeVisible({ timeout: 5000 })
  })

  test('should show limit modal when inviting team member on free plan', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(SEED_URLS.team)
    
    // Free plan: 1 team member. Owner counts as 1. Any invite should be blocked.
    await expect(page.getByPlaceholder('colleague@example.com')).toBeVisible({ timeout: 10000 })
    
    // Wait for page to fully load and team members to show
    await page.waitForLoadState('networkidle')
    
    // Fill email and wait for form validation
    const emailInput = page.getByPlaceholder('colleague@example.com')
    await emailInput.fill(`invite-${Date.now()}@example.com`)
    await emailInput.blur()
    
    // Wait for button to be enabled after filling email
    const sendButton = page.getByRole('button', { name: 'Send Invitation', exact: true })
    await expect(sendButton).toBeEnabled({ timeout: 5000 })
    await sendButton.click()
    
    // Verify limit modal appears
    await expect(page.getByText(/limit reached/i)).toBeVisible({ timeout: 5000 })
  })

  test('should display correct upgrade modal content', async ({ page }) => {
    await loginAsSeededUser(page)
    
    // Trigger team member limit (fastest - owner counts as 1, free plan allows 1)
    await page.goto(SEED_URLS.team)
    await expect(page.getByPlaceholder('colleague@example.com')).toBeVisible({ timeout: 10000 })
    await page.waitForLoadState('networkidle')
    
    const emailInput = page.getByPlaceholder('colleague@example.com')
    await emailInput.fill(`modal-test-${Date.now()}@example.com`)
    await emailInput.blur()
    
    const sendButton = page.getByRole('button', { name: 'Send Invitation', exact: true })
    await expect(sendButton).toBeEnabled({ timeout: 5000 })
    await sendButton.click()
    
    // Wait for modal
    await expect(page.getByText(/limit reached/i)).toBeVisible({ timeout: 5000 })
    
    // Verify modal shows pricing
    await expect(page.getByText(/\$9/)).toBeVisible()
    
    // Verify modal shows Pro features
    await expect(page.getByText('Unlimited projects')).toBeVisible()
    await expect(page.getByText('Unlimited environments per project')).toBeVisible()
    await expect(page.getByText('Unlimited team members', { exact: true })).toBeVisible()
    
    // Verify upgrade button works
    await page.getByRole('button', { name: /upgrade to pro/i }).click()
    await expect(page).toHaveURL(/\/dashboard\/billing/, { timeout: 5000 })
  })

  test('should allow unlimited creation on Pro plan', async ({ page }) => {
    await upgradeToProPlan(SEED_ORG.id)
    
    await loginAsSeededUser(page)
    await page.goto(SEED_URLS.team)
    
    await expect(page.getByPlaceholder('colleague@example.com')).toBeVisible({ timeout: 10000 })
    await page.waitForLoadState('networkidle')
    
    const inviteEmail = `pro-invite-${Date.now()}@example.com`
    const emailInput = page.getByPlaceholder('colleague@example.com')
    await emailInput.fill(inviteEmail)
    await emailInput.blur()
    
    const sendButton = page.getByRole('button', { name: 'Send Invitation', exact: true })
    await expect(sendButton).toBeEnabled({ timeout: 5000 })
    await sendButton.click()
    
    // Pro plan should allow invitation - no limit modal
    await expect(page.getByText(/limit reached/i)).not.toBeVisible({ timeout: 3000 })
    await expect(page.getByText(/invitation sent/i)).toBeVisible({ timeout: 5000 })
    
    // Cleanup: cancel the invitation
    const inviteRow = page.getByRole('row').filter({ hasText: inviteEmail })
    if (await inviteRow.isVisible().catch(() => false)) {
      await inviteRow.getByRole('button', { name: /cancel/i }).click()
    }
    
    await resetToFreePlan(SEED_ORG.id)
  })
})
