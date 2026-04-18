import { expect, test, type Page } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import User from '../../server/models/User'

const testRunId = `e2e-layout-${Date.now()}`
const appPort = Number(process.env.PLAYWRIGHT_PORT ?? 4173)
const appBaseUrl = `http://127.0.0.1:${appPort}`
const userEmail = `layout-${testRunId}@correo.unicordoba.edu.co`
const userPassword = 'LayoutE2E123!'
const userFullName = 'Docente Layout E2E'

function readEnvValue(name: string): string {
  const directValue = process.env[name]
  if (typeof directValue === 'string' && directValue.trim().length > 0) {
    return directValue.trim()
  }

  if (!existsSync('.env')) {
    return ''
  }

  const envFile = readFileSync('.env', 'utf8')
  const line = envFile.split(/\r?\n/).find((candidate) => candidate.startsWith(`${name}=`))

  return line ? line.slice(name.length + 1).trim() : ''
}

async function connectMongo() {
  const mongodbUri = readEnvValue('MONGODB_URI')

  if (!mongodbUri) {
    throw new Error('MONGODB_URI no está definido')
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongodbUri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10_000,
    })
  }
}

async function loginWithSessionCookie(page: Page) {
  const response = await page.request.post(`${appBaseUrl}/api/auth/login`, {
    data: {
      email: userEmail,
      password: userPassword,
    },
  })

  if (!response.ok()) {
    throw new Error(`No se pudo iniciar sesión (${response.status()})`)
  }

  const cookies = await page.context().cookies(appBaseUrl)
  if (!cookies.some((cookie) => cookie.name === 'sipac_session')) {
    throw new Error('No se recibió cookie sipac_session tras login')
  }
}

