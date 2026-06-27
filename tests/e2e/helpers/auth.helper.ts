import type { Page } from '@playwright/test'

const SEED_USER = {
  email: 'owner@example.com',
  password: 'Test12345678!'
}

/**
 * Login as the seeded test user (owner@example.com)
 * Uses existing seed data - no registration needed
 */
export async function loginAsSeededUser(page: Page): Promise<void> {
  await page.goto('/auth/login')
  await page.waitForLoadState('networkidle')
  await page.getByRole('textbox', { name: 'Email address' }).fill(SEED_USER.email)
  await page.getByRole('textbox', { name: 'Password' }).fill(SEED_USER.password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
}

/**
 * Register a new user and login
 * Creates fresh user for tests that need isolation
 */
export async function registerAndLogin(
  page: Page,
  email?: string,
  password?: string
): Promise<{ email: string; password: string }> {
  const testEmail = email || `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`
  const testPassword = password || 'SecureTestPass123!'

  await page.goto('/auth/register')
  await page.waitForLoadState('networkidle')
  
  // Fill form fields with proper waits
  await page.getByLabel('Email').fill(testEmail)
  await page.locator('#password').waitFor({ state: 'visible' })
  await page.locator('#password').fill(testPassword)
  await page.locator('#confirmPassword').fill(testPassword)
  
  // Check terms
  await page.locator('#acceptTerms').check()
  
  // Wait for validation to complete
  await page.waitForTimeout(500)
  
  // Submit
  await page.getByRole('button', { name: /create account/i }).click()
  await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 15000 })

  return { email: testEmail, password: testPassword }
}

/**
 * Complete onboarding flow after registration
 * Creates org, project, and default environments
 */
export async function completeOnboarding(
  page: Page,
  orgName?: string,
  projectName?: string
): Promise<{ orgName: string; projectName: string; projectId: string | null }> {
  const testOrgName = orgName || `E2E Org ${Date.now()}`
  const testProjectName = projectName || `E2E Project ${Date.now()}`

  // Step 1: Organization Name
  await page.getByPlaceholder(/acme|organization/i).fill(testOrgName)
  await page.getByRole('button', { name: /next|continue/i }).click()

  // Step 2: Project Name  
  await page.getByPlaceholder(/my app|project/i).fill(testProjectName)
  await page.getByRole('button', { name: /next|continue/i }).click()

  // Step 3: Environments (accept defaults)
  await page.getByRole('button', { name: /complete|finish/i }).click()

  await page.waitForURL(/\/dashboard\/projects\/[^/]+/, { timeout: 10000 })

  const projectId = page.url().match(/\/dashboard\/projects\/([^/?#]+)/)?.[1] || null

  return { orgName: testOrgName, projectName: testProjectName, projectId }
}
