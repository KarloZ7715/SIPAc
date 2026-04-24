import { test, expect, type Page } from '@playwright/test'

/**
 * Responsive overflow guard — verifies no horizontal overflow on key routes
 * across mobile (375×812), tablet (768×1024), and desktop (1440×900) viewports.
 *
 * If any page has `scrollWidth > innerWidth`, it means content is breaking
 * the viewport and producing an unwanted horizontal scrollbar.
 */

const ROUTES_TO_CHECK = ['/', '/login', '/dashboard', '/profile'] as const

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

async function checkNoHorizontalOverflow(page: Page, route: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded' })

  // Wait for layout to stabilise (animations, lazy hydration, etc.)
  await page.waitForTimeout(800)

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))

  expect(
    overflow.scrollWidth,
    `Horizontal overflow on ${route}: scrollWidth (${overflow.scrollWidth}) > innerWidth (${overflow.innerWidth})`,
  ).toBeLessThanOrEqual(overflow.innerWidth)
}

for (const viewport of VIEWPORTS) {
  test.describe(`Responsive overflow — ${viewport.name} (${viewport.width}×${viewport.height})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    for (const route of ROUTES_TO_CHECK) {
      test(`no horizontal overflow on ${route}`, async ({ page }) => {
        await checkNoHorizontalOverflow(page, route)
      })
    }
  })
}
