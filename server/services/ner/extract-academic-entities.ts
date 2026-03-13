import { Output, generateText } from 'ai'
import { z } from 'zod'
import type {
  ProductType,
  OcrProvider,
  ExtractedEntityWithEvidence,
  DocumentAnchor,
} from '~~/app/types'
import { PRODUCT_TYPES } from '~~/app/types'
import {
  getStructuredModelCandidates,
  type StructuredLlmProvider,
} from '~~/server/services/llm/provider'
import { validateEnv } from '~~/server/utils/env'

const productTypeClassificationSchema = z.object({
  documentClassification: z.enum(['academic', 'non_academic', 'uncertain']),
  classificationConfidence: z.number().min(0).max(1).default(0),
  classificationRationale: z.string().trim().min(1).max(240).default('Clasificacion automatica'),
  productType: z.enum(PRODUCT_TYPES).optional(),
  productTypeConfidence: z.number().min(0).max(1).default(0),
})

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

interface OcrTextBlock {
  text: string
  anchor: DocumentAnchor
}

export interface AcademicEntityExtractionResult {
  productType: ProductType
  documentClassification: 'academic' | 'non_academic' | 'uncertain'
  classificationConfidence: number
  classificationRationale: string
  authors: ExtractedEntityWithEvidence<string>[]
  title?: ExtractedEntityWithEvidence<string>
  institution?: ExtractedEntityWithEvidence<string>
  date?: ExtractedEntityWithEvidence<Date>
  keywords: ExtractedEntityWithEvidence<string>[]
  doi?: ExtractedEntityWithEvidence<string>
  eventOrJournal?: ExtractedEntityWithEvidence<string>
  extractionSource: OcrProvider
  extractionConfidence: number
  nerProvider: StructuredLlmProvider
  nerModel: string
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

function normalizeForMatching(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractMatchTokens(value: string): string[] {
  const tokens = normalizeForMatching(value)
    .split(' ')
    .filter((token) => token.length >= 4)

  if (!tokens.length) {
    return [normalizeForMatching(value)].filter(Boolean)
  }

  return [...new Set(tokens)]
}

function resolveAnchorsFromOcrBlocks(
  value: string | undefined,
  blocks: OcrTextBlock[],
  provider: OcrProvider,
): DocumentAnchor[] {
  if (!value || blocks.length === 0) {
    return []
  }

  const normalizedValue = normalizeForMatching(value)
  if (!normalizedValue) {
    return []
  }

  const tokens = extractMatchTokens(value)
  if (!tokens.length) {
    return []
  }

  const rankedMatches: Array<{ score: number; anchor: DocumentAnchor }> = []

  blocks.forEach((block) => {
    const normalizedBlockText = normalizeForMatching(block.text)
    if (!normalizedBlockText) {
      return
    }

    const matchedTokenCount = tokens.reduce(
      (count, token) => count + (normalizedBlockText.includes(token) ? 1 : 0),
      0,
    )

    const hasContainmentMatch =
      normalizedBlockText.includes(normalizedValue) || normalizedValue.includes(normalizedBlockText)

    if (matchedTokenCount === 0 && !hasContainmentMatch) {
      return
    }

    const tokenCoverage = matchedTokenCount / tokens.length
    const containmentBoost = hasContainmentMatch ? 0.25 : 0
    const exactPhraseBoost = normalizedBlockText === normalizedValue ? 0.35 : 0
    const score = tokenCoverage + containmentBoost + exactPhraseBoost

    if (!hasContainmentMatch && tokenCoverage < 0.6) {
      return
    }

    rankedMatches.push({
      score,
      anchor: {
        ...block.anchor,
        provider,
        sourceText: block.text,
      },
    })
  })

  rankedMatches.sort((left, right) => right.score - left.score)

  const uniqueAnchors = new Set<string>()

  return rankedMatches
    .slice(0, 8)
    .filter((candidate) => candidate.score >= 0.7)
    .map((candidate) => candidate.anchor)
    .filter((anchor) => {
      const key = `${anchor.page}-${anchor.x}-${anchor.y}-${anchor.width}-${anchor.height}`
      if (uniqueAnchors.has(key)) {
        return false
      }

      uniqueAnchors.add(key)
      return true
    })
}

function createStringEvidence(
  value: string | undefined,
  confidence: number,
  blocks: OcrTextBlock[],
  provider: OcrProvider,
): ExtractedEntityWithEvidence<string> | undefined {
  if (!value) {
    return undefined
  }

  return {
    value,
    confidence,
    anchors: resolveAnchorsFromOcrBlocks(value, blocks, provider),
  }
}

function createDateEvidence(
  value: Date | undefined,
  confidence: number,
  blocks: OcrTextBlock[],
  provider: OcrProvider,
): ExtractedEntityWithEvidence<Date> | undefined {
  if (!value) {
    return undefined
  }

  return {
    value,
    confidence,
    anchors: resolveAnchorsFromOcrBlocks(value.toISOString().slice(0, 10), blocks, provider),
  }
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

const ACADEMIC_SIGNALS = [
  /doi\b/i,
  /issn\b/i,
  /resumen\b/i,
  /palabras\s+clave\b/i,
  /referencias\b/i,
  /bibliografia\b/i,
  /universidad\b/i,
  /facultad\b/i,
  /revista\b/i,
  /congreso\b/i,
  /seminario\b/i,
  /tesis\b/i,
  /maestria\b/i,
  /doctorado\b/i,
  /investigaci[oó]n\b/i,
]

const NON_ACADEMIC_SIGNALS = [
  /factura\b/i,
  /cotizaci[oó]n\b/i,
  /orden\s+de\s+compra\b/i,
  /extracto\s+bancario\b/i,
  /historia\s+cl[ií]nica\b/i,
  /incapacidad\b/i,
  /remisi[oó]n\b/i,
  /pedido\b/i,
  /recibo\b/i,
  /n[úu]mero\s+de\s+cuenta\b/i,
]

function keywordScore(text: string, patterns: RegExp[]): number {
  return patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0)
}

function inferHeuristicProductType(text: string): ProductType {
  if (/tesis|trabajo\s+de\s+grado|director\s+de\s+tesis/i.test(text)) {
    return 'thesis'
  }

  if (/certifica|certificado|constancia|horas\s+de\s+participaci[oó]n/i.test(text)) {
    return 'certificate'
  }

  if (/congreso|ponencia|simposio|evento\s+acad[ée]mico/i.test(text)) {
    return 'conference_paper'
  }

  if (/proyecto\s+de\s+investigaci[oó]n|financiaci[oó]n|investigador\s+principal/i.test(text)) {
    return 'research_project'
  }

  return 'article'
}

function classifyDocumentHeuristically(text: string): {
  documentClassification: 'academic' | 'non_academic' | 'uncertain'
  classificationConfidence: number
  classificationRationale: string
  productType: ProductType
} {
  const chunk = text.slice(0, 30_000)
  const academicScore = keywordScore(chunk, ACADEMIC_SIGNALS)
  const nonAcademicScore = keywordScore(chunk, NON_ACADEMIC_SIGNALS)
  const balance = academicScore - nonAcademicScore
  const productType = inferHeuristicProductType(chunk)

  if (academicScore >= 3 && balance >= 1) {
    return {
      documentClassification: 'academic',
      classificationConfidence: Number(Math.min(0.95, 0.56 + balance * 0.09).toFixed(3)),
      classificationRationale: 'Se encontraron senales tipicas de produccion academica.',
      productType,
    }
  }

  if (nonAcademicScore >= 3 && balance <= -1) {
    return {
      documentClassification: 'non_academic',
      classificationConfidence: Number(Math.min(0.95, 0.56 + Math.abs(balance) * 0.09).toFixed(3)),
      classificationRationale: 'Predominan senales de documento no academico.',
      productType,
    }
  }

  return {
    documentClassification: 'uncertain',
    classificationConfidence: Number((0.45 + Math.min(academicScore, 2) * 0.06).toFixed(3)),
    classificationRationale: 'No hay evidencia suficiente para clasificar con certeza.',
    productType,
  }
}

function buildProductTypePrompt(text: string): string {
  return [
    'Clasifica el siguiente texto en contexto universitario.',
    'Primero determina si el documento es academic, non_academic o uncertain.',
    'Si el documento parece academico, sugiere productType con una opcion: article, conference_paper, thesis, certificate, research_project.',
    'Si no es academico o es incierto, puedes omitir productType.',
    'Interpreta el contenido en espanol aunque el documento mezcle idiomas.',
    'Incluye una rationale breve y concreta.',
    '',
    text.slice(0, 20_000),
  ].join('\n')
}

function buildPrompt(text: string, productType: ProductType, enriched: boolean): string {
  const guidance = {
    article: 'Si es articulo, prioriza revista, DOI, autores, titulo y palabras clave.',
    conference_paper: 'Si es ponencia, prioriza evento, autores, titulo y fecha de presentacion.',
    thesis:
      'Si es tesis, prioriza universidad, titulo, autores, director y fecha de aprobacion/publicacion.',
    certificate: 'Si es certificado, prioriza entidad emisora, titulo, fecha y evento relacionado.',
    research_project:
      'Si es proyecto, prioriza titulo, investigadores, institucion y fechas del proyecto.',
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

async function executeStructuredExtraction(
  prompt: string,
  temperature: number,
): Promise<{
  output: AcademicEntityOutput
  provider: StructuredLlmProvider
  modelId: string
}> {
  return executeStructuredObject(prompt, temperature, academicEntitySchema)
}

async function executeStructuredObject<TSchema extends z.ZodTypeAny>(
  prompt: string,
  temperature: number,
  schema: TSchema,
): Promise<{
  output: z.infer<TSchema>
  provider: StructuredLlmProvider
  modelId: string
}> {
  const candidates = getStructuredModelCandidates()
  let lastError: unknown = null

  for (const candidate of candidates) {
    try {
      const result = await generateText({
        model: candidate.model,
        temperature,
        output: Output.object({ schema }),
        prompt,
      })

      return {
        output: result.output as z.infer<TSchema>,
        provider: candidate.name,
        modelId: candidate.modelId,
      }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No fue posible extraer entidades')
}

async function detectProductProfile(text: string): Promise<{
  productType: ProductType
  documentClassification: 'academic' | 'non_academic' | 'uncertain'
  classificationConfidence: number
  classificationRationale: string
}> {
  const heuristic = classifyDocumentHeuristically(text)

  try {
    const classification = await executeStructuredObject(
      buildProductTypePrompt(text),
      0.15,
      productTypeClassificationSchema,
    )
    const classificationOutput = classification.output

    const modelClassification = classificationOutput.documentClassification
    const modelConfidence = Number(classificationOutput.classificationConfidence.toFixed(3))
    const modelRationale = normalizeOptionalString(classificationOutput.classificationRationale)
    const modelProductType = classificationOutput.productType ?? heuristic.productType

    if (modelClassification === 'uncertain' && heuristic.documentClassification !== 'uncertain') {
      return {
        productType: heuristic.productType,
        documentClassification: heuristic.documentClassification,
        classificationConfidence: Math.max(heuristic.classificationConfidence, modelConfidence),
        classificationRationale: heuristic.classificationRationale,
      }
    }

    return {
      productType: modelProductType,
      documentClassification: modelClassification,
      classificationConfidence: modelConfidence,
      classificationRationale: modelRationale ?? heuristic.classificationRationale,
    }
  } catch {
    return {
      productType: heuristic.productType,
      documentClassification: heuristic.documentClassification,
      classificationConfidence: heuristic.classificationConfidence,
      classificationRationale: heuristic.classificationRationale,
    }
  }
}

export async function extractAcademicEntities(input: {
  text: string
  extractionSource: OcrProvider
  ocrBlocks?: OcrTextBlock[]
}): Promise<AcademicEntityExtractionResult> {
  const env = validateEnv(useRuntimeConfig())
  const profile = await detectProductProfile(input.text)
  const detectedProductType = profile.productType
  const ocrBlocks = input.ocrBlocks ?? []

  const firstPass = await executeStructuredExtraction(
    buildPrompt(input.text, detectedProductType, false),
    0.2,
  )

  let selected = firstPass
  if (averageConfidence(firstPass.output) < env.nerConfidenceThreshold) {
    selected = await executeStructuredExtraction(
      buildPrompt(input.text, detectedProductType, true),
      0.6,
    )
  }

  const selectedOutput = selected.output

  const normalizedTitle = normalizeOptionalString(selectedOutput.title)
  const normalizedInstitution = normalizeOptionalString(selectedOutput.institution)
  const normalizedDate = normalizeDate(selectedOutput.date)
  const normalizedDoi = normalizeOptionalString(selectedOutput.doi)
  const normalizedEventOrJournal = normalizeOptionalString(selectedOutput.eventOrJournal)

  return {
    productType: detectedProductType,
    documentClassification: profile.documentClassification,
    classificationConfidence: profile.classificationConfidence,
    classificationRationale: profile.classificationRationale,
    authors: [
      ...new Set(selectedOutput.authors.map((author) => author.trim()).filter(Boolean)),
    ].map((author) => ({
      value: author,
      confidence: selectedOutput.confidence.authors,
      anchors: resolveAnchorsFromOcrBlocks(author, ocrBlocks, input.extractionSource),
    })),
    title: createStringEvidence(
      normalizedTitle,
      selectedOutput.confidence.title,
      ocrBlocks,
      input.extractionSource,
    ),
    institution: createStringEvidence(
      normalizedInstitution,
      selectedOutput.confidence.institution,
      ocrBlocks,
      input.extractionSource,
    ),
    date: createDateEvidence(
      normalizedDate,
      selectedOutput.confidence.date,
      ocrBlocks,
      input.extractionSource,
    ),
    keywords: [
      ...new Set(selectedOutput.keywords.map((keyword) => keyword.trim()).filter(Boolean)),
    ].map((keyword) => ({
      value: keyword,
      confidence: selectedOutput.confidence.keywords,
      anchors: resolveAnchorsFromOcrBlocks(keyword, ocrBlocks, input.extractionSource),
    })),
    doi: createStringEvidence(
      normalizedDoi,
      selectedOutput.confidence.doi,
      ocrBlocks,
      input.extractionSource,
    ),
    eventOrJournal: createStringEvidence(
      normalizedEventOrJournal,
      selectedOutput.confidence.eventOrJournal,
      ocrBlocks,
      input.extractionSource,
    ),
    extractionSource: input.extractionSource,
    extractionConfidence: averageConfidence(selectedOutput),
    nerProvider: selected.provider,
    nerModel: selected.modelId,
    extractedAt: new Date(),
  }
}
