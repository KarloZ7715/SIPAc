import { expect, test, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import { SignJWT } from 'jose'
import type { ProductType } from '../../app/types'
import User from '../../server/models/User'
import Session from '../../server/models/Session'
import UploadedFile from '../../server/models/UploadedFile'
import AcademicProduct from '../../server/models/AcademicProduct'
import { deleteFileFromGridFs, uploadBufferToGridFs } from '../../server/services/storage/gridfs'

const testRunId = `e2e-catalog-${Date.now()}`
let ownerEmail = ''
const ownerPassword = 'CatalogE2E123!'
const ownerFullName = 'Docente Catalogo E2E'
let peerEmail = ''
const peerPassword = 'CatalogE2E123!'
const peerFullName = 'Docente Par E2E'
const appBaseUrl = 'http://127.0.0.1:4173'
let seededRepositoryTitle = ''
let seededCatalogToken = ''
const ownerConfirmedProductsTotal = 8
const seededCatalogProductsTotal = 12
const seededDbCiOptIn = /^(1|true)$/i.test(process.env.PLAYWRIGHT_E2E_SEEDED_DB ?? '')
const shouldRunSeededCatalogE2E =
  Boolean(readEnvValue('MONGODB_URI')) && (process.env.CI !== 'true' || seededDbCiOptIn)

let ownerUserId: string | null = null
let peerUserId: string | null = null
const seededGridFsFileIds: string[] = []
const minimalPdfBuffer = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
  'utf8',
)

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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

async function createSessionToken(userId: string, email: string) {
  const jti = `catalog-${randomUUID()}`
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000)

  await Session.create({
    userId: new mongoose.Types.ObjectId(userId),
    jti,
    expiresAt,
    lastSeenAt: new Date(),
  })

  return new SignJWT({ role: 'docente', email, tokenVersion: 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getJwtSecret())
}

async function loginWithSessionCookie(page: Page, email: string, userId: string) {
  const token = await createSessionToken(userId, email)
  await page.context().addCookies([{ name: 'sipac_session', value: token, url: appBaseUrl }])
}

async function seedConfirmedProduct(input: {
  ownerId: string
  productType: ProductType
  title: string
  authors: string[]
  institution: string
  year: number
  keywords: string[]
}) {
  const gridfsFileId = await uploadBufferToGridFs({
    buffer: minimalPdfBuffer,
    filename: `${input.title.replace(/\s+/g, '-').toLowerCase()}.pdf`,
    contentType: 'application/pdf',
    metadata: {
      seededBy: 'playwright-e2e',
      testRunId: seededCatalogToken || testRunId,
    },
  })
  seededGridFsFileIds.push(gridfsFileId.toString())

  const uploadedFile = await UploadedFile.create({
    uploadedBy: new mongoose.Types.ObjectId(input.ownerId),
    originalFilename: `${input.title.replace(/\s+/g, '-').toLowerCase()}.pdf`,
    gridfsFileId,
    mimeType: 'application/pdf',
    fileSizeBytes: 3100,
    processingStatus: 'completed',
    rawExtractedText: `${input.title}. ${input.authors.join(', ')}. ${input.institution}.`,
    ocrProvider: 'pdfjs_native',
    ocrModel: 'pdfjs_native',
    ocrConfidence: 0.95,
    nerProvider: 'cerebras',
    nerModel: 'qwen-3-235b-a22b-instruct-2507',
    documentClassification: 'academic',
    documentClassificationSource: 'heuristic',
    classificationConfidence: 0.9,
    sourceWorkCount: 1,
  })

  const date = new Date(Date.UTC(input.year, 5, 15))

  await AcademicProduct.create({
    productType: input.productType,
    owner: new mongoose.Types.ObjectId(input.ownerId),
    sourceFile: uploadedFile._id,
    segmentIndex: 0,
    reviewStatus: 'confirmed',
    reviewConfirmedAt: new Date(),
    extractedEntities: {
      authors: input.authors.map((author) => ({ value: author, confidence: 0.9, anchors: [] })),
      title: { value: input.title, confidence: 0.95, anchors: [] },
      institution: { value: input.institution, confidence: 0.94, anchors: [] },
      date: { value: date, confidence: 0.9, anchors: [] },
      keywords: input.keywords.map((keyword) => ({
        value: keyword,
        confidence: 0.88,
        anchors: [],
      })),
      extractionSource: 'pdfjs_native',
      extractionConfidence: 0.93,
      extractedAt: new Date(),
    },
    manualMetadata: {
      title: input.title,
      authors: input.authors,
      institution: input.institution,
      date,
      keywords: input.keywords,
      notes: `Seed E2E ${testRunId}`,
    },
    ...(input.productType === 'thesis'
      ? { thesisLevel: 'maestria', program: 'Ingeniería de Sistemas' }
      : {}),
    ...(input.productType === 'conference_paper'
      ? {
          eventName: `Congreso QA ${input.year}`,
          eventDate: date,
          presentationType: 'oral',
          proceedingsTitle: input.title,
        }
      : {}),
  })
}

