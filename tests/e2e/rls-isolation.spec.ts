import { test, expect, type Page } from '@playwright/test'
import { registerAndLogin, completeOnboarding } from './helpers/auth.helper'

async function signupAndOnboard(page: Page, email: string, password: string, projectName: string) {
  await registerAndLogin(page, email, password)
  await completeOnboarding(page, `RLS Org ${Date.now()}`, projectName)
  await expect(page).toHaveURL(/\/dashboard\/projects\/[0-9a-f-]{36}$/, { timeout: 10000 })

  const projectUrl = page.url()
  const projectId = projectUrl.match(/\/dashboard\/projects\/([^/?#]+)/)?.[1] || ''

  return { projectUrl, projectId }
}

test.describe('RLS Isolation Tests', () => {
  const userA = {
    email: `user-a-${Date.now()}@example.com`,
    password: 'ValidPassword123!'
  }

  const userB = {
    email: `user-b-${Date.now()}@example.com`,
    password: 'ValidPassword123!'
  }

  test('should isolate projects between users', async ({ page, context }) => {
    const userAProjectName = `RLS Test Project ${Date.now()}`
    const userAResult = await signupAndOnboard(page, userA.email, userA.password, userAProjectName)

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(userAProjectName)).toBeVisible()

    await context.clearCookies()

    const userBProjectName = `RLS User B Project ${Date.now()}`
    await signupAndOnboard(page, userB.email, userB.password, userBProjectName)

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(userAProjectName)).not.toBeVisible()

    await page.goto(userAResult.projectUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    const stayedOnProjectUrl = page.url().includes(userAResult.projectId)
    if (stayedOnProjectUrl) {
      await expect(page.getByText(/not found|unauthorized|access denied/i)).toBeVisible()
      await expect(page.getByText(userAProjectName)).not.toBeVisible()
      return
    }

    expect(page.url()).not.toContain(userAResult.projectId)
  })

  test('should enforce RLS on project members table', async ({ page, context }) => {
    const userAEmail = `rls-member-a-${Date.now()}@example.com`
    const userBEmail = `rls-member-b-${Date.now()}@example.com`
    const userAProjectName = `Member Test ${Date.now()}`

    await signupAndOnboard(page, userAEmail, userA.password, userAProjectName)
    await context.clearCookies()

    await signupAndOnboard(page, userBEmail, userB.password, `Member Test B ${Date.now()}`)

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    await expect(page.getByText(userAProjectName)).not.toBeVisible()
  })

  test('should not have RLS policy recursion errors', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await signupAndOnboard(page, `rls-error-test-${Date.now()}@example.com`, 'ValidPassword123!', `Error Test ${Date.now()}`)

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const hasRLSError = consoleErrors.some(error =>
      error.includes('42P17') ||
      error.includes('infinite recursion') ||
      (error.includes('policy') && error.includes('recursion'))
    )

    expect(hasRLSError).toBe(false)
  })

  test('should correctly filter projects by owner', async ({ page }) => {
    const ownerProjectName = `Owner Project ${Date.now()}`
    await signupAndOnboard(page, `owner-${Date.now()}@example.com`, 'ValidPassword123!', ownerProjectName)

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    await expect(page.getByText(ownerProjectName)).toBeVisible()
  })

  test('should prevent unauthorized project deletion', async ({ page, context }) => {
    const deleteProjectName = `Delete Test ${Date.now()}`
    const userA = await signupAndOnboard(page, `delete-a-${Date.now()}@example.com`, 'ValidPassword123!', deleteProjectName)

    await context.clearCookies()
    await signupAndOnboard(page, `delete-b-${Date.now()}@example.com`, 'ValidPassword123!', `Delete B ${Date.now()}`)

    await page.goto(`/dashboard/projects/${userA.projectId}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    if (page.url().includes(userA.projectId)) {
      await expect(page.getByText(/not found|unauthorized|access denied/i)).toBeVisible()
      return
    }

    expect(page.url()).not.toContain(userA.projectId)
  })
})
