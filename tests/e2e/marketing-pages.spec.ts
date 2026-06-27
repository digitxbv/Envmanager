import { test, expect, type Locator, type Page } from '@playwright/test'

type MarketingRouteCase = {
  route: string
  hasRegisterCta: boolean
  headingIncludes?: string
}

const ROUTE_CASES: MarketingRouteCase[] = [
  { route: '/', hasRegisterCta: true },
  { route: '/features', hasRegisterCta: true },
  { route: '/pricing', hasRegisterCta: true },
  { route: '/for-developers', hasRegisterCta: true },
  { route: '/for-enterprises', hasRegisterCta: true },
  { route: '/for-startups', hasRegisterCta: true },
  { route: '/for-agencies', hasRegisterCta: true },
  { route: '/integrations', hasRegisterCta: true },
  { route: '/compare/doppler', hasRegisterCta: true },
  { route: '/compare/dotenvx', hasRegisterCta: true },
  { route: '/compare/infisical', hasRegisterCta: true },
  { route: '/solutions/stop-secrets-in-slack', hasRegisterCta: true },
  { route: '/solutions/team-security', hasRegisterCta: true },
  { route: '/solutions/audit-compliance', hasRegisterCta: true },
  { route: '/privacy', hasRegisterCta: false },
  { route: '/terms', hasRegisterCta: false },
  { route: '/integrations/github', hasRegisterCta: true, headingIncludes: 'GitHub' },
  { route: '/integrations/vercel', hasRegisterCta: true, headingIncludes: 'Vercel' },
  { route: '/integrations/railway', hasRegisterCta: true, headingIncludes: 'Railway' },
  { route: '/integrations/render', hasRegisterCta: true, headingIncludes: 'Render' },
  { route: '/integrations/dokploy', hasRegisterCta: true, headingIncludes: 'Dokploy' },
  { route: '/integrations/coolify', hasRegisterCta: true, headingIncludes: 'Coolify' }
]

const MOBILE_VIEWPORT = { width: 390, height: 844 }
const REGISTER_CTA_TEXT = /get started|start free|start free trial|start tracking|secure your secrets|schedule demo/i

function routeToRegExp(route: string) {
  const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`${escapedRoute}$`)
}

async function assertRouteLoaded(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' })

  expect(response, `No navigation response for ${route}`).not.toBeNull()
  expect(
    response?.ok(),
    `Expected a successful response for ${route}, got ${response?.status()}`
  ).toBeTruthy()

  await expect(page).toHaveURL(routeToRegExp(route))
  await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 })
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
}

async function assertDarkOnlyTheme(page: Page) {
  await expect
    .poll(async () => {
      return page.evaluate(() => document.documentElement.classList.contains('dark'))
    })
    .toBe(true)

  await expect(page.getByRole('button', { name: 'Toggle theme' })).toHaveCount(0)
}

async function findRegisterCta(page: Page, route: string): Promise<Locator> {
  const candidates = [
    page.getByTestId('primary-cta').first(),
    page.locator('main a[href="/auth/register"]').first(),
    page.locator('main button').filter({ hasText: REGISTER_CTA_TEXT }).last()
  ]

  for (const candidate of candidates) {
    const isVisible = await candidate.isVisible().catch(() => false)
    if (isVisible) {
      return candidate
    }
  }

  throw new Error(`Unable to find register CTA on route: ${route}`)
}

async function assertRegisterCtaNavigation(page: Page, route: string) {
  const registerCta = await findRegisterCta(page, route)
  const didNavigateViaRouteCtaPromise = page
    .waitForURL('**/auth/register**', { timeout: 8000 })
    .then(() => true)
    .catch(() => false)

  await registerCta.click()
  const didNavigateViaRouteCta = await didNavigateViaRouteCtaPromise

  if (!didNavigateViaRouteCta) {
    await assertRouteLoaded(page, route)

    const fallbackRegisterLink = page.getByRole('link', { name: 'Sign up' }).first()
    await expect(fallbackRegisterLink).toHaveAttribute('href', '/auth/register')

    await Promise.all([
      page.waitForURL('**/auth/register**'),
      fallbackRegisterLink.click()
    ])
  }

  await expect(page).toHaveURL(/\/auth\/register(?:\?|$)/)
}

test.describe('Marketing pages coverage', () => {
  for (const routeCase of ROUTE_CASES) {
    test(`${routeCase.route} enforces dark mode and route coverage`, async ({ page }) => {
      await assertRouteLoaded(page, routeCase.route)

      if (routeCase.headingIncludes) {
        await expect(page.getByRole('heading', { level: 1 })).toContainText(routeCase.headingIncludes)
      }

      await assertDarkOnlyTheme(page)
      await expect(page.locator('main').first()).toBeVisible()

      if (routeCase.hasRegisterCta) {
        await assertRegisterCtaNavigation(page, routeCase.route)
      }
    })
  }
})

test.describe('Marketing pages mobile viewport', () => {
  test.use({ viewport: MOBILE_VIEWPORT })

  for (const routeCase of ROUTE_CASES) {
    test(`${routeCase.route} loads on mobile`, async ({ page }) => {
      await assertRouteLoaded(page, routeCase.route)

      if (routeCase.hasRegisterCta) {
        const registerCta = await findRegisterCta(page, routeCase.route)
        await expect(registerCta).toBeVisible()
      }
    })
  }
})