test.describe('Dashboard, repository y perfil — auditoría E2E', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(180_000)
  test.skip(
    !shouldRunSeededCatalogE2E,
    'Requiere MONGODB_URI. En CI se ejecuta solo con PLAYWRIGHT_E2E_SEEDED_DB=1.',
  )

  test.beforeAll(async () => {
    const runScopedId = `seed${Date.now()}${randomUUID().replace(/-/g, '').slice(0, 12)}`
    seededCatalogToken = runScopedId
    ownerEmail = `catalog-owner-${runScopedId}@correo.unicordoba.edu.co`
    peerEmail = `catalog-peer-${runScopedId}@correo.unicordoba.edu.co`
    seededRepositoryTitle = `Tesis IA QA ${runScopedId}`

    await connectMongo()
    await User.deleteMany({ email: { $in: [ownerEmail, peerEmail] } })

    const owner = await User.create({
      fullName: ownerFullName,
      email: ownerEmail,
      passwordHash: ownerPassword,
      program: 'Ingeniería de Sistemas',
      role: 'docente',
      googleId: `e2e-google-owner-${seededCatalogToken}`,
    })
    ownerUserId = owner._id.toString()

    const peer = await User.create({
      fullName: peerFullName,
      email: peerEmail,
      passwordHash: peerPassword,
      program: 'Ingeniería de Sistemas',
      role: 'docente',
      googleId: `e2e-google-peer-${seededCatalogToken}`,
    })
    peerUserId = peer._id.toString()

    const ownerProducts: Array<{
      productType: ProductType
      title: string
      authors: string[]
      institution: string
      year: number
      keywords: string[]
    }> = [
      {
        productType: 'thesis',
        title: seededRepositoryTitle,
        authors: ['Ana QA'],
        institution: 'Universidad de Córdoba',
        year: 2025,
        keywords: ['inteligencia artificial', 'qa'],
      },
      {
        productType: 'conference_paper',
        title: `Ponencia QA ${seededCatalogToken}`,
        authors: ['Bruno QA'],
        institution: 'Universidad de Córdoba',
        year: 2025,
        keywords: ['analítica', 'calidad'],
      },
      {
        productType: 'article',
        title: `Artículo QA 1 ${seededCatalogToken}`,
        authors: ['Carla QA'],
        institution: 'Universidad de Córdoba',
        year: 2024,
        keywords: ['datos', 'docencia'],
      },
      {
        productType: 'article',
        title: `Artículo QA 2 ${seededCatalogToken}`,
        authors: ['Diego QA'],
        institution: 'Universidad de Córdoba',
        year: 2024,
        keywords: ['repositorio', 'acreditación'],
      },
      {
        productType: 'thesis',
        title: `Tesis QA 2 ${seededCatalogToken}`,
        authors: ['Elena QA'],
        institution: 'Universidad de Córdoba',
        year: 2025,
        keywords: ['educación', 'ia'],
      },
      {
        productType: 'conference_paper',
        title: `Ponencia QA 2 ${seededCatalogToken}`,
        authors: ['Felipe QA'],
        institution: 'Universidad de Córdoba',
        year: 2026,
        keywords: ['evaluación', 'pipeline'],
      },
      {
        productType: 'article',
        title: `Artículo QA 3 ${seededCatalogToken}`,
        authors: ['Gloria QA'],
        institution: 'Universidad de Córdoba',
        year: 2026,
        keywords: ['ocr', 'ner'],
      },
      {
        productType: 'thesis',
        title: `Tesis QA 3 ${seededCatalogToken}`,
        authors: ['Héctor QA'],
        institution: 'Universidad de Córdoba',
        year: 2026,
        keywords: ['metadatos', 'calidad'],
      },
    ]

    for (const product of ownerProducts) {
      await seedConfirmedProduct({
        ownerId: ownerUserId,
        ...product,
      })
    }

    const peerProducts: Array<{
      productType: ProductType
      title: string
      authors: string[]
      institution: string
      year: number
      keywords: string[]
    }> = [
      {
        productType: 'article',
        title: `Artículo par 1 ${seededCatalogToken}`,
        authors: ['Iván QA'],
        institution: 'Universidad del Valle',
        year: 2025,
        keywords: ['peer', 'repository'],
      },
      {
        productType: 'conference_paper',
        title: `Ponencia par 1 ${seededCatalogToken}`,
        authors: ['Julia QA'],
        institution: 'Universidad del Valle',
        year: 2024,
        keywords: ['peer', 'dashboard'],
      },
      {
        productType: 'thesis',
        title: `Tesis par 1 ${seededCatalogToken}`,
        authors: ['Kevin QA'],
        institution: 'Universidad del Valle',
        year: 2026,
        keywords: ['peer', 'insights'],
      },
      {
        productType: 'article',
        title: `Artículo par 2 ${seededCatalogToken}`,
        authors: ['Laura QA'],
        institution: 'Universidad del Valle',
        year: 2025,
        keywords: ['peer', 'preview'],
      },
    ]

    for (const product of peerProducts) {
      await seedConfirmedProduct({
        ownerId: peerUserId,
        ...product,
      })
    }
  })

  test.afterAll(async () => {
    const seededUsers = await User.find({ email: { $in: [ownerEmail, peerEmail] } })
      .select('_id')
      .lean()
    const seededUserIds = seededUsers.map((user) => user._id)

    if (seededUserIds.length > 0) {
      await AcademicProduct.deleteMany({ owner: { $in: seededUserIds } })
      await UploadedFile.deleteMany({ uploadedBy: { $in: seededUserIds } })
      await Session.deleteMany({ userId: { $in: seededUserIds } })
      await User.deleteMany({ _id: { $in: seededUserIds } })
    }

    if (seededGridFsFileIds.length > 0) {
      await Promise.allSettled(seededGridFsFileIds.map((id) => deleteFileFromGridFs(id)))
    }

    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect()
    }
  })

  test('dashboard carga métricas, charts y filtros sin errores de red/console', async ({
    page,
  }) => {
    if (!ownerUserId) {
      throw new Error('ownerUserId no está inicializado')
    }

    const consoleProblems: string[] = []
    const dashboardFailures: string[] = []
    const pageErrors: string[] = []

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleProblems.push(`[${message.type()}] ${message.text()}`)
      }
    })
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })
    page.on('response', async (response) => {
      if (!response.url().includes('/api/dashboard') || response.status() < 400) {
        return
      }

      let payload = ''
      try {
        payload = await response.text()
      } catch {
        payload = ''
      }
      dashboardFailures.push(`${response.status()} ${response.url()} ${payload}`)
    })

    await loginWithSessionCookie(page, ownerEmail, ownerUserId)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Distribución por tipo')).toBeVisible()
    await expect(page.getByText('Evolución histórica')).toBeVisible()
    await expect(page.getByText('Insights proactivos')).toBeVisible()
    await expect(page.getByText('Confirmados en repositorio')).toBeVisible()

    const cardsTotal = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.interactive-card'))
      const card = cards.find((item) => item.textContent?.includes('Confirmados en repositorio'))
      if (!card) {
        return null
      }

      const value = card.querySelector('.font-display')?.textContent?.trim() ?? ''
      const parsed = Number(value.replace(/[^\d]/g, ''))
      return Number.isFinite(parsed) ? parsed : null
    })
    expect(cardsTotal).toBe(ownerConfirmedProductsTotal)

    const dateInputs = page.locator('input[type="date"]')
    await dateInputs.nth(0).fill('2025-01-01')
    await dateInputs.nth(1).fill('2025-12-31')
    await expect(page.getByRole('button', { name: 'Desde: 2025-01-01' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hasta: 2025-12-31' })).toBeVisible()

    await page.getByRole('button', { name: 'Limpiar filtros' }).click()
    await expect(page.getByRole('button', { name: 'Desde: 2025-01-01' })).toHaveCount(0)

    const actionableConsoleProblems = consoleProblems.filter(
      (entry) => !entry.includes('Hydration completed but contains mismatches.'),
    )

    expect(pageErrors).toEqual([])
    expect(actionableConsoleProblems).toEqual([])
    expect(dashboardFailures).toEqual([])
  })

  test('repository cubre búsqueda, filtros, paginación y preview', async ({ page }) => {
    if (!ownerUserId) {
      throw new Error('ownerUserId no está inicializado')
    }

    const consoleProblems: string[] = []
    const repositoryFailures: string[] = []
    const pageErrors: string[] = []

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleProblems.push(`[${message.type()}] ${message.text()}`)
      }
    })
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })
    page.on('response', async (response) => {
      if (!response.url().includes('/api/products') || response.status() < 400) {
        return
      }

      let payload = ''
      try {
        payload = await response.text()
      } catch {
        payload = ''
      }
      repositoryFailures.push(`${response.status()} ${response.url()} ${payload}`)
    })

    await loginWithSessionCookie(page, ownerEmail, ownerUserId)
    await page.goto('/repository')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Catálogo del repositorio académico')).toBeVisible()

    await page.getByRole('textbox', { name: 'Búsqueda en el catálogo' }).fill(seededRepositoryTitle)
    await page.getByRole('button', { name: 'Buscar' }).click()
    const repositoryTitleButton = page.getByRole('button', {
      name: new RegExp(`^${escapeRegExp(seededRepositoryTitle)}(?:\\s|$)`),
    })
    await expect(repositoryTitleButton).toBeVisible()

    await repositoryTitleButton.click()
    await expect(page.getByText('Vista previa en el catálogo')).toBeVisible()
    await expect(page.getByTitle('Vista previa del documento')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText('Vista previa en el catálogo')).toHaveCount(0)

    await page.getByRole('textbox', { name: 'Búsqueda en el catálogo' }).fill(seededCatalogToken)
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(
      page.getByText(new RegExp(`de\\s+${seededCatalogProductsTotal}\\s+resultados`)),
    ).toBeVisible()

    await page.getByRole('switch', { name: 'Mostrar únicamente tus productos' }).click()
    await expect(
      page.getByText(new RegExp(`de\\s+${ownerConfirmedProductsTotal}\\s+resultados`)),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Limpiar filtros' }).click()
    await page.waitForLoadState('networkidle')
    await page.getByRole('textbox', { name: 'Búsqueda en el catálogo' }).fill(seededCatalogToken)
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(page.getByText(/página 1 de \d+/i)).toBeVisible()

    await page.goto(`/repository?search=${encodeURIComponent(seededCatalogToken)}&page=2`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/página 2 de \d+/i)).toBeVisible()

    expect(pageErrors).toEqual([])
    expect(consoleProblems).toEqual([])
    expect(repositoryFailures).toEqual([])
  })

  test('perfil persiste preferencias de movimiento y densidad', async ({ page }) => {
    if (!ownerUserId) {
      throw new Error('ownerUserId no está inicializado')
    }

    const pageErrors: string[] = []
    const consoleProblems: string[] = []

    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleProblems.push(`[${message.type()}] ${message.text()}`)
      }
    })

    await loginWithSessionCookie(page, ownerEmail, ownerUserId)
    await page.goto('/profile?tab=preferences')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Ajusta SIPAc a tu ritmo')).toBeVisible()

    const motionCombobox = page.getByRole('combobox', { name: 'Movimiento' })
    await motionCombobox.click()
    await page.getByRole('option', { name: 'Mínimo' }).click()

    const densityCombobox = page.getByRole('combobox', { name: 'Densidad' })
    await densityCombobox.click()
    await page.getByRole('option', { name: 'Compacta' }).click()

    await page.reload()
    await page.waitForLoadState('networkidle')

    const preferences = await page.evaluate(() => ({
      htmlMotion: document.documentElement.dataset.motion ?? null,
      htmlDensity: document.documentElement.dataset.density ?? null,
      bodyMotion: document.body.dataset.motion ?? null,
      bodyDensity: document.body.dataset.density ?? null,
      motionStorage: localStorage.getItem('sipac:ui:motion-preference'),
      densityStorage: localStorage.getItem('sipac:ui:density-preference'),
    }))

    expect(preferences).toEqual({
      htmlMotion: 'minimal',
      htmlDensity: 'compact',
      bodyMotion: 'minimal',
      bodyDensity: 'compact',
      motionStorage: 'minimal',
      densityStorage: 'compact',
    })
    expect(pageErrors).toEqual([])
    expect(consoleProblems).toEqual([])
  })
})
