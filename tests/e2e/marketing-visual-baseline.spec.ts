import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

// =====================================================
// Configuration
// =====================================================

const ROUTES = [
  '/',
  '/features',
  '/pricing',
  '/for-developers',
  '/for-enterprises',
  '/for-startups',
  '/solutions/stop-secrets-in-slack',
  '/solutions/team-security',
  '/solutions/audit-compliance',
  '/privacy',
  '/terms'
]

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 375, height: 667 }
]

const THEMES: Array<'dark' | 'light'> = ['dark', 'light']

const BASELINE_DIR = path.join(process.cwd(), '.sisyphus/evidence/baseline')

// =====================================================
// Utilities
// =====================================================

/**
 * Ensure baseline directory exists
 */
function ensureBaselineDir() {
  if (!fs.existsSync(BASELINE_DIR)) {
    fs.mkdirSync(BASELINE_DIR, { recursive: true })
  }
}

/**
 * Generate screenshot filename
 * Format: {route}-{viewport}-{theme}.png
 * Example: features-desktop-dark.png
 */
function getScreenshotPath(route: string, viewport: string, theme: string): string {
  const sanitizedRoute = route === '/' ? 'home' : route.replace(/\//g, '-').replace(/^-/, '')
  const filename = `${sanitizedRoute}-${viewport}-${theme}.png`
  return path.join(BASELINE_DIR, filename)
}

/**
 * Toggle dark mode by adding/removing class on html element
 */
async function setTheme(page: any, theme: 'dark' | 'light') {
  await page.evaluate((t: 'dark' | 'light') => {
    const html = document.documentElement
    if (t === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }, theme)

  // Wait for any theme transitions
  await page.waitForTimeout(300)
}

// =====================================================
// Test Suite
// =====================================================

test.describe('Marketing visual baseline', () => {
  test.beforeAll(() => {
    ensureBaselineDir()
  })

  for (const route of ROUTES) {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        test(`${route} ${viewport.name} ${theme}`, async ({ page }) => {
          // Set viewport
          await page.setViewportSize({
            width: viewport.width,
            height: viewport.height
          })

          // Navigate to route
          await page.goto(route, { waitUntil: 'networkidle' })

          // Set theme
          await setTheme(page, theme)

          // Take screenshot
          const screenshotPath = getScreenshotPath(route, viewport.name, theme)
          await page.screenshot({
            path: screenshotPath,
            fullPage: true
          })

          // Verify screenshot was created
          expect(fs.existsSync(screenshotPath)).toBe(true)
        })
      }
    }
  }
})
