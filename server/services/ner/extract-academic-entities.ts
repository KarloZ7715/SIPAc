import { Output, generateText } from 'ai'
import { z } from 'zod'
import type { ProductType, OcrProvider } from '~~/app/types'
import { getStructuredModelCandidates } from '~~/server/services/llm/provider'
import { validateEnv } from '~~/server/utils/env'

const academicEntitySchema = z.object({
  authors: z.array(z.string().trim().min(1)).default([]),
  title: z.string().trim().min(1).optional().nullable(),
  institution: z.string().trim().min(1).optional().nullable(),
  date: z.string().trim().min(1).optional().nullable(),
  keywords: z.array(z.string().trim().min(1)).default([]),
  doi: z.string().trim().min(1).optional().nullable(),
  eventOrJournal: z.string().trim().min(1).optional().nullable(),
  confidence: z.object({
    authors: z.number().min(0).max(1).default(0),
    title: z.number().min(0).max(1).default(0),
    institution: z.number().min(0).max(1).default(0),
    date: z.number().min(0).max(1).default(0),
    keywords: z.number().min(0).max(1).default(0),
    doi: z.number().min(0).max(1).default(0),
    eventOrJournal: z.number().min(0).max(1).default(0),
  }),
})

type AcademicEntityOutput = z.infer<typeof academicEntitySchema>

export interface AcademicEntityExtractionResult {
  authors: string[]
  title?: string
  institution?: string
  date?: Date
  keywords: string[]
  doi?: string
  eventOrJournal?: string
  extractionSource: OcrProvider
  extractionConfidence: number
  extractedAt: Date
}

function normalizeOptionalString(value?: string | null): string | undefined {
  if (!value) return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function normalizeDate(value?: string | null): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function averageConfidence(output: AcademicEntityOutput): number {
  const scores: number[] = []

  if (output.authors.length > 0) scores.push(output.confidence.authors)
  if (normalizeOptionalString(output.title)) scores.push(output.confidence.title)
  if (normalizeOptionalString(output.institution)) scores.push(output.confidence.institution)
  if (normalizeOptionalString(output.date)) scores.push(output.confidence.date)
  if (output.keywords.length > 0) scores.push(output.confidence.keywords)
  if (normalizeOptionalString(output.doi)) scores.push(output.confidence.doi)
  if (normalizeOptionalString(output.eventOrJournal)) scores.push(output.confidence.eventOrJournal)

  if (scores.length === 0) return 0
  return Number((scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(3))
}

function buildPrompt(text: string, productType: ProductType, enriched: boolean): string {
  const guidance = {
    article: 'Si es articulo, prioriza revista, DOI, autores, titulo y palabras clave.',
    conference_paper: 'Si es ponencia, prioriza evento, autores, titulo y fecha de presentacion.',
    thesis: 'Si es tesis, prioriza universidad, titulo, autores, director y fecha de aprobacion/publicacion.',
    certificate: 'Si es certificado, prioriza entidad emisora, titulo, fecha y evento relacionado.',
    research_project: 'Si es proyecto, prioriza titulo, investigadores, institucion y fechas del proyecto.',
  }[productType]

  const retryInstructions = enriched
    ? 'Haz una segunda lectura mas inferencial. Si un dato es ambiguo pero altamente probable, reportalo con una confianza menor en lugar de omitirlo.'
    : 'Si no encuentras un dato, devuelvelo vacio.'

  return [
    'Extrae metadatos academicos estructurados del siguiente texto OCR.',
    'Responde siguiendo exactamente el esquema solicitado.',
    'Usa espanol para interpretar el contenido.',
    guidance,
    retryInstructions,
    'Para la fecha devuelve ISO 8601 cuando sea posible.',
    'Para DOI devuelve el valor exacto sin texto adicional.',
    'Asigna una confianza entre 0 y 1 por entidad.',
    '',
    text.slice(0, 24_000),
  ].join('\n')
}

async function executeStructuredExtraction(prompt: string, temperature: number): Promise<AcademicEntityOutput> {
  const candidates = getStructuredModelCandidates()
  let lastError: unknown = null

  for (const candidate of candidates) {
    try {
      const result = await generateText({
        model: candidate.model,
        temperature,
        output: Output.object({ schema: academicEntitySchema }),
        prompt,
      })

      return result.output
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No fue posible extraer entidades')
}

export async function extractAcademicEntities(input: {
  text: string
  productType: ProductType
  extractionSource: OcrProvider
}): Promise<AcademicEntityExtractionResult> {
  const env = validateEnv(useRuntimeConfig())

  const firstPass = await executeStructuredExtraction(
    buildPrompt(input.text, input.productType, false),
    0.2,
  )

  let selected = firstPass
  if (averageConfidence(firstPass) < env.nerConfidenceThreshold) {
    selected = await executeStructuredExtraction(
      buildPrompt(input.text, input.productType, true),
      0.6,
    )
  }

  return {
    authors: [...new Set(selected.authors.map((author) => author.trim()).filter(Boolean))],
    title: normalizeOptionalString(selected.title),
    institution: normalizeOptionalString(selected.institution),
    date: normalizeDate(selected.date),
    keywords: [...new Set(selected.keywords.map((keyword) => keyword.trim()).filter(Boolean))],
    doi: normalizeOptionalString(selected.doi),
    eventOrJournal: normalizeOptionalString(selected.eventOrJournal),
    extractionSource: input.extractionSource,
    extractionConfidence: averageConfidence(selected),
    extractedAt: new Date(),
  }
}