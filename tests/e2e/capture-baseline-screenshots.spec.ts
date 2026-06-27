import { test, expect } from '@playwright/test'
import { loginAsSeededUser } from './helpers/auth.helper'
import fs from 'fs'
import path from 'path'

/**
 * Capture baseline screenshots for all marketing pages and product dashboard views
 * 
 * Marketing pages: 18 pages at 1280px (desktop) and 375px (mobile)
 * Product screenshots: 4-5 dashboard views at 1280px
 * 
 * Output:
 * - .sisyphus/evidence/baseline/{page}-desktop.png (19 files)
 * - .sisyphus/evidence/baseline/{page}-mobile.png (19 files)
 * - public/images/product/{view}.png (4-5 files)
 */

const MARKETING_PAGES = [
  { path: '/', name: 'home' },
  { path: '/features', name: 'features' },
  { path: '/pricing', name: 'pricing' },
  { path: '/for-developers', name: 'for-developers' },
  { path: '/for-startups', name: 'for-startups' },
  { path: '/for-agencies', name: 'for-agencies' },
  { path: '/for-enterprises', name: 'for-enterprises' },
  { path: '/privacy', name: 'privacy' },
  { path: '/terms', name: 'terms' },
  { path: '/blog', name: 'blog' },
  { path: '/integrations', name: 'integrations' },
  { path: '/compare/doppler', name: 'compare-doppler' },
  { path: '/compare/infisical', name: 'compare-infisical' },
  { path: '/compare/dotenvx', name: 'compare-dotenvx' },
  { path: '/solutions/team-security', name: 'solutions-team-security' },
  { path: '/solutions/audit-compliance', name: 'solutions-audit-compliance' },
  { path: '/solutions/stop-secrets-in-slack', name: 'solutions-stop-secrets-in-slack' },
  { path: '/docs', name: 'docs' },
  { path: '/auth/login', name: 'auth-login' },
]

const DESKTOP_WIDTH = 1280
const DESKTOP_HEIGHT = 720
const MOBILE_WIDTH = 375
const MOBILE_HEIGHT = 667

const BASELINE_DIR = '.sisyphus/evidence/baseline'
const PRODUCT_DIR = 'public/images/product'

// Ensure directories exist
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

