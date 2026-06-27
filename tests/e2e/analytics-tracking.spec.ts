import { test, expect, type Page } from '@playwright/test'
import { loginAsSeededUser } from './helpers/auth.helper'
import { SEED_USER, SEED_URLS, SEED_PROJECT } from './helpers/seed-data.helper'

test.describe.configure({ mode: 'serial' })

// =====================================================
// PostHog Instance Interception
// =====================================================
// The PostHog instance is exposed on window.__posthog_instance by the
// Nuxt plugin. We monkey-patch capture/identify/group on that instance
// and store intercepted calls on window arrays for later retrieval.

async function patchPostHog(page: Page) {
  await page.evaluate(() => {
    const w = window as any
    w.__ph_events = w.__ph_events || []
    w.__ph_identifies = w.__ph_identifies || []
    w.__ph_groups = w.__ph_groups || []

    const ph = w.__posthog_instance
    if (!ph) return

    if (typeof ph.opt_in_capturing === 'function') ph.opt_in_capturing()

    if (!ph.__e2e_patched) {
      ph.__e2e_patched = true
      const origCapture = ph.capture.bind(ph)
      ph.capture = function (event: string, props: any) {
        w.__ph_events.push({ event, properties: props })
        return origCapture(event, props)
      }
      const origIdentify = ph.identify?.bind(ph)
      if (origIdentify) {
        ph.identify = function (id: string, props: any) {
          w.__ph_identifies.push({ id, props })
          return origIdentify(id, props)
        }
      }
      const origGroup = ph.group?.bind(ph)
      if (origGroup) {
        ph.group = function (type: string, key: string, props: any) {
          w.__ph_groups.push({ type, key, props })
          return origGroup(type, key, props)
        }
      }
    }
  })
}

async function getEvents(page: Page) {
  return page.evaluate(() => (window as any).__ph_events || [])
}

async function getIdentifies(page: Page) {
  return page.evaluate(() => (window as any).__ph_identifies || [])
}

async function getGroups(page: Page) {
  return page.evaluate(() => (window as any).__ph_groups || [])
}

// =====================================================
// Test Suite
// =====================================================

test.describe('PostHog Analytics Tracking', () => {
  test('should identify user and set organization group on login', async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    await patchPostHog(page)

    await page.getByRole('textbox', { name: 'Email address' }).fill(SEED_USER.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(SEED_USER.password)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })
    await page.waitForTimeout(1000)
    await patchPostHog(page)
    await page.waitForTimeout(2000)

    const identifies = await getIdentifies(page)
    expect(identifies.length).toBeGreaterThan(0)
    expect(identifies[0].props).toHaveProperty('email')

    const events = await getEvents(page)
    const loginEvent = events.find((e: any) => e.event === 'user_logged_in')
    expect(loginEvent).toBeTruthy()

    const groups = await getGroups(page)
    expect(groups.length).toBeGreaterThan(0)
    expect(groups[0].type).toBe('organization')
    expect(groups[0].key).toBeTruthy()
  })

  test('should track variable creation', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(SEED_URLS.project, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    await patchPostHog(page)

    const addBtn = page.getByRole('button', { name: /add variable/i })
    if (!(await addBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip()
      return
    }

    await addBtn.click()
    await expect(page.getByRole('heading', { name: /add new variable/i })).toBeVisible({ timeout: 3000 })

    const testKey = `E2E_ANALYTICS_${Date.now()}`
    await page.getByRole('textbox', { name: 'Key' }).fill(testKey)
    await page.locator('#variableValue').fill('test_value')

    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByRole('heading', { name: /add new variable/i })).not.toBeVisible({ timeout: 5000 })

    const events = await getEvents(page)
    const createEvent = events.find((e: any) => e.event === 'variable_created')
    expect(createEvent).toBeTruthy()
    expect(createEvent?.properties).toHaveProperty('project_id')
    expect(createEvent?.properties).toHaveProperty('environment_id')

    // Clean up
    const row = page.locator('tr, [data-testid="variable-row"]').filter({ hasText: testKey }).first()
    const deleteBtn = row.getByRole('button', { name: /delete|remove/i }).first()
    if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      page.on('dialog', dialog => dialog.accept())
      await deleteBtn.click()
      await page.waitForTimeout(1000)
    }
  })

  test('should track upgrade button click on billing page', async ({ page }) => {
    await loginAsSeededUser(page)
    await page.goto(SEED_URLS.billing, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    await patchPostHog(page)

    const upgradeBtn = page.getByRole('button', { name: /upgrade/i }).first()
    if (!(await upgradeBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip()
      return
    }

    await page.route('**/create-checkout-session**', route => route.abort())
    await page.route('**/api.stripe.com/**', route => route.abort())

    await upgradeBtn.click()
    await page.waitForTimeout(1500)

    const events = await getEvents(page)
    const upgradeEvent = events.find((e: any) => e.event === 'upgrade_button_clicked')
    expect(upgradeEvent).toBeTruthy()
    expect(['billing_page', 'settings_billing']).toContain(upgradeEvent?.properties?.source)
  })

  test('should track billing period toggle on pricing page', async ({ page }) => {
    await page.goto('/pricing')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    await patchPostHog(page)

    const annualBtn = page.getByRole('button', { name: /annual/i }).first()
    if (!(await annualBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip()
      return
    }

    await annualBtn.click()
    await page.waitForTimeout(1000)

    const events = await getEvents(page)
    const toggleEvent = events.find((e: any) => e.event === 'billing_period_toggled')
    expect(toggleEvent).toBeTruthy()
    expect(toggleEvent?.properties?.selected_period).toBe('annual')
  })
})
