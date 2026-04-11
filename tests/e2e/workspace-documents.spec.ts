import { expect, test, type Page } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import User from '../../server/models/User'

/** PNG 1×1 válido (aceptado por el workspace como imagen). */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const testRunId = `e2e-ws-${Date.now()}`
const workspaceEmail = `workspace-${testRunId}@correo.unicordoba.edu.co`
const workspacePassword = 'WorkspaceE2E123!'
const workspaceFullName = 'Docente Workspace E2E'

const mongodbUri = readEnvValue('MONGODB_URI')
const workspaceE2eCiOptIn = /^(1|true)$/i.test(process.env.PLAYWRIGHT_E2E_WORKSPACE ?? '')
const shouldRunWorkspaceE2E =
  Boolean(mongodbUri) && (process.env.CI !== 'true' || workspaceE2eCiOptIn)

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

/** El layout duplica la página (móvil vs escritorio); solo una rama es visible. */
function visibleTestId(page: Page, testId: string) {
  return page.getByTestId(testId).filter({ visible: true })
}

async function loginAndOpenWorkspace(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  await page.locator('input[name="email"]').fill(workspaceEmail)
  await page.locator('input[name="password"]').fill(workspacePassword)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()

  await page.waitForURL((url) => !/^\/login\/?$/.test(url.pathname), {
    timeout: 15_000,
  })

  await page.goto('/workspace-documents')
  await page.waitForLoadState('networkidle')
}

async function attachTinyImage(page: Page) {
  const aside = visibleTestId(page, 'workspace-upload-aside')
  const fileInput = aside.locator('input[type="file"]').first()
  await fileInput.setInputFiles({
    name: 'e2e-tiny.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  })
  await expect(
    visibleTestId(page, 'workspace-draft-card').getByTestId('workspace-action-start-review'),
  ).toBeVisible({
    timeout: 15_000,
  })
}

test.describe('Workspace documentos — acciones unificadas', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(120_000)

  test.skip(
    !shouldRunWorkspaceE2E,
    'Requiere MONGODB_URI. En CI, definir PLAYWRIGHT_E2E_WORKSPACE=1 además de MONGODB_URI.',
  )

  test.beforeAll(async () => {
    await connectMongo()
    await User.deleteMany({ email: workspaceEmail })
    await User.create({
      fullName: workspaceFullName,
      email: workspaceEmail,
      passwordHash: workspacePassword,
      program: 'Ingeniería de Sistemas',
      role: 'docente',
    })
  })

  test.afterAll(async () => {
    await User.deleteMany({ email: workspaceEmail })
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect()
    }
  })

  test('sin borrador no hay botones de acción del flujo (chrome oculto)', async ({ page }) => {
    await loginAndOpenWorkspace(page)

    await expect(
      page.getByTestId('workspace-action-start-review').filter({ visible: true }),
    ).toHaveCount(0)
    await expect(
      page
        .getByRole('region', { name: 'Estado del documento y acciones rápidas' })
        .filter({ visible: true }),
    ).toBeHidden()
  })

  test('con archivo local en borrador, chrome y aside muestran la misma fila de acciones (testid)', async ({
    page,
  }) => {
    await loginAndOpenWorkspace(page)
    await attachTinyImage(page)

    const startButtons = page.getByTestId('workspace-action-start-review').filter({ visible: true })
    await expect(startButtons).toHaveCount(2)

    const chrome = page
      .getByRole('region', { name: 'Estado del documento y acciones rápidas' })
      .filter({ visible: true })
    const draftCard = visibleTestId(page, 'workspace-draft-card')

    await expect(chrome.getByTestId('workspace-action-start-review')).toHaveCount(1)
    await expect(draftCard.getByTestId('workspace-action-start-review')).toHaveCount(1)

    await expect(chrome.getByTestId('workspace-action-remove-file')).toHaveCount(1)
    await expect(draftCard.getByTestId('workspace-action-remove-file')).toHaveCount(1)
  })

  test('vista previa (imagen en borrador): la imagen arranca cerca del borde superior del shell', async ({
    page,
  }) => {
    await loginAndOpenWorkspace(page)
    await attachTinyImage(page)

    const shell = page.getByTestId('document-preview-shell').filter({ visible: true })
    await expect(shell).toBeVisible({ timeout: 15_000 })

    const gapPx = await shell.evaluate((el) => {
      const shellRect = el.getBoundingClientRect()
      const img = el.querySelector('img.image-preview') as HTMLImageElement | null
      if (!img || img.clientHeight < 2) {
        return -1
      }
      return Math.round(img.getBoundingClientRect().top - shellRect.top)
    })

    expect(gapPx).toBeGreaterThanOrEqual(0)
    // Borde del shell (~1px) y sin padding-top acumulado con el panel
    expect(gapPx).toBeLessThanOrEqual(6)
  })

  test('Quitar archivo desde la barra superior limpia el borrador (acciones coherentes)', async ({
    page,
  }) => {
    await loginAndOpenWorkspace(page)
    await attachTinyImage(page)

    const chrome = page
      .getByRole('region', { name: 'Estado del documento y acciones rápidas' })
      .filter({ visible: true })
    await chrome.getByTestId('workspace-action-remove-file').click()

    await expect(
      page.getByTestId('workspace-action-start-review').filter({ visible: true }),
    ).toHaveCount(0)
    await expect(
      page
        .getByRole('region', { name: 'Estado del documento y acciones rápidas' })
        .filter({ visible: true }),
    ).toBeHidden()
  })
})
