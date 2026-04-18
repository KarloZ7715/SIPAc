import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import User from '../../server/models/User'

const testRunId = `e2e-help-${Date.now()}`
const appPort = Number(process.env.PLAYWRIGHT_PORT ?? 4173)
const appBaseUrl = `http://127.0.0.1:${appPort}`
const userEmail = `help-${testRunId}@correo.unicordoba.edu.co`
const userPassword = 'HelpE2E123!'
const userFullName = 'Docente Help E2E'

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

test.describe('Centro de ayuda', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(60_000)

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

  test('muestra el hub y permite navegar a las tres guías', async ({ page }) => {
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

    await page.goto('/help')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('heading', { name: 'Centro de ayuda SIPAc' })).toBeVisible()

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

    const firstFaqButton = page.getByRole('button', {
      name: '¿Qué tipos de archivo puedo subir?',
    })
    await page.goto('/help')
    await page.waitForLoadState('domcontentloaded')
    await expect(firstFaqButton).toBeVisible()
    await firstFaqButton.click()
    await expect(firstFaqButton).toHaveAttribute('aria-expanded', 'true')
  })
})