test.describe('Capture Baseline Screenshots', () => {
  test.beforeAll(() => {
    ensureDir(BASELINE_DIR)
    ensureDir(PRODUCT_DIR)
  })

  test('capture all marketing pages at desktop width (1280px)', async ({ page }) => {
    await page.setViewportSize({ width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT })
    await page.emulateMedia({ colorScheme: 'light' })

    const desktopFiles: string[] = []

    for (const page_config of MARKETING_PAGES) {
      try {
        await page.goto(page_config.path, { waitUntil: 'networkidle', timeout: 30000 })
        await page.waitForLoadState('networkidle')

        const filename = `${page_config.name}-desktop.png`
        const filepath = path.join(BASELINE_DIR, filename)

        await page.screenshot({ path: filepath, fullPage: true })

        // Verify file exists and is not corrupt (>10KB)
        const stats = fs.statSync(filepath)
        if (stats.size > 10240) {
          desktopFiles.push(`${filename} (${stats.size} bytes)`)
          console.log(`✓ Captured ${filename} (${stats.size} bytes)`)
        } else {
          console.warn(`⚠ ${filename} is too small (${stats.size} bytes)`)
        }
      } catch (error) {
        console.error(`✗ Failed to capture ${page_config.path}:`, error)
      }
    }

    // Save file listing
    const desktopList = desktopFiles.join('\n')
    fs.writeFileSync('.sisyphus/evidence/task-1-desktop-baseline.txt', desktopList)
    console.log(`\n✓ Desktop baseline listing saved (${desktopFiles.length} files)`)
  })

  test('capture all marketing pages at mobile width (375px)', async ({ page }) => {
    await page.setViewportSize({ width: MOBILE_WIDTH, height: MOBILE_HEIGHT })
    await page.emulateMedia({ colorScheme: 'light' })

    const mobileFiles: string[] = []

    for (const page_config of MARKETING_PAGES) {
      try {
        await page.goto(page_config.path, { waitUntil: 'networkidle', timeout: 30000 })
        await page.waitForLoadState('networkidle')

        const filename = `${page_config.name}-mobile.png`
        const filepath = path.join(BASELINE_DIR, filename)

        await page.screenshot({ path: filepath, fullPage: true })

        // Verify file exists and is not corrupt (>10KB)
        const stats = fs.statSync(filepath)
        if (stats.size > 10240) {
          mobileFiles.push(`${filename} (${stats.size} bytes)`)
          console.log(`✓ Captured ${filename} (${stats.size} bytes)`)
        } else {
          console.warn(`⚠ ${filename} is too small (${stats.size} bytes)`)
        }
      } catch (error) {
        console.error(`✗ Failed to capture ${page_config.path}:`, error)
      }
    }

    // Save file listing
    const mobileList = mobileFiles.join('\n')
    fs.writeFileSync('.sisyphus/evidence/task-1-mobile-baseline.txt', mobileList)
    console.log(`\n✓ Mobile baseline listing saved (${mobileFiles.length} files)`)
  })

  test('capture product dashboard screenshots', async ({ page }) => {
    await page.setViewportSize({ width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT })
    await page.emulateMedia({ colorScheme: 'light' })

    // Login as seeded user
    await loginAsSeededUser(page)

    const productFiles: string[] = []

    // 1. Dashboard overview/home view
    try {
      await page.goto('/dashboard', { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000) // Wait for animations

      const filename = 'dashboard-overview.png'
      const filepath = path.join(PRODUCT_DIR, filename)
      await page.screenshot({ path: filepath, fullPage: false })

      const stats = fs.statSync(filepath)
      if (stats.size > 10240) {
        productFiles.push(`${filename} (${stats.size} bytes)`)
        console.log(`✓ Captured ${filename} (${stats.size} bytes)`)
      }
    } catch (error) {
      console.error('✗ Failed to capture dashboard overview:', error)
    }

    // 2. Variables/secrets management view - navigate to first project
    try {
      // Get first project link
      const projectLink = await page.locator('a[href*="/dashboard/projects/"]').first()
      if (await projectLink.isVisible()) {
        await projectLink.click()
        await page.waitForURL(/\/dashboard\/projects\/[^/]+$/, { timeout: 15000 })
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1000)

        const filename = 'variables-management.png'
        const filepath = path.join(PRODUCT_DIR, filename)
        await page.screenshot({ path: filepath, fullPage: false })

        const stats = fs.statSync(filepath)
        if (stats.size > 10240) {
          productFiles.push(`${filename} (${stats.size} bytes)`)
          console.log(`✓ Captured ${filename} (${stats.size} bytes)`)
        }
      }
    } catch (error) {
      console.error('✗ Failed to capture variables management:', error)
    }

    // 3. Environment configuration view
    try {
      const envLink = await page.locator('a[href*="/schema"]').first()
      if (await envLink.isVisible()) {
        await envLink.click()
        await page.waitForURL(/\/schema/, { timeout: 15000 })
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1000)

        const filename = 'environment-configuration.png'
        const filepath = path.join(PRODUCT_DIR, filename)
        await page.screenshot({ path: filepath, fullPage: false })

        const stats = fs.statSync(filepath)
        if (stats.size > 10240) {
          productFiles.push(`${filename} (${stats.size} bytes)`)
          console.log(`✓ Captured ${filename} (${stats.size} bytes)`)
        }
      }
    } catch (error) {
      console.error('✗ Failed to capture environment configuration:', error)
    }

    // 4. Team/settings view
    try {
      await page.goto('/dashboard/team', { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      const filename = 'team-settings.png'
      const filepath = path.join(PRODUCT_DIR, filename)
      await page.screenshot({ path: filepath, fullPage: false })

      const stats = fs.statSync(filepath)
      if (stats.size > 10240) {
        productFiles.push(`${filename} (${stats.size} bytes)`)
        console.log(`✓ Captured ${filename} (${stats.size} bytes)`)
      }
    } catch (error) {
      console.error('✗ Failed to capture team settings:', error)
    }

    // 5. Activity/audit log view
    try {
      await page.goto('/dashboard/activity', { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      const filename = 'activity-audit.png'
      const filepath = path.join(PRODUCT_DIR, filename)
      await page.screenshot({ path: filepath, fullPage: false })

      const stats = fs.statSync(filepath)
      if (stats.size > 10240) {
        productFiles.push(`${filename} (${stats.size} bytes)`)
        console.log(`✓ Captured ${filename} (${stats.size} bytes)`)
      }
    } catch (error) {
      console.error('✗ Failed to capture activity audit:', error)
    }

    // Save file listing
    const productList = productFiles.join('\n')
    fs.writeFileSync('.sisyphus/evidence/task-1-product-screenshots.txt', productList)
    console.log(`\n✓ Product screenshots listing saved (${productFiles.length} files)`)
  })
})
