import { expect, test, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import mongoose from 'mongoose'
import { SignJWT } from 'jose'
import Session from '../../../server/models/Session'
import User from '../../../server/models/User'

type EvidenceViewport = {
  key: 'desktop' | 'mobile' | 'mobile-small'
  width: number
  height: number
}

type EvidencePage = {
  key: string
  route: string
  requiresAuth: boolean
}

const testRunId = `e2e-evidence-${Date.now()}`
const appPort = Number(process.env.PLAYWRIGHT_PORT ?? 4173)
const appBaseUrl = `http://127.0.0.1:${appPort}`
const userEmail = `evidence-${testRunId}@correo.unicordoba.edu.co`
const userPassword = 'EvidenceE2E123!'
const userFullName = 'Docente Evidencia E2E'
const evidenceFolder = resolve(process.cwd(), 'docs/evidencias/capturas/2026-04-23_responsive-uiux')

const viewports: EvidenceViewport[] = [
  { key: 'desktop', width: 1440, height: 900 },
  { key: 'mobile', width: 375, height: 812 },
  { key: 'mobile-small', width: 320, height: 568 },
]

const pagesToCapture: EvidencePage[] = [
  { key: 'login', route: '/login', requiresAuth: false },
  { key: 'register', route: '/register', requiresAuth: false },
  { key: 'home', route: '/', requiresAuth: true },
  { key: 'dashboard', route: '/dashboard', requiresAuth: true },
  { key: 'workspace-documents', route: '/workspace-documents', requiresAuth: true },
  { key: 'chat', route: '/chat', requiresAuth: true },
  { key: 'repository', route: '/repository', requiresAuth: true },
  { key: 'profile', route: '/profile', requiresAuth: true },
  { key: 'help-assistant', route: '/help/assistant', requiresAuth: true },
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
  const jti = `evidence-${randomUUID()}`
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

test.describe('Evidence screenshots (responsive)', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!mongodbUri || !jwtSecret, 'Requiere MONGODB_URI y JWT_SECRET para autenticación E2E')
  test.setTimeout(180_000)

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

  test('captura páginas clave en desktop, movil y movil pequeno', async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      for (const targetPage of pagesToCapture) {
        await test.step(`${viewport.key} · ${targetPage.key}`, async () => {
          await page.context().clearCookies()

          if (targetPage.requiresAuth) {
            await loginWithSessionCookie(page)
          }

          await page.goto(targetPage.route, { waitUntil: 'domcontentloaded' })
          await page.waitForTimeout(1200)

          const screenshotPath = resolve(
            evidenceFolder,
            viewport.key,
            `${targetPage.key}-${viewport.width}x${viewport.height}.png`,
          )
          mkdirSync(dirname(screenshotPath), { recursive: true })
          await page.screenshot({
            path: screenshotPath,
            fullPage: true,
          })

          expect(existsSync(screenshotPath)).toBe(true)

          if (
            viewport.key !== 'desktop' &&
            targetPage.requiresAuth &&
            targetPage.key === 'dashboard'
          ) {
            const openSidebarButton = page.getByRole('button', {
              name: 'Abrir navegación principal',
            })

            if (await openSidebarButton.isVisible()) {
              await openSidebarButton.click()
              await page.waitForTimeout(250)

              const sidebarScreenshotPath = resolve(
                evidenceFolder,
                viewport.key,
                `${targetPage.key}-sidebar-open-${viewport.width}x${viewport.height}.png`,
              )

              await page.screenshot({
                path: sidebarScreenshotPath,
                fullPage: true,
              })

              expect(existsSync(sidebarScreenshotPath)).toBe(true)
            }
          }
        })
      }
    }
  })
})
