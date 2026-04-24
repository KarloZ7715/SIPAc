import { expect, test, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import { SignJWT } from 'jose'
import Session from '../../../server/models/Session'
import User from '../../../server/models/User'

type ResponsiveViewport = {
  label: string
  width: number
  height: number
}

const testRunId = `e2e-responsive-${Date.now()}`
const appPort = Number(process.env.PLAYWRIGHT_PORT ?? 4173)
const appBaseUrl = `http://127.0.0.1:${appPort}`
const userEmail = `responsive-${testRunId}@correo.unicordoba.edu.co`
const userPassword = 'ResponsiveE2E123!'
const userFullName = 'Docente Responsive E2E'
const viewports: ResponsiveViewport[] = [
  { label: 'mobile-320x568', width: 320, height: 568 },
  { label: 'mobile-375x812', width: 375, height: 812 },
  { label: 'tablet-768x1024', width: 768, height: 1024 },
  { label: 'desktop-1440x900', width: 1440, height: 900 },
]

let userId: string | null = null

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

const mongodbUri = readEnvValue('MONGODB_URI')
const jwtSecret = readEnvValue('JWT_SECRET')

async function connectMongo() {
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

function getJwtSecret() {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET no está definido')
  }

  return new TextEncoder().encode(jwtSecret)
}

async function createSessionToken(userIdValue: string, email: string) {
  const jti = `responsive-${randomUUID()}`
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000)

  await Session.create({
    userId: new mongoose.Types.ObjectId(userIdValue),
    jti,
    expiresAt,
    lastSeenAt: new Date(),
  })

  return new SignJWT({ role: 'docente', email, tokenVersion: 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userIdValue)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getJwtSecret())
}

async function loginWithSessionCookie(page: Page) {
  if (!userId) {
    throw new Error('userId no está inicializado')
  }

  const token = await createSessionToken(userId, userEmail)
  await page.context().addCookies([{ name: 'sipac_session', value: token, url: appBaseUrl }])
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const root = document.documentElement
        const body = document.body
        const rootOverflow = root.scrollWidth - root.clientWidth
        const bodyOverflow = body.scrollWidth - body.clientWidth
        return Math.max(rootOverflow, bodyOverflow)
      })
    })
    .toBeLessThanOrEqual(1)
}

async function runResponsiveMatrix(
  page: Page,
  route: string,
  assertVisible: (page: Page) => Promise<void>,
) {
  for (const viewport of viewports) {
    await test.step(`${route} · ${viewport.label}`, async () => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto(route)
      await page.waitForLoadState('domcontentloaded')
      await assertVisible(page)
      await expectNoHorizontalOverflow(page)
    })
  }
}

test.describe('Responsive breakpoints', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!mongodbUri || !jwtSecret, 'Requiere MONGODB_URI y JWT_SECRET para autenticación E2E')
  test.setTimeout(120_000)

  test.beforeAll(async () => {
    await connectMongo()
    await User.deleteMany({ email: userEmail })

    const user = await User.create({
      fullName: userFullName,
      email: userEmail,
      passwordHash: userPassword,
      program: 'Ingeniería de Sistemas',
      role: 'docente',
      emailVerifiedAt: new Date(),
    })

    userId = user._id.toString()
  })

  test.afterAll(async () => {
    await User.deleteMany({ email: userEmail })
    if (userId) {
      await Session.deleteMany({ userId: new mongoose.Types.ObjectId(userId) })
    }

    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect()
    }
  })

  test('login responde sin overflow horizontal en mobile/tablet/desktop', async ({ page }) => {
    await runResponsiveMatrix(page, '/login', async (currentPage) => {
      await expect(currentPage.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
    })
  })

  test.describe('áreas autenticadas', () => {
    test.beforeEach(async ({ page }) => {
      await loginWithSessionCookie(page)
    })

    test('home responde sin overflow horizontal', async ({ page }) => {
      await runResponsiveMatrix(page, '/', async (currentPage) => {
        await expect(
          currentPage.getByRole('heading', { name: 'Entra al espacio correcto.' }),
        ).toBeVisible()
      })
    })

    test('workspace-documents responde sin overflow horizontal', async ({ page }) => {
      await runResponsiveMatrix(page, '/workspace-documents', async (currentPage) => {
        await expect(
          currentPage.getByRole('heading', {
            name: /Sube un archivo para empezar|Buscamos si dejaste algo pendiente/i,
          }),
        ).toBeVisible()
      })
    })

    test('repository responde sin overflow horizontal', async ({ page }) => {
      await runResponsiveMatrix(page, '/repository', async (currentPage) => {
        await expect(
          currentPage.getByRole('heading', { name: /Catálogo del repositorio académico/i }),
        ).toBeVisible()
      })
    })

    test('chat responde sin overflow horizontal', async ({ page }) => {
      await runResponsiveMatrix(page, '/chat', async (currentPage) => {
        await expect(
          currentPage.getByRole('textbox', { name: 'Mensaje para el asistente' }),
        ).toBeVisible()
      })
    })

    test('profile responde sin overflow horizontal', async ({ page }) => {
      await runResponsiveMatrix(page, '/profile', async (currentPage) => {
        await expect(currentPage.getByRole('heading', { name: userFullName })).toBeVisible()
      })
    })

    test('sidebar móvil abre sin overflow en 320x568', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 })
      await page.goto('/dashboard')
      await page.waitForLoadState('domcontentloaded')
      const openSidebarButton = page.getByRole('button', { name: 'Abrir navegación principal' })
      await expect(openSidebarButton).toBeVisible()
      await openSidebarButton.click()
      await page.waitForTimeout(250)
      await expectNoHorizontalOverflow(page)
    })
  })
})
