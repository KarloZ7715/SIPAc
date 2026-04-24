import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import { SignJWT } from 'jose'
import User from '../../server/models/User'
import Session from '../../server/models/Session'

const testRunId = `e2e-help-${Date.now()}`
const appPort = Number(process.env.PLAYWRIGHT_PORT ?? 4173)
const appBaseUrl = `http://127.0.0.1:${appPort}`
const userEmail = `help-${testRunId}@correo.unicordoba.edu.co`
const userPassword = 'HelpE2E123!'
const userFullName = 'Docente Help E2E'

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

function getJwtSecret() {
  const secret = readEnvValue('JWT_SECRET')

  if (!secret) {
    throw new Error('JWT_SECRET no está definido')
  }

  return new TextEncoder().encode(secret)
}

async function createSessionToken(userIdValue: string, email: string) {
  const jti = `help-${randomUUID()}`
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

test.describe('Centro de ayuda', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(60_000)

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

  test('muestra el hub y permite navegar a las tres guías', async ({ page }) => {
    if (!userId) {
      throw new Error('userId no está inicializado')
    }

    const token = await createSessionToken(userId, userEmail)
    await page.context().addCookies([{ name: 'sipac_session', value: token, url: appBaseUrl }])

    await page.goto('/help')
    await page.waitForLoadState('domcontentloaded')

    await expect(
      page.getByRole('heading', { name: /Centro de ayuda SIPAc|Aprende los flujos esenciales/i }),
    ).toBeVisible()

    const guides: Array<{ href: string; heading: string }> = [
      { href: '/help/upload', heading: 'Cómo subir y analizar documentos' },
      { href: '/help/repository', heading: 'Cómo organizar tu repositorio' },
      { href: '/help/assistant', heading: 'Cómo preguntarle al asistente IA' },
    ]

    for (const guide of guides) {
      await page.goto('/help')
      await page.waitForLoadState('domcontentloaded')

      const link = page.locator(`a[href="${guide.href}"]`).first()
      await expect(link).toBeVisible()
      await link.click()

      await expect(page).toHaveURL(new RegExp(`${guide.href}$`))
      await expect(page.getByRole('heading', { level: 1, name: guide.heading })).toBeVisible()
    }

    const firstFaqButton = page
      .getByRole('button', {
        name: '¿Qué tipos de archivo puedo subir?',
      })
      .filter({ visible: true })
      .first()
    const firstFaqPanel = page.locator('#faq-panel-0').filter({ visible: true }).first()
    await page.goto('/help')
    await page.waitForLoadState('domcontentloaded')
    await expect(firstFaqButton).toBeVisible()
    await firstFaqButton.scrollIntoViewIfNeeded()

    for (let attempt = 0; attempt < 4; attempt += 1) {
      if ((await firstFaqButton.getAttribute('aria-expanded')) === 'true') {
        break
      }
      await firstFaqButton.click({ force: true })
      await page.waitForTimeout(180)
    }

    await expect(firstFaqButton).toHaveAttribute('aria-expanded', 'true')
    await expect(firstFaqPanel).toBeVisible()
  })
})
