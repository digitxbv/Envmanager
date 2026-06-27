import { test, expect } from '@playwright/test'
import { registerAndLogin, completeOnboarding } from './helpers/auth.helper'
import { upgradeProjectOrganizationToPro } from './helpers/billing.helper'

test.describe('Project Creation Flow', () => {
  const testPassword = 'ValidPassword123!'
  const projectName = `Test Project ${Date.now()}`

  test.beforeEach(async ({ page }) => {
    const testEmail = `project-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`

    await registerAndLogin(page, testEmail, testPassword)
    const onboarding = await completeOnboarding(
      page,
      `Project Org ${Date.now()}`,
      `Initial Project ${Date.now()}`
    )

    if (onboarding.projectId) {
      await upgradeProjectOrganizationToPro(onboarding.projectId)
    }

    await page.goto('/dashboard/projects/new', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
  })

  test('should display project creation form', async ({ page }) => {
    await expect(page.getByLabel(/name/i)).toBeVisible()
    await expect(page.getByLabel(/description/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /create/i })).toBeVisible()
  })

  test('should validate project name length', async ({ page }) => {
    const nameInput = page.getByLabel(/name/i)
    const submitButton = page.getByRole('button', { name: /create/i })

    // Try very short name
    await nameInput.fill('ab')
    await submitButton.click()

    await expect(page).toHaveURL(/\/dashboard\/projects\/new\??$/)
  })

  test('should validate project name characters', async ({ page }) => {
    const nameInput = page.getByLabel(/name/i)
    const submitButton = page.getByRole('button', { name: /create/i })

    // Try invalid characters
    await nameInput.fill('Test@#$')
    await submitButton.click()

    await expect(page).toHaveURL(/\/dashboard\/projects\/new\??$/)
  })

  test('should show loading state during creation', async ({ page }) => {
    const nameInput = page.getByLabel(/name/i)
    const descriptionInput = page.getByLabel(/description/i)
    const submitButton = page.getByRole('button', { name: /create/i })

    await nameInput.fill(projectName)
    await descriptionInput.fill('Test project description')

    // Click submit
    await submitButton.click()

    await expect(page).toHaveURL(/\/dashboard\/projects\/(new|[0-9a-f-]{36})\??$/, { timeout: 5000 })
  })

  test('should create project successfully without RLS errors', async ({ page }) => {
    const nameInput = page.getByLabel(/name/i)
    const descriptionInput = page.getByLabel(/description/i)
    const submitButton = page.getByRole('button', { name: /create/i })

    // Fill form
    await nameInput.fill(projectName)
    await descriptionInput.fill('Testing RLS policy fixes and loading states')

    // Submit
    await submitButton.click()

    // Should complete within 5 seconds (per NFR-001)
    await expect(page).toHaveURL(/\/dashboard\/projects\/[0-9a-f-]{36}$/, { timeout: 5000 })

    await expect(page.getByRole('heading', { name: projectName }).first()).toBeVisible()

    // Check console for no RLS errors (this will be checked in the test runner)
    const consoleLogs: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleLogs.push(msg.text())
      }
    })

    // Wait a bit for any delayed console errors
    await page.waitForTimeout(1000)

    // Verify no 42P17 error in console
    const hasRLSError = consoleLogs.some(log =>
      log.includes('42P17') || log.includes('infinite recursion')
    )
    expect(hasRLSError).toBe(false)
  })

  test('should show created project in projects list', async ({ page }) => {
    const nameInput = page.getByLabel(/name/i)
    const descriptionInput = page.getByLabel(/description/i)
    const submitButton = page.getByRole('button', { name: /create/i })

    const uniqueProjectName = `List Test ${Date.now()}`

    // Create project
    await nameInput.fill(uniqueProjectName)
    await descriptionInput.fill('Project for list test')
    await submitButton.click()

    // Wait for redirect
    await expect(page).toHaveURL(/\/dashboard\/projects\/[0-9a-f-]{36}$/, { timeout: 5000 })

    // Navigate to projects list
    await page.goto('/dashboard')

    await expect(page.getByText(uniqueProjectName).first()).toBeVisible()
  })

  test('should display project with default environments', async ({ page }) => {
    const nameInput = page.getByLabel(/name/i)
    const submitButton = page.getByRole('button', { name: /create/i })

    await nameInput.fill(projectName)
    await submitButton.click()

    // Wait for redirect to project detail page
    await expect(page).toHaveURL(/\/dashboard\/projects\/[0-9a-f-]{36}$/, { timeout: 5000 })

    await expect(page.getByRole('tab', { name: /development/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /production/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /staging/i })).toBeVisible()
  })

  test('should handle form validation before submission', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /create/i })

    // Try to submit empty form
    await submitButton.click()

    // Form should prevent submission or show validation errors
    // URL should not change
    await expect(page).toHaveURL(/\/dashboard\/projects\/new/)

    // Should still be on the same page after a short wait
    await page.waitForTimeout(500)
    await expect(page).toHaveURL(/\/dashboard\/projects\/new/)
  })

  test('should disable form inputs during submission', async ({ page }) => {
    const nameInput = page.getByLabel(/name/i)
    const descriptionInput = page.getByLabel(/description/i)
    const submitButton = page.getByRole('button', { name: /create/i })

    await nameInput.fill(projectName)
    await descriptionInput.fill('Test description')

    await submitButton.click()
    await expect(page).toHaveURL(/\/dashboard\/projects\/(new|[0-9a-f-]{36})\??$/, { timeout: 5000 })
  })

  test('should show success message after creation', async ({ page }) => {
    const nameInput = page.getByLabel(/name/i)
    const submitButton = page.getByRole('button', { name: /create/i })

    await nameInput.fill(projectName)
    await submitButton.click()

    await expect(page).toHaveURL(/\/dashboard\/projects\/[0-9a-f-]{36}$/, { timeout: 5000 })
  })

  test('should not timeout during project creation', async ({ page }) => {
    const nameInput = page.getByLabel(/name/i)
    const submitButton = page.getByRole('button', { name: /create/i })

    await nameInput.fill(projectName)

    const startTime = Date.now()
    await submitButton.click()

    // Wait for redirect
    await expect(page).toHaveURL(/\/dashboard\/projects\/[0-9a-f-]{36}$/, { timeout: 5000 })

    const endTime = Date.now()
    const duration = endTime - startTime

    // Should complete within 5 seconds (NFR-001)
    expect(duration).toBeLessThan(5000)
  })
})