test.describe('Layout shell regression', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(120_000)

  test.beforeAll(async () => {
    await connectMongo()
    await User.deleteMany({ email: userEmail })

    await User.create({
      fullName: userFullName,
      email: userEmail,
      passwordHash: userPassword,
      program: 'Ingeniería de Sistemas',
      role: 'docente',
      emailVerifiedAt: new Date(),
    })
  })

  test.afterAll(async () => {
    await User.deleteMany({ email: userEmail })

    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect()
    }
  })

  test('navega entre páginas internas sin warnings de slots ni duplicación visible del shell', async ({
    page,
  }) => {
    const consoleMessages: string[] = []
    const pageErrors: string[] = []

    page.on('console', (message) => {
      consoleMessages.push(`[${message.type()}] ${message.text()}`)
    })

    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })

    await loginWithSessionCookie(page)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(400)

    const sidebarShell = page.locator("aside.sidebar-shell[data-mobile='false']").first()
    const sidebarResizeHandle = page
      .locator('button[role="separator"][aria-label="Redimensionar barra lateral"]')
      .first()

    await expect(sidebarShell).toHaveAttribute('data-collapsed', 'false')
    await expect(sidebarResizeHandle).toBeVisible()

    const desktopSidebarToggle = page
      .locator("aside.sidebar-shell[data-mobile='false'] button.sidebar-toggle")
      .first()

    await expect(desktopSidebarToggle).toBeVisible()
    await expect(desktopSidebarToggle).toHaveAttribute('aria-label', 'Contraer barra lateral')
    await page.waitForFunction(() => {
      const toggle = document.querySelector(
        "aside.sidebar-shell[data-mobile='false'] button.sidebar-toggle",
      ) as HTMLElement | null
      return Boolean(toggle && (toggle as { __vueParentComponent?: unknown }).__vueParentComponent)
    })

    const collapseToggle = desktopSidebarToggle
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await collapseToggle.evaluate((element) => {
        ;(element as HTMLButtonElement).click()
      })
      if ((await sidebarShell.getAttribute('data-collapsed')) === 'true') {
        break
      }
      await page.waitForTimeout(140)
    }
    await expect(sidebarShell).toHaveAttribute('data-collapsed', 'true')

    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(350)
    await expect(sidebarShell).toHaveAttribute('data-collapsed', 'true')
    await page.waitForFunction(() => {
      const toggle = document.querySelector(
        "aside.sidebar-shell[data-mobile='false'] button.sidebar-toggle",
      ) as HTMLElement | null
      return Boolean(toggle && (toggle as { __vueParentComponent?: unknown }).__vueParentComponent)
    })

    const expandToggle = page
      .locator("aside.sidebar-shell[data-mobile='false'] button.sidebar-toggle")
      .first()
    await expect(expandToggle).toHaveAttribute('aria-label', 'Expandir barra lateral')
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expandToggle.evaluate((element) => {
        ;(element as HTMLButtonElement).click()
      })
      if ((await sidebarShell.getAttribute('data-collapsed')) === 'false') {
        break
      }
      await page.waitForTimeout(140)
    }
    await expect(sidebarShell).toHaveAttribute('data-collapsed', 'false')

    const initialSidebarWidth = Number(
      (await sidebarResizeHandle.getAttribute('aria-valuenow')) ?? '0',
    )
    const resizeHandleBox = await sidebarResizeHandle.boundingBox()
    if (!resizeHandleBox) {
      throw new Error('No se pudo ubicar el separador de resize del sidebar')
    }

    const dragOffsets = initialSidebarWidth >= 23.5 ? [-96, 96] : [96, -96]
    let resizedSidebarWidth = initialSidebarWidth

    for (const offset of dragOffsets) {
      await page.mouse.move(
        resizeHandleBox.x + resizeHandleBox.width / 2,
        resizeHandleBox.y + resizeHandleBox.height / 2,
      )
      await page.mouse.down()
      await page.mouse.move(
        resizeHandleBox.x + resizeHandleBox.width / 2 + offset,
        resizeHandleBox.y + resizeHandleBox.height / 2,
        { steps: 8 },
      )
      await page.mouse.up()
      await page.waitForTimeout(250)

      resizedSidebarWidth = Number((await sidebarResizeHandle.getAttribute('aria-valuenow')) ?? '0')
      if (Math.abs(resizedSidebarWidth - initialSidebarWidth) > 0.75) {
        break
      }
    }

    expect(Math.abs(resizedSidebarWidth - initialSidebarWidth)).toBeGreaterThan(0.75)

    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(350)

    const reloadedSidebarWidth = Number(
      (await sidebarResizeHandle.getAttribute('aria-valuenow')) ?? '0',
    )
    expect(Math.abs(reloadedSidebarWidth - initialSidebarWidth)).toBeGreaterThan(0.75)
    expect(Math.abs(reloadedSidebarWidth - resizedSidebarWidth)).toBeLessThan(0.75)

    const navigations: Array<{
      expectedPath: string
      expectedText?: string
      expectedTextboxName?: string
      expectedTestId?: string
    }> = [
      {
        expectedPath: '/chat',
        expectedText: '¿Qué investigaremos hoy?',
        expectedTextboxName: 'Mensaje para el asistente',
      },
      {
        expectedPath: '/dashboard',
        expectedText: 'Dashboard',
      },
      {
        expectedPath: '/repository',
        expectedText: 'Repositorio',
      },
      {
        expectedPath: '/workspace-documents',
        expectedTestId: 'workspace-upload-aside',
      },
      {
        expectedPath: '/',
      },
    ]

    for (const navigation of navigations) {
      await page
        .locator(`a[href="${navigation.expectedPath}"]`)
        .filter({ visible: true })
        .first()
        .evaluate((element) => {
          ;(element as HTMLAnchorElement).click()
        })

      await expect(page).toHaveURL(
        new RegExp(`${navigation.expectedPath.replace('/', '\\/')}(?:\\?.*)?$`),
      )
      await page.waitForTimeout(500)

      if (navigation.expectedText) {
        await expect(
          page.getByText(navigation.expectedText).filter({ visible: true }).first(),
        ).toBeVisible()
      }

      if (navigation.expectedTextboxName) {
        await expect(
          page.getByRole('textbox', { name: navigation.expectedTextboxName }).filter({
            visible: true,
          }),
        ).toHaveCount(1)
      }

      if (navigation.expectedTestId) {
        await expect(
          page.getByTestId(navigation.expectedTestId).filter({ visible: true }),
        ).toHaveCount(1)
      }

      await expect(page.locator('#main-content')).toHaveCount(1)
      await expect(page.locator('#main-content')).toContainText(/\S+/)
      await page.waitForTimeout(250)
    }

    const relevantConsole = consoleMessages.filter((message) => {
      const lowerMessage = message.toLowerCase()
      return lowerMessage.includes('[vue warn]') || lowerMessage.includes('[error]')
    })

    expect(pageErrors).toEqual([])
    expect(
      relevantConsole.filter((message) => message.includes('Slot "default" invoked outside')),
    ).toEqual([])
  })
})
