import { expect, test, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import { SignJWT } from 'jose'
import User from '../../server/models/User'
import Session from '../../server/models/Session'
import UploadedFile from '../../server/models/UploadedFile'
import AcademicProduct from '../../server/models/AcademicProduct'
import ChatConversation from '../../server/models/ChatConversation'

const testRunId = `e2e-chat-${Date.now()}`
const ownerEmail = `owner-${testRunId}@correo.unicordoba.edu.co`
const ownerPassword = 'Docente12345!'
const ownerFullName = 'Docente Propietario E2E Chat'
const docenteEmail = `query-${testRunId}@correo.unicordoba.edu.co`
const docentePassword = 'Docente12345!'
const docenteFullName = 'Docente Consultante E2E Chat'
const seededTitle = `Memorias E2E ${testRunId}`
const seededConversationId = `seeded-${testRunId}`
const seededConversationTitle = `Historial E2E ${testRunId}`
const seededDbCiOptIn = /^(1|true)$/i.test(process.env.PLAYWRIGHT_E2E_SEEDED_DB ?? '')
const shouldRunSeededChatE2E = process.env.CI !== 'true' || seededDbCiOptIn
const appBaseUrl = 'http://127.0.0.1:4173'

let docenteUserId: string | null = null

function readEnvValue(name: string) {
  const directValue = process.env[name]
  if (typeof directValue === 'string' && directValue.trim().length > 0) {
    return directValue.trim()
  }

  const envFile = readFileSync('.env', 'utf8')
  const line = envFile.split(/\r?\n/).find((candidate) => candidate.startsWith(`${name}=`))

  return line ? line.slice(name.length + 1).trim() : ''
}

async function connectMongo() {
  const mongodbUri = readEnvValue('MONGODB_URI')

  if (!mongodbUri) {
    throw new Error(
      'El E2E de chat requiere MONGODB_URI para sembrar datos del repositorio confirmado',
    )
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
  const jti = `chat-${randomUUID()}`
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

async function openChatAsDocente(page: Page) {
  if (!docenteUserId) {
    throw new Error('docenteUserId no está inicializado')
  }

  await loginWithSessionCookie(page, docenteEmail, docenteUserId)
}

test.describe('Chat IA docente', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(120_000)
  test.skip(
    !shouldRunSeededChatE2E,
    'Este E2E siembra MongoDB para el repositorio confirmado. En CI se ejecuta solo con PLAYWRIGHT_E2E_SEEDED_DB=1',
  )

  test.beforeAll(async () => {
    await connectMongo()

    await User.deleteMany({ email: { $in: [ownerEmail, docenteEmail] } })

    const ownerUser = await User.create({
      fullName: ownerFullName,
      email: ownerEmail,
      passwordHash: ownerPassword,
      program: 'Ingeniería de Sistemas',
      role: 'docente',
      emailVerifiedAt: new Date(),
    })

    const docenteUser = await User.create({
      fullName: docenteFullName,
      email: docenteEmail,
      passwordHash: docentePassword,
      program: 'Ingeniería de Sistemas',
      role: 'docente',
      emailVerifiedAt: new Date(),
    })
    docenteUserId = docenteUser._id.toString()

    const uploadedFile = await UploadedFile.create({
      uploadedBy: ownerUser._id,
      originalFilename: `${testRunId}.pdf`,
      gridfsFileId: new mongoose.Types.ObjectId(),
      mimeType: 'application/pdf',
      fileSizeBytes: 2048,
      processingStatus: 'completed',
      rawExtractedText:
        'Universidad de Córdoba. Tecnologías Emergentes en Educación. Inteligencia artificial educativa aplicada a procesos docentes.',
      ocrProvider: 'pdfjs_native',
      ocrModel: 'pdfjs_native',
      ocrConfidence: 0.94,
      nerProvider: 'cerebras',
      nerModel: 'qwen-3-235b-a22b-instruct-2507',
      documentClassification: 'academic',
      documentClassificationSource: 'heuristic',
      classificationConfidence: 0.91,
      sourceWorkCount: 1,
    })

    await AcademicProduct.create({
      productType: 'conference_paper',
      owner: ownerUser._id,
      sourceFile: uploadedFile._id,
      segmentIndex: 0,
      reviewStatus: 'confirmed',
      reviewConfirmedAt: new Date(),
      extractedEntities: {
        authors: [{ value: 'Carlos Canabal', confidence: 0.93, anchors: [] }],
        title: { value: seededTitle, confidence: 0.95, anchors: [] },
        institution: { value: 'Universidad de Córdoba', confidence: 0.96, anchors: [] },
        date: { value: new Date('2025-09-18T00:00:00.000Z'), confidence: 0.92, anchors: [] },
        keywords: [
          { value: 'inteligencia artificial educativa', confidence: 0.9, anchors: [] },
          { value: 'tecnologías emergentes', confidence: 0.88, anchors: [] },
        ],
        extractionSource: 'pdfjs_native',
        extractionConfidence: 0.94,
        extractedAt: new Date(),
      },
      manualMetadata: {
        title: seededTitle,
        authors: ['Carlos Canabal'],
        institution: 'Universidad de Córdoba',
        date: new Date('2025-09-18T00:00:00.000Z'),
        keywords: ['inteligencia artificial educativa', 'tecnologías emergentes'],
      },
      eventName: 'Congreso Internacional de Tecnologías Emergentes en Educación',
      eventSponsor: 'Universidad de Córdoba',
      proceedingsTitle: seededTitle,
      publisher: 'Universidad de Córdoba',
      areaOfKnowledge: 'Educación y Tecnologías Emergentes',
      presentationType: 'oral',
      eventDate: new Date('2025-09-18T00:00:00.000Z'),
    })

    await ChatConversation.create({
      chatId: seededConversationId,
      userId: docenteUser._id,
      title: seededConversationTitle,
      messages: [
        {
          id: `msg-user-${testRunId}`,
          role: 'user',
          parts: [{ type: 'text', text: '¿Qué productos tengo confirmados?' }],
          metadata: { createdAt: Date.now() - 60_000 },
        },
        {
          id: `msg-assistant-${testRunId}`,
          role: 'assistant',
          parts: [{ type: 'text', text: 'Tienes productos confirmados en el repositorio.' }],
          metadata: { createdAt: Date.now() - 45_000 },
        },
      ],
      isActive: true,
      lastAccessedAt: new Date(),
    })
  })

  test.afterAll(async () => {
    const seededUsers = await User.find({ email: { $in: [ownerEmail, docenteEmail] } })
      .select('_id email')
      .lean()

    const ownerUser = seededUsers.find((user) => user.email === ownerEmail)
    const queryingUser = seededUsers.find((user) => user.email === docenteEmail)

    if (ownerUser?._id) {
      await AcademicProduct.deleteMany({ owner: ownerUser._id })
      await UploadedFile.deleteMany({ uploadedBy: ownerUser._id })
    }

    if (queryingUser?._id) {
      await ChatConversation.deleteMany({ userId: queryingUser._id })
    }

    if (seededUsers.length > 0) {
      await Session.deleteMany({ userId: { $in: seededUsers.map((user) => user._id) } })
      await User.deleteMany({ _id: { $in: seededUsers.map((user) => user._id) } })
    }

    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect()
    }
  })

  test('un docente consulta desde el chat el repositorio compartido y valida la evidencia grounded', async ({
    page,
  }) => {
    const browserConsole: string[] = []
    const pageErrors: string[] = []
    const chatRequests: string[] = []
    const chatResponses: string[] = []

    page.on('console', (message) => {
      browserConsole.push(`[${message.type()}] ${message.text()}`)
    })

    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })

    page.on('request', (request) => {
      if (request.url().includes('/api/chat')) {
        chatRequests.push(`${request.method()} ${request.url()}`)
      }
    })

    page.on('response', async (response) => {
      if (!response.url().includes('/api/chat')) {
        return
      }

      let payloadHint = ''
      if (response.status() >= 400) {
        try {
          payloadHint = ` :: ${await response.text()}`
        } catch {
          payloadHint = ''
        }
      }

      chatResponses.push(`${response.status()} ${response.url()}${payloadHint}`)
    })

    await openChatAsDocente(page)

    await page.goto('/chat')
    await expect(page).toHaveURL(/\/chat(?:\?.*)?$/)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: '¿Qué investigaremos hoy?' })).toBeVisible()
    await expect(page.getByRole('combobox')).toBeVisible()

    const modelSelector = page.getByRole('combobox')
    await modelSelector.click()

    const preferredOptions = [
      page.getByText('Qwen 3 235B Instruct'),
      page.getByText('GLM 4.7'),
      page.getByText('GPT-OSS 120B'),
      page.getByText('GPT-OSS 20B'),
      page.getByText('MiniMax M2.5 (gratis)'),
      page.getByText('Gemini 2.5 Flash'),
    ]

    let selectedOption = false
    for (const option of preferredOptions) {
      if (await option.isVisible().catch(() => false)) {
        await option.click()
        selectedOption = true
        break
      }
    }

    if (!selectedOption) {
      // En CI el catálogo manual puede variar por proveedor/env; continuar con el modelo activo por defecto.
      await page.keyboard.press('Escape').catch(() => {})
    }

    const chatTextarea = page.getByRole('textbox', { name: 'Mensaje para el asistente' })
    await chatTextarea.fill('¿Qué tesis confirmadas están asociadas a la Universidad de Córdoba?')
    await expect(chatTextarea).toHaveValue(
      '¿Qué tesis confirmadas están asociadas a la Universidad de Córdoba?',
    )

    const submitButton = page
      .getByRole('button', { name: 'Consultar' })
      .filter({ visible: true })
      .first()
    await expect(submitButton).toBeEnabled({ timeout: 10_000 })

    const chat200ResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/chat') && response.status() === 200,
      { timeout: 90_000 },
    )

    await submitButton.click()

    let chat200Response = false
    try {
      await chat200ResponsePromise
      chat200Response = true
    } catch {
      chat200Response = false
    }

    expect(
      chatRequests.length,
      `No se detectó ningún request /api/chat.

Console:
${browserConsole.join('\n') || '(sin logs)'}

Page errors:
${pageErrors.join('\n') || '(sin errores)'}
`,
    ).toBeGreaterThan(0)
    expect(
      chat200Response || chatResponses.some((response) => response.startsWith('200 ')),
      `El chat no devolvió un 200.

Responses:
${chatResponses.join('\n') || '(sin responses)'}

Console:
${browserConsole.join('\n') || '(sin logs)'}

Page errors:
${pageErrors.join('\n') || '(sin errores)'}
`,
    ).toBeTruthy()

    await expect(
      page.getByText('Búsqueda en el texto del archivo'),
      `No apareció la estrategia grounded esperada.

Requests:
${chatRequests.join('\n') || '(sin requests)'}

Responses:
${chatResponses.join('\n') || '(sin responses)'}

Console:
${browserConsole.join('\n') || '(sin logs)'}

Page errors:
${pageErrors.join('\n') || '(sin errores)'}
`,
    ).toBeVisible({ timeout: 60_000 })
    const resultCard = page
      .locator('article')
      .filter({ hasText: 'Este resultado apareció al buscar también dentro del texto del archivo' })
      .first()
    await expect(resultCard).toBeVisible({ timeout: 60_000 })
    await expect(resultCard).toContainText('Tesis')
    await expect(resultCard).toContainText('Universidad de Córdoba')
    await expect(resultCard).toContainText(
      'Este resultado apareció al buscar también dentro del texto del archivo; puede no ser exactamente una tesis.',
    )

    await page.getByRole('button', { name: 'Abrir menú de usuario' }).click()
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('abre historial de conversaciones y crea una conversación nueva', async ({ page }) => {
    await openChatAsDocente(page)

    await page.goto('/chat')
    await expect(page).toHaveURL(/\/chat(?:\?.*)?$/)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('region', { name: 'Conversaciones' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Nueva conversación' })).toBeVisible()
    await expect(page.getByRole('button', { name: seededConversationTitle })).toBeVisible()

    await page.getByRole('button', { name: seededConversationTitle }).click()
    await expect(page).toHaveURL(new RegExp(`/chat\\?id=${seededConversationId}$`))

    await page.getByRole('button', { name: 'Nueva conversación' }).click()
    await expect(page).toHaveURL(/\/chat\?id=chat_[a-z0-9]+$/i)
    await expect(page.getByRole('textbox', { name: 'Mensaje para el asistente' })).toBeVisible()
  })
})
