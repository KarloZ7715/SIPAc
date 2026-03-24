import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import User from '../../server/models/User'
import UploadedFile from '../../server/models/UploadedFile'
import AcademicProduct from '../../server/models/AcademicProduct'
import ChatConversation from '../../server/models/ChatConversation'

const testRunId = `e2e-chat-${Date.now()}`
const docenteEmail = `${testRunId}@correo.unicordoba.edu.co`
const docentePassword = 'Docente12345!'
const docenteFullName = 'Docente E2E Chat'
const seededTitle = `Memorias E2E ${testRunId}`

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

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongodbUri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10_000,
    })
  }
}

test.describe('Chat IA docente', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(120_000)

  test.beforeAll(async () => {
    await connectMongo()

    await User.deleteMany({ email: docenteEmail })

    const user = await User.create({
      fullName: docenteFullName,
      email: docenteEmail,
      passwordHash: docentePassword,
      program: 'Ingeniería de Sistemas',
      role: 'docente',
    })

    const uploadedFile = await UploadedFile.create({
      uploadedBy: user._id,
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
      owner: user._id,
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
  })

  test.afterAll(async () => {
    const seededUser = await User.findOne({ email: docenteEmail }).lean()

    if (seededUser?._id) {
      await AcademicProduct.deleteMany({ owner: seededUser._id })
      await UploadedFile.deleteMany({ uploadedBy: seededUser._id })
      await ChatConversation.deleteMany({ userId: seededUser._id })
      await User.deleteOne({ _id: seededUser._id })
    }

    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect()
    }
  })

  test('un docente inicia sesión, consulta el chat grounded, valida evidencia y cierra sesión', async ({
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

    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
    const loginEmailInput = page.locator('input[name="email"]')
    const loginPasswordInput = page.locator('input[name="password"]')
    await loginEmailInput.fill(docenteEmail)
    await loginPasswordInput.fill(docentePassword)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()

    await expect(page).toHaveURL(/\/$/)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Workspace docente')).toBeVisible()

    await page.getByRole('link', { name: 'Chat IA' }).click()
    await expect(page).toHaveURL(/\/chat/)
    await page.waitForLoadState('networkidle')
    await expect(
      page.getByRole('heading', { name: 'Repositorio conversacional grounded' }),
    ).toBeVisible()
    await expect(page.getByText('Selector de modelo')).toBeVisible()

    const modelSelector = page.getByRole('combobox')
    await modelSelector.click()

    const cerebrasOption = page.getByText('Cerebras · qwen-3-235b-a22b-instruct-2507')
    const nvidiaOption = page.getByText('NVIDIA · z-ai/glm4.7')

    if (await cerebrasOption.isVisible().catch(() => false)) {
      await cerebrasOption.click()
    } else if (await nvidiaOption.isVisible().catch(() => false)) {
      await nvidiaOption.click()
    } else {
      throw new Error('No se encontró un modelo manual estable esperado para el flujo E2E docente')
    }

    const chatTextarea = page.getByPlaceholder(
      'Pregunta por documentos, autores, temas, fechas o combinaciones del repositorio confirmado...',
    )
    await chatTextarea.fill('¿Qué tesis confirmadas están asociadas a la Universidad de Córdoba?')
    await expect(page.getByRole('button', { name: 'Consultar' })).toBeEnabled()

    await page.getByRole('button', { name: 'Consultar' }).click()
    await page.waitForTimeout(5_000)

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
      chatResponses.some((response) => response.startsWith('200 ')),
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
      page.getByText('Recuperación grounded'),
      `No apareció evidencia grounded.

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
    await expect(page.getByText('Diagnóstico de recuperación')).toBeVisible({ timeout: 60_000 })
    await expect(
      page.getByText('Se amplió la búsqueda retirando temporalmente la restricción de tipo'),
    ).toBeVisible({ timeout: 60_000 })
    const resultCard = page.locator('article').filter({ hasText: seededTitle }).first()
    await expect(resultCard).toBeVisible({ timeout: 60_000 })
    await expect(resultCard).toContainText('Universidad de Córdoba')
    await expect(resultCard).toContainText(
      'La coincidencia se recuperó por evidencia OCR/nativa y puede no corresponder al tipo thesis.',
    )

    await page.getByRole('button', { name: 'Nueva conversación' }).click()
    await expect(page).toHaveURL(/\/chat\?id=/)
    await expect(page.getByText('Primeros ejemplos')).toBeVisible()

    await page.getByRole('button', { name: 'Abrir menú de usuario' }).click()
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click()
    await expect(page).toHaveURL(/\/login/)
  })
})
