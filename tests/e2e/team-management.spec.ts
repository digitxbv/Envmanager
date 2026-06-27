import { test, expect } from '@playwright/test'
import { loginAsSeededUser, registerAndLogin } from './helpers/auth.helper'
import { SEED_ORG, SEED_URLS } from './helpers/seed-data.helper'
import { generateTestEmail, waitForEmail, clearMailbox, extractInviteLink } from './helpers/inbucket.helper'
import { upgradeToProPlan, resetToFreePlan } from './helpers/billing.helper'

test.describe.configure({ mode: 'serial' })

test.describe('Team Management', () => {
  test.beforeAll(async () => {
    await upgradeToProPlan(SEED_ORG.id)
  })

  test.afterAll(async () => {
    await resetToFreePlan(SEED_ORG.id)
  })

  test('should send invitation to new member', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(SEED_URLS.team)
    
    await expect(page.getByPlaceholder('colleague@example.com')).toBeVisible({ timeout: 10000 })
    await page.waitForLoadState('networkidle')
    
    const { email, localPart } = generateTestEmail('invite-member')
    await clearMailbox(localPart)
    
    const emailInput = page.getByPlaceholder('colleague@example.com')
    await emailInput.fill(email)
    await emailInput.blur()
    
    const sendButton = page.getByRole('button', { name: 'Send Invitation', exact: true })
    await expect(sendButton).toBeEnabled({ timeout: 5000 })
    await sendButton.click()

    await expect(page.getByText(/invitation sent/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(email, { exact: true })).toBeVisible({ timeout: 5000 })
    
    page.on('dialog', dialog => dialog.accept())
    const row = page.getByRole('row').filter({ hasText: email })
    await row.getByRole('button', { name: /cancel/i }).click()
  })

  test('should send invitation with admin role', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(SEED_URLS.team)
    
    await expect(page.getByPlaceholder('colleague@example.com')).toBeVisible({ timeout: 10000 })
    await page.waitForLoadState('networkidle')
    
    const { email, localPart } = generateTestEmail('invite-admin')
    await clearMailbox(localPart)
    
    const emailInput = page.getByPlaceholder('colleague@example.com')
    await emailInput.fill(email)
    await emailInput.blur()
    
    const roleSelect = page.locator('select').first()
    await roleSelect.selectOption('admin')
    
    const sendButton = page.getByRole('button', { name: 'Send Invitation', exact: true })
    await expect(sendButton).toBeEnabled({ timeout: 5000 })
    await sendButton.click()
    
    await expect(page.getByText(/invitation sent/i)).toBeVisible({ timeout: 5000 })
    
    const row = page.getByRole('row').filter({ hasText: email })
    // Check for Admin badge (span element), not text that might be in email
    await expect(row.locator('span:has-text("Admin")')).toBeVisible()
    page.on('dialog', dialog => dialog.accept())
    await row.getByRole('button', { name: /cancel/i }).click()
  })

  test('should resend invitation', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(SEED_URLS.team)
    
    await expect(page.getByPlaceholder('colleague@example.com')).toBeVisible({ timeout: 10000 })
    await page.waitForLoadState('networkidle')
    
    const { email, localPart } = generateTestEmail('resend-test')
    await clearMailbox(localPart)
    
    const emailInput = page.getByPlaceholder('colleague@example.com')
    await emailInput.fill(email)
    await emailInput.blur()
    
    const sendButton = page.getByRole('button', { name: 'Send Invitation', exact: true })
    await expect(sendButton).toBeEnabled({ timeout: 5000 })
    await sendButton.click()
    
    await expect(page.getByText(email, { exact: true })).toBeVisible({ timeout: 5000 })
    await clearMailbox(localPart)
    
    const row = page.getByRole('row').filter({ hasText: email })
    await row.getByRole('button', { name: /resend/i }).click()
    
    await expect(page.getByText(/resent/i)).toBeVisible({ timeout: 5000 })
    page.on('dialog', dialog => dialog.accept())
    await row.getByRole('button', { name: /cancel/i }).click()
  })

  test('should cancel invitation', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(SEED_URLS.team)
    
    await expect(page.getByPlaceholder('colleague@example.com')).toBeVisible({ timeout: 10000 })
    await page.waitForLoadState('networkidle')
    
    const { email } = generateTestEmail('cancel-test')
    
    const emailInput = page.getByPlaceholder('colleague@example.com')
    await emailInput.fill(email)
    await emailInput.blur()
    
    const sendButton = page.getByRole('button', { name: 'Send Invitation', exact: true })
    await expect(sendButton).toBeEnabled({ timeout: 5000 })
    await sendButton.click()
    
    await expect(page.getByText(email, { exact: true })).toBeVisible({ timeout: 5000 })
    
    page.on('dialog', dialog => dialog.accept())
    const row = page.getByRole('row').filter({ hasText: email })
    await row.getByRole('button', { name: /cancel/i }).click()
    
    await expect(page.getByText(email, { exact: true })).not.toBeVisible({ timeout: 5000 })
  })

  test.skip('should accept invitation via email link', async ({ page, context }) => {
    // Skip: Requires edge function email delivery which needs local Docker setup
    // The invitation system is tested via:
    // 1. "should send invitation to new member" - verifies invitation creation
    // 2. Integration test with the accept-invite page directly
    test.setTimeout(60000)
    await loginAsSeededUser(page)
    await page.goto(SEED_URLS.team)
    
    await expect(page.getByPlaceholder('colleague@example.com')).toBeVisible({ timeout: 10000 })
    await page.waitForLoadState('networkidle')
    
    const { email, localPart } = generateTestEmail('accept-test')
    await clearMailbox(localPart)
    
    const emailInput = page.getByPlaceholder('colleague@example.com')
    await emailInput.fill(email)
    await emailInput.blur()
    
    const sendButton = page.getByRole('button', { name: 'Send Invitation', exact: true })
    await expect(sendButton).toBeEnabled({ timeout: 5000 })
    await sendButton.click()
    
    await expect(page.getByText(/invitation sent/i)).toBeVisible({ timeout: 5000 })
    
    const emailContent = await waitForEmail(localPart, { timeout: 30000 })
    expect(emailContent).toBeTruthy()
    
    const inviteLink = extractInviteLink(emailContent.body.html || emailContent.body.text)
    expect(inviteLink).toBeTruthy()
    
    await context.clearCookies()
    await page.goto(inviteLink!)
    
    await page.getByLabel('Password', { exact: true }).fill('NewUserPassword123!')
    await page.getByLabel('Confirm password').fill('NewUserPassword123!')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /create account|accept/i }).click()
    
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
    await expect(page.getByText(SEED_ORG.name)).toBeVisible({ timeout: 5000 })
  })

  test('should update team member role', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(SEED_URLS.team)
    
    await expect(page.getByPlaceholder('colleague@example.com')).toBeVisible({ timeout: 10000 })
    await page.waitForLoadState('networkidle')
    
    // Find actual members (have a select dropdown for role), not pending invitations
    const memberRowsWithDropdown = page.locator('tr').filter({ has: page.locator('select') }).filter({ hasNot: page.locator(':text("Owner")') })
    
    if (await memberRowsWithDropdown.count() === 0) {
      test.skip()
      return
    }
    
    const firstMember = memberRowsWithDropdown.first()
    const roleDropdown = firstMember.locator('select')
    
    await roleDropdown.selectOption('admin')
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(firstMember.getByText(/admin/i)).toBeVisible({ timeout: 5000 })
    await roleDropdown.selectOption('member')
  })

  test('should remove team member', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(SEED_URLS.team)
    
    await expect(page.getByPlaceholder('colleague@example.com')).toBeVisible({ timeout: 10000 })
    await page.waitForLoadState('networkidle')
    
    // Find rows with enabled Remove button (disabled for self)
    const enabledRemoveButton = page.getByRole('button', { name: /remove/i }).and(page.locator(':not([disabled])'))
    
    if (await enabledRemoveButton.count() === 0) {
      test.skip()
      return
    }
    
    const memberEmail = await enabledRemoveButton.first().locator('..').locator('..').locator('td').first().textContent()
    
    page.on('dialog', dialog => dialog.accept())
    await enabledRemoveButton.first().click()
    
    if (memberEmail) {
      await expect(page.getByText(memberEmail)).not.toBeVisible({ timeout: 5000 })
    }
  })
})
