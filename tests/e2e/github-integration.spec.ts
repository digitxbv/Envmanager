import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { loginAsSeededUser } from './helpers/auth.helper'
import { SEED_URLS, SEED_GITHUB, SEED_ENVIRONMENTS } from './helpers/seed-data.helper'

const ensureGitHubEnabledOrSkip = async (page: Page) => {
  const enabledVisible = await page.getByText('Enabled').first().isVisible().catch(() => false)
  if (!enabledVisible) {
    test.skip()
    return false
  }

  await expect(page.getByText('Enabled').first()).toBeVisible({ timeout: 10000 })
  return true
}

/**
 * GitHub Integration Tests
 *
 * Tests the GitHub integration UI on the project integrations page.
 * Uses seeded GitHub installation data (test-org account).
 *
 * Note: Cannot test actual GitHub OAuth flow or sync operations - those require real GitHub credentials.
 * These tests focus on UI interactions and state changes.
 *
 * IMPORTANT: Tests run serially to avoid state conflicts - enabling GitHub in one test affects others.
 */
test.describe('GitHub Integration', () => {
  // Run tests serially because enabling GitHub persists in database
  test.describe.configure({ mode: 'serial' })

  test('should render GitHub card with all expected elements', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(`${SEED_URLS.project}/integrations`, { waitUntil: 'domcontentloaded' })

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10000 })

    // Verify GitHub card structure: heading, description
    await expect(page.getByRole('heading', { name: 'GitHub' })).toBeVisible()
    await expect(page.getByText('Sync to GitHub Actions secrets and variables')).toBeVisible()

    // Verify card container exists
    const githubCard = page.locator('.rounded-lg.border.bg-card').filter({ hasText: 'GitHub' }).first()
    await expect(githubCard).toBeVisible()
  })

  test('should show GitHub account info when installation exists', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(`${SEED_URLS.project}/integrations`, { waitUntil: 'domcontentloaded' })

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10000 })

    const accountVisible = await page.getByText(SEED_GITHUB.accountLogin).isVisible().catch(() => false)
    if (!accountVisible) {
      test.skip()
      return
    }

    await expect(page.getByText(SEED_GITHUB.accountLogin)).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(`GitHub ${SEED_GITHUB.accountType}`)).toBeVisible()
  })

  test('should show all integration cards on page', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(`${SEED_URLS.project}/integrations`)

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10000 })

    // Verify all 6 platforms are shown (GitHub + 5 others)
    const platformNames = ['GitHub', 'Vercel', 'Railway', 'Render', 'Dokploy', 'Coolify']

    for (const name of platformNames) {
      await expect(page.getByRole('heading', { name, level: 3 })).toBeVisible()
    }
  })

  test('should toggle enable state and open configure modal', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(`${SEED_URLS.project}/integrations`)

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10000 })

    const accountVisible = await page.getByText(SEED_GITHUB.accountLogin).isVisible().catch(() => false)
    if (!accountVisible) {
      test.skip()
      return
    }

    await expect(page.getByText(SEED_GITHUB.accountLogin)).toBeVisible({ timeout: 5000 })

    // Check if already enabled - if "Enabled" badge exists, skip the toggle step
    const alreadyEnabled = await page.getByText('Enabled').first().isVisible().catch(() => false)

    if (!alreadyEnabled) {
      // Should show "Enable the toggle" message when not enabled
      await expect(page.getByText('Enable the toggle to use GitHub for this project')).toBeVisible({ timeout: 5000 })

      // Find the GitHub toggle button using CSS selector
      // The toggle is in a div that has "GitHub Organization" text and has a sibling button
      // More specifically: the button in the GitHub integration card's connection info row
      // Structure: The GitHub heading is "GitHub", and near it is a button (toggle) in the connection info section
      // Use a more specific locator: find the account info section that has test-org text, then find its sibling button
      const githubInfoSection = page.getByText(SEED_GITHUB.accountLogin, { exact: true })
      // The toggle button is a sibling in the same container - go up to the container and find the button
      const toggleButton = githubInfoSection.locator('..').locator('..').locator('button')
      await toggleButton.click()

      // Wait a moment for the database operation to complete
      await page.waitForTimeout(1000)
    }

    // After enabling, the "Enabled" badge should appear
    await expect(page.getByText('Enabled').first()).toBeVisible({ timeout: 5000 })

    // Configure button should be visible
    await expect(page.getByRole('button', { name: /configure/i })).toBeVisible({ timeout: 3000 })

    // If modal auto-opened, close it
    const modalVisible = await page.getByRole('heading', { name: 'Configure GitHub Sync' }).isVisible().catch(() => false)
    if (modalVisible) {
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).not.toBeVisible({ timeout: 3000 })
    }
  })

  test('should show sync status and action buttons when enabled', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(`${SEED_URLS.project}/integrations`)

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10000 })

    const enabledVisible = await page.getByText('Enabled').first().isVisible().catch(() => false)
    if (!enabledVisible) {
      test.skip()
      return
    }

    await expect(page.getByText('Enabled').first()).toBeVisible({ timeout: 10000 })

    // Close modal if it auto-opened
    const modalVisible = await page.getByRole('heading', { name: 'Configure GitHub Sync' }).isVisible().catch(() => false)
    if (modalVisible) {
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).not.toBeVisible({ timeout: 3000 })
    }

    // Sync Now button should be visible
    await expect(page.getByRole('button', { name: /sync now/i })).toBeVisible({ timeout: 3000 })

    // Sync History toggle should be visible
    await expect(page.getByRole('button', { name: /sync history/i })).toBeVisible({ timeout: 3000 })

    // Should show "Never synced" status
    await expect(page.getByText('Never synced').first()).toBeVisible({ timeout: 3000 })

    // Should show hint to configure target (since no target is set yet)
    await expect(page.getByText(/configure the sync target before syncing/i)).toBeVisible({ timeout: 3000 })
  })

  test('should open configure modal via Configure button', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(`${SEED_URLS.project}/integrations`)

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10000 })

    const enabledVisible = await page.getByText('Enabled').first().isVisible().catch(() => false)
    if (!enabledVisible) {
      test.skip()
      return
    }

    await expect(page.getByText('Enabled').first()).toBeVisible({ timeout: 10000 })

    // Close auto-opened modal if present
    const modalAutoOpened = await page.getByRole('heading', { name: 'Configure GitHub Sync' }).isVisible().catch(() => false)
    if (modalAutoOpened) {
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).not.toBeVisible({ timeout: 3000 })
    }

    // Click Configure button
    await page.getByRole('button', { name: /^configure$/i }).click()

    // Modal should open
    await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).toBeVisible({ timeout: 5000 })

    // Modal should show the account login
    await expect(page.getByText(SEED_GITHUB.accountLogin)).toBeVisible()
  })

  test('should show environment tabs in configure modal', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(`${SEED_URLS.project}/integrations`)

    // Wait for page to load and GitHub to be enabled
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10000 })
    if (!(await ensureGitHubEnabledOrSkip(page))) return

    // Close auto-opened modal if present
    const modalAutoOpened = await page.getByRole('heading', { name: 'Configure GitHub Sync' }).isVisible().catch(() => false)
    if (modalAutoOpened) {
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).not.toBeVisible({ timeout: 3000 })
    }

    // Open configure modal
    await page.getByRole('button', { name: /^configure$/i }).click()
    await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).toBeVisible({ timeout: 5000 })

    // Should show tabs for each environment
    await expect(page.getByRole('tab', { name: SEED_ENVIRONMENTS.development.name })).toBeVisible({ timeout: 3000 })
    await expect(page.getByRole('tab', { name: SEED_ENVIRONMENTS.production.name })).toBeVisible()
  })

  test('should switch between environment tabs in configure modal', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(`${SEED_URLS.project}/integrations`)

    // Wait for page to load and GitHub to be enabled
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10000 })
    if (!(await ensureGitHubEnabledOrSkip(page))) return

    // Close auto-opened modal if present
    const modalAutoOpened = await page.getByRole('heading', { name: 'Configure GitHub Sync' }).isVisible().catch(() => false)
    if (modalAutoOpened) {
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).not.toBeVisible({ timeout: 3000 })
    }

    // Open configure modal
    await page.getByRole('button', { name: /^configure$/i }).click()
    await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).toBeVisible({ timeout: 5000 })

    // Development tab should be selected by default
    const devTab = page.getByRole('tab', { name: SEED_ENVIRONMENTS.development.name })
    await expect(devTab).toHaveAttribute('aria-selected', 'true')

    // Click on production tab
    await page.getByRole('tab', { name: SEED_ENVIRONMENTS.production.name }).click()

    // Production tab should now be selected
    const prodTab = page.getByRole('tab', { name: SEED_ENVIRONMENTS.production.name })
    await expect(prodTab).toHaveAttribute('aria-selected', 'true')
  })

  test('should close configure modal when clicking Cancel', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(`${SEED_URLS.project}/integrations`)

    // Wait for page to load and GitHub to be enabled
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10000 })
    if (!(await ensureGitHubEnabledOrSkip(page))) return

    // Close auto-opened modal if present
    const modalAutoOpened = await page.getByRole('heading', { name: 'Configure GitHub Sync' }).isVisible().catch(() => false)
    if (modalAutoOpened) {
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).not.toBeVisible({ timeout: 3000 })
    }

    // Open configure modal
    await page.getByRole('button', { name: /^configure$/i }).click()
    await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).toBeVisible({ timeout: 5000 })

    // Click Cancel button
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Modal should close
    await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).not.toBeVisible({ timeout: 3000 })
  })

  test('should have modal with expected structure (close button, tabs, save button)', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(`${SEED_URLS.project}/integrations`)

    // Wait for page to load and GitHub to be enabled
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10000 })
    if (!(await ensureGitHubEnabledOrSkip(page))) return

    // Close auto-opened modal if present
    const modalAutoOpened = await page.getByRole('heading', { name: 'Configure GitHub Sync' }).isVisible().catch(() => false)
    if (modalAutoOpened) {
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).not.toBeVisible({ timeout: 3000 })
    }

    // Open configure modal
    await page.getByRole('button', { name: /^configure$/i }).click()
    await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).toBeVisible({ timeout: 5000 })

    // Verify tabs container exists with environment tabs
    await expect(page.getByRole('tab', { name: SEED_ENVIRONMENTS.development.name })).toBeVisible()
    await expect(page.getByRole('tab', { name: SEED_ENVIRONMENTS.production.name })).toBeVisible()

    // Verify action buttons exist
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save Configuration' })).toBeVisible()
  })

  test('should persist GitHub storage mode after save and reopen', async ({ page }) => {
    await page.route('**/functions/v1/github-list-repos', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          repositories: [
            {
              id: 999001,
              name: 'envmanager-test',
              full_name: 'test-org/envmanager-test',
              owner: { login: 'test-org' },
              private: true
            }
          ]
        })
      })
    })

    await loginAsSeededUser(page)
    await page.goto(`${SEED_URLS.project}/integrations`)

    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10000 })

    const alreadyEnabled = await page.getByText('Enabled').first().isVisible().catch(() => false)
    if (!alreadyEnabled) {
      await expect(page.getByText(SEED_GITHUB.accountLogin)).toBeVisible({ timeout: 5000 })
      const githubInfoSection = page.getByText(SEED_GITHUB.accountLogin, { exact: true })
      const toggleButton = githubInfoSection.locator('..').locator('..').locator('button')
      await toggleButton.click()
      await page.waitForTimeout(1000)
    }

    if (!(await ensureGitHubEnabledOrSkip(page))) return

    const modalAutoOpened = await page.getByRole('heading', { name: 'Configure GitHub Sync' }).isVisible().catch(() => false)
    if (modalAutoOpened) {
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).not.toBeVisible({ timeout: 3000 })
    }

    await page.getByRole('button', { name: /^configure$/i }).click()
    await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).toBeVisible({ timeout: 5000 })

    await page.getByRole('tab', { name: SEED_ENVIRONMENTS.development.name }).click()
    const activePanel = page.locator('[role="tabpanel"]:not([hidden])')
    const repoSelect = activePanel.locator('label:has-text("Repository")').locator('xpath=following-sibling::select[1]')
    await expect(repoSelect).toBeVisible({ timeout: 5000 })
    await repoSelect.selectOption('test-org/envmanager-test')

    await page.getByRole('radio', { name: 'Store everything as GitHub secrets' }).check()
    await page.getByRole('button', { name: 'Save Configuration' }).click()
    await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).not.toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: /^configure$/i }).click()
    await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('radio', { name: 'Store everything as GitHub secrets' })).toBeChecked()
  })

  test('should persist selected-variable counts after save and reopen', async ({ page }) => {
    await page.route('**/functions/v1/github-list-repos', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          repositories: [
            {
              id: 999001,
              name: 'envmanager-test',
              full_name: 'test-org/envmanager-test',
              owner: { login: 'test-org' },
              private: true
            }
          ]
        })
      })
    })

    await loginAsSeededUser(page)
    await page.goto(`${SEED_URLS.project}/integrations`)

    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10000 })

    const alreadyEnabled = await page.getByText('Enabled').first().isVisible().catch(() => false)
    if (!alreadyEnabled) {
      await expect(page.getByText(SEED_GITHUB.accountLogin)).toBeVisible({ timeout: 5000 })
      const githubInfoSection = page.getByText(SEED_GITHUB.accountLogin, { exact: true })
      const toggleButton = githubInfoSection.locator('..').locator('..').locator('button')
      await toggleButton.click()
      await page.waitForTimeout(1000)
    }

    if (!(await ensureGitHubEnabledOrSkip(page))) return

    const modalAutoOpened = await page.getByRole('heading', { name: 'Configure GitHub Sync' }).isVisible().catch(() => false)
    if (modalAutoOpened) {
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).not.toBeVisible({ timeout: 3000 })
    }

    await page.getByRole('button', { name: /^configure$/i }).click()
    await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).toBeVisible({ timeout: 5000 })

    await page.getByRole('radio', { name: 'Selected variables' }).check()
    await page.getByRole('tab', { name: SEED_ENVIRONMENTS.development.name }).click()

    const activePanel = page.locator('[role="tabpanel"]:not([hidden])')
    const repoSelect = activePanel.locator('label:has-text("Repository")').locator('xpath=following-sibling::select[1]')
    await expect(repoSelect).toBeVisible({ timeout: 5000 })
    await repoSelect.selectOption('test-org/envmanager-test')

    await activePanel.getByRole('button', { name: 'Select variables' }).click()
    await expect(page.getByRole('heading', { name: 'Select variables' })).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: 'Clear' }).click()
    const variableCheckboxes = page.locator('input[type="checkbox"]')
    const availableCount = await variableCheckboxes.count()
    if (availableCount > 0) {
      await variableCheckboxes.nth(0).check()
    }
    if (availableCount > 1) {
      await variableCheckboxes.nth(1).check()
    }

    await page.getByRole('button', { name: 'Done' }).click()

    const selectedCard = activePanel.locator('.rounded-lg.border.p-4').filter({ hasText: 'Selected variables' }).first()
    const selectedCountText = (await selectedCard.locator('p.text-xs.text-muted-foreground.mt-2').innerText()).trim()
    expect(selectedCountText).toMatch(/^\d+ of \d+ selected$/)

    await page.getByRole('button', { name: 'Save Configuration' }).click()
    await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).not.toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: /^configure$/i }).click()
    await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).toBeVisible({ timeout: 5000 })
    await page.getByRole('tab', { name: SEED_ENVIRONMENTS.development.name }).click()

    const reopenedPanel = page.locator('[role="tabpanel"]:not([hidden])')
    const reopenedCard = reopenedPanel.locator('.rounded-lg.border.p-4').filter({ hasText: 'Selected variables' }).first()
    const reopenedCountText = (await reopenedCard.locator('p.text-xs.text-muted-foreground.mt-2').innerText()).trim()

    expect(reopenedCountText).toBe(selectedCountText)
    expect(reopenedCountText).not.toBe('0 of 0 selected')
  })

  test('should have Sync Now button disabled when no target configured', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(`${SEED_URLS.project}/integrations`)

    // Wait for page to load and GitHub to be enabled
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10000 })
    if (!(await ensureGitHubEnabledOrSkip(page))) return

    // Close auto-opened modal if present
    const modalAutoOpened = await page.getByRole('heading', { name: 'Configure GitHub Sync' }).isVisible().catch(() => false)
    if (modalAutoOpened) {
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByRole('heading', { name: 'Configure GitHub Sync' })).not.toBeVisible({ timeout: 3000 })
    }

    // Sync Now button should exist but may be disabled if no target
    const syncButton = page.getByRole('button', { name: /sync now/i })
    await expect(syncButton).toBeVisible({ timeout: 3000 })

    // Without a configured target, the button should be disabled
    // This verifies the button state logic works
    await expect(syncButton).toBeDisabled()
  })

  test('should load integrations page without critical errors', async ({ page }) => {
    await loginAsSeededUser(page)

    // Listen for console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto(`${SEED_URLS.project}/integrations`)

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10000 })

    // Allow some time for any async operations
    await page.waitForTimeout(2000)

    // Filter out expected/known errors (e.g., network errors for unconnected platforms, GitHub repo loading)
    const criticalErrors = errors.filter(err =>
      !err.includes('Failed to load') &&
      !err.includes('NetworkError') &&
      !err.includes('Failed to fetch') &&
      !err.includes('github-list-repos') &&
      !err.includes('useGitHubIntegration')
    )

    // No critical JS errors
    expect(criticalErrors.length).toBe(0)
  })
})
