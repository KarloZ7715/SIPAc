import { Output, generateText } from 'ai'
import { z } from 'zod'
import type {
  ProductType,
  OcrProvider,
  ExtractedEntityWithEvidence,
  DocumentAnchor,
  NerAttemptTraceEntry,
} from '~~/app/types'
import { PRODUCT_TYPES } from '~~/app/types'
import {
  getStructuredModelCandidates,
  type StructuredLlmProvider,
} from '~~/server/services/llm/provider'
import { validateEnv } from '~~/server/utils/env'
import {
  classifyPipelineError,
  logPipelineEvent,
  withTimeout,
} from '~~/server/utils/pipeline-observability'
import { applySemanticValidation } from '~~/server/services/ner/semantic-validation'

const productTypeClassificationSchema = z
  .object({
    documentClassification: z.enum(['academic', 'non_academic', 'uncertain']),
    classificationConfidence: z.number().min(0).max(1),
    classificationRationale: z.string().trim().min(1).max(240),
    productType: z.enum(PRODUCT_TYPES).nullable(),
    productTypeConfidence: z.number().min(0).max(1),
  })
  .strict()

const academicEntitySchema = z
  .object({
    authors: z.array(z.string().trim().min(1)),
    title: z.string().trim().min(1).nullable(),
    institution: z.string().trim().min(1).nullable(),
    date: z.string().trim().min(1).nullable(),
    keywords: z.array(z.string().trim().min(1)),
    doi: z.string().trim().min(1).nullable(),
    eventOrJournal: z.string().trim().min(1).nullable(),
    confidence: z
      .object({
        authors: z.number().min(0).max(1),
        title: z.number().min(0).max(1),
        institution: z.number().min(0).max(1),
        date: z.number().min(0).max(1),
        keywords: z.number().min(0).max(1),
        doi: z.number().min(0).max(1),
        eventOrJournal: z.number().min(0).max(1),
      })
      .strict(),
  })
  .strict()

type AcademicEntityOutput = z.infer<typeof academicEntitySchema>

const articleSpecificSchema = z
  .object({
    journalName: z.string().trim().min(1).optional().nullable(),
    volume: z.string().trim().min(1).optional().nullable(),
    issue: z.string().trim().min(1).optional().nullable(),
    pages: z.string().trim().min(1).optional().nullable(),
    issn: z.string().trim().min(1).optional().nullable(),
    indexing: z.array(z.string().trim().min(1)).optional(),
    openAccess: z.boolean().optional(),
    articleType: z.enum(['original', 'revision', 'corto', 'carta', 'otro']).optional(),
    journalCountry: z.string().trim().min(1).optional().nullable(),
    journalAbbreviation: z.string().trim().min(1).optional().nullable(),
    publisher: z.string().trim().min(1).optional().nullable(),
    areaOfKnowledge: z.string().trim().min(1).optional().nullable(),
    language: z.string().trim().min(1).optional().nullable(),
    license: z.string().trim().min(1).optional().nullable(),
  })
  .strict()

const conferencePaperSpecificSchema = z
  .object({
    eventName: z.string().trim().min(1).optional().nullable(),
    eventCity: z.string().trim().min(1).optional().nullable(),
    eventCountry: z.string().trim().min(1).optional().nullable(),
    eventDate: z.string().trim().min(1).optional().nullable(),
    presentationType: z.enum(['oral', 'poster', 'workshop', 'keynote']).optional(),
    isbn: z.string().trim().min(1).optional().nullable(),
    conferenceAcronym: z.string().trim().min(1).optional().nullable(),
    conferenceNumber: z.string().trim().min(1).optional().nullable(),
    proceedingsTitle: z.string().trim().min(1).optional().nullable(),
    publisher: z.string().trim().min(1).optional().nullable(),
    pages: z.string().trim().min(1).optional().nullable(),
    eventSponsor: z.string().trim().min(1).optional().nullable(),
    areaOfKnowledge: z.string().trim().min(1).optional().nullable(),
    language: z.string().trim().min(1).optional().nullable(),
  })
  .strict()

const thesisSpecificSchema = z
  .object({
    thesisLevel: z.enum(['pregrado', 'maestria', 'especializacion', 'doctorado']).optional(),
    director: z.string().trim().min(1).optional().nullable(),
    university: z.string().trim().min(1).optional().nullable(),
    faculty: z.string().trim().min(1).optional().nullable(),
    approvalDate: z.string().trim().min(1).optional().nullable(),
    repositoryUrl: z.string().trim().min(1).optional().nullable(),
    program: z.string().trim().min(1).optional().nullable(),
    jurors: z.array(z.string().trim().min(1)).optional(),
    degreeGrantor: z.string().trim().min(1).optional().nullable(),
    degreeName: z.string().trim().min(1).optional().nullable(),
    areaOfKnowledge: z.string().trim().min(1).optional().nullable(),
    modality: z.enum(['investigacion', 'monografia', 'proyecto_aplicado', 'otro']).optional(),
    language: z.string().trim().min(1).optional().nullable(),
    pages: z.number().int().positive().optional(),
    projectCode: z.string().trim().min(1).optional().nullable(),
  })
  .strict()

const certificateSpecificSchema = z
  .object({
    issuingEntity: z.string().trim().min(1).optional().nullable(),
    certificateType: z
      .enum(['participacion', 'ponente', 'asistencia', 'instructor', 'otro'])
      .optional(),
    relatedEvent: z.string().trim().min(1).optional().nullable(),
    issueDate: z.string().trim().min(1).optional().nullable(),
    expirationDate: z.string().trim().min(1).optional().nullable(),
    hours: z.number().nonnegative().optional(),
    location: z.string().trim().min(1).optional().nullable(),
    modality: z.enum(['presencial', 'virtual', 'hibrida']).optional(),
    areaOfKnowledge: z.string().trim().min(1).optional().nullable(),
    projectCode: z.string().trim().min(1).optional().nullable(),
  })
  .strict()

const researchProjectSpecificSchema = z
  .object({
    projectCode: z.string().trim().min(1).optional().nullable(),
    fundingSource: z.string().trim().min(1).optional().nullable(),
    startDate: z.string().trim().min(1).optional().nullable(),
    endDate: z.string().trim().min(1).optional().nullable(),
    projectStatus: z.enum(['active', 'completed', 'suspended']).optional(),
    coResearchers: z.array(z.string().trim().min(1)).optional(),
    principalInvestigatorName: z.string().trim().min(1).optional().nullable(),
    institution: z.string().trim().min(1).optional().nullable(),
    programOrCall: z.string().trim().min(1).optional().nullable(),
    areaOfKnowledge: z.string().trim().min(1).optional().nullable(),
    keywords: z.array(z.string().trim().min(1)).optional(),
    budget: z.number().nonnegative().optional(),
  })
  .strict()

const bookSpecificSchema = z
  .object({
    bookPublisher: z.string().trim().min(1).optional().nullable(),
    bookIsbn: z.string().trim().min(1).optional().nullable(),
    bookEdition: z.string().trim().min(1).optional().nullable(),
    bookCity: z.string().trim().min(1).optional().nullable(),
    bookCollection: z.string().trim().min(1).optional().nullable(),
    bookTotalPages: z.number().int().positive().optional(),
    bookLanguage: z.string().trim().min(1).optional().nullable(),
    bookPublicationDate: z.string().trim().min(1).optional().nullable(),
  })
  .strict()

const bookChapterSpecificSchema = z
  .object({
    chapterBookTitle: z.string().trim().min(1).optional().nullable(),
    chapterNumber: z.string().trim().min(1).optional().nullable(),
    chapterPages: z.string().trim().min(1).optional().nullable(),
    chapterEditors: z.array(z.string().trim().min(1)).optional(),
    chapterPublisher: z.string().trim().min(1).optional().nullable(),
    chapterIsbn: z.string().trim().min(1).optional().nullable(),
    chapterEdition: z.string().trim().min(1).optional().nullable(),
    chapterLanguage: z.string().trim().min(1).optional().nullable(),
    chapterPublicationDate: z.string().trim().min(1).optional().nullable(),
  })
  .strict()

const technicalReportSpecificSchema = z
  .object({
    reportNumber: z.string().trim().min(1).optional().nullable(),
    reportInstitution: z.string().trim().min(1).optional().nullable(),
    reportType: z.enum(['final', 'interim', 'white_paper', 'manual', 'other']).optional(),
    reportSponsor: z.string().trim().min(1).optional().nullable(),
    reportPublicationDate: z.string().trim().min(1).optional().nullable(),
    reportRevision: z.string().trim().min(1).optional().nullable(),
    reportPages: z.number().int().positive().optional(),
    reportRepositoryUrl: z.string().trim().min(1).optional().nullable(),
    reportAreaOfKnowledge: z.string().trim().min(1).optional().nullable(),
    reportLanguage: z.string().trim().min(1).optional().nullable(),
  })
  .strict()

const softwareSpecificSchema = z
  .object({
    softwareVersion: z.string().trim().min(1).optional().nullable(),
    softwareReleaseDate: z.string().trim().min(1).optional().nullable(),
    softwareRepositoryUrl: z.string().trim().min(1).optional().nullable(),
    softwareLicense: z.string().trim().min(1).optional().nullable(),
    softwareProgrammingLanguage: z.string().trim().min(1).optional().nullable(),
    softwarePlatform: z.string().trim().min(1).optional().nullable(),
    softwareType: z.enum(['desktop', 'web', 'mobile', 'library', 'other']).optional(),
    softwareRegistrationNumber: z.string().trim().min(1).optional().nullable(),
  })
  .strict()

const patentSpecificSchema = z
  .object({
    patentOffice: z.string().trim().min(1).optional().nullable(),
    patentApplicationNumber: z.string().trim().min(1).optional().nullable(),
    patentPublicationNumber: z.string().trim().min(1).optional().nullable(),
    patentApplicationDate: z.string().trim().min(1).optional().nullable(),
    patentPublicationDate: z.string().trim().min(1).optional().nullable(),
    patentGrantDate: z.string().trim().min(1).optional().nullable(),
    patentStatus: z.enum(['submitted', 'published', 'granted', 'expired']).optional(),
    patentAssignee: z.string().trim().min(1).optional().nullable(),
    patentInventors: z.array(z.string().trim().min(1)).optional(),
    patentCountry: z.string().trim().min(1).optional().nullable(),
    patentClassification: z.string().trim().min(1).optional().nullable(),
  })
  .strict()

const productSpecificSchemas = {
  article: articleSpecificSchema,
  conference_paper: conferencePaperSpecificSchema,
  thesis: thesisSpecificSchema,
  certificate: certificateSpecificSchema,
  research_project: researchProjectSpecificSchema,
  book: bookSpecificSchema,
  book_chapter: bookChapterSpecificSchema,
  technical_report: technicalReportSpecificSchema,
  software: softwareSpecificSchema,
  patent: patentSpecificSchema,
} as const satisfies Record<ProductType, z.ZodTypeAny>

type ProductSpecificMetadata = Record<string, unknown>

interface OcrTextBlock {
  text: string
  anchor: DocumentAnchor
}

export interface AcademicEntityExtractionResult {
  productType: ProductType
  documentClassification: 'academic' | 'non_academic' | 'uncertain'
  classificationSource: 'heuristic' | 'llm' | 'hybrid'
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
  evidenceCoverage: number
  nerProvider: StructuredLlmProvider
  nerModel: string
  nerAttemptTrace?: NerAttemptTraceEntry[]
  extractedAt: Date
}

type RuntimeNerAttemptTrace = Omit<NerAttemptTraceEntry, 'scope'>

type StructuredExecutionError = Error & {
  attempts?: RuntimeNerAttemptTrace[]
}

const NER_ATTEMPT_ERROR_MESSAGE_MAX_LENGTH = 280

function getRuntimeConfigSafe(): Record<string, unknown> {
  try {
    return useRuntimeConfig()
  } catch {
    return {}
  }
}

function normalizeOptionalString(value?: string | null): string | undefined {
  if (!value) return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function truncateAttemptErrorMessage(message: string): string {
  const normalized = message.replace(/\s+/g, ' ').trim()

  if (normalized.length <= NER_ATTEMPT_ERROR_MESSAGE_MAX_LENGTH) {
    return normalized
  }

  return `${normalized.slice(0, NER_ATTEMPT_ERROR_MESSAGE_MAX_LENGTH - 3)}...`
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

function clampUnit(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function calculateCalibratedConfidence(input: {
  baseConfidence: number
  penalties: {
    doi: number
    date: number
    eventOrJournal: number
  }
  normalizedFields: {
    title?: string
    date?: Date
    doi?: string
    eventOrJournal?: string
  }
}): { score: number; semanticPenalty: number; evidenceCoverage: number } {
  const criticalFieldCount = 4
  const presentCriticalCount = [
    input.normalizedFields.title,
    input.normalizedFields.date,
    input.normalizedFields.doi,
    input.normalizedFields.eventOrJournal,
  ].filter(Boolean).length

  const evidenceCoverage = presentCriticalCount / criticalFieldCount
  const semanticPenalty =
    input.penalties.doi + input.penalties.date + input.penalties.eventOrJournal

  const calibrated =
    input.baseConfidence * 0.75 + evidenceCoverage * 0.25 - Math.min(1, semanticPenalty) * 0.35

  return {
    score: Number(clampUnit(calibrated).toFixed(3)),
    semanticPenalty: Number(Math.min(1, semanticPenalty).toFixed(3)),
    evidenceCoverage: Number(evidenceCoverage.toFixed(3)),
  }
}

function evaluateExtractionCandidate(output: AcademicEntityOutput, productType: ProductType) {
  const semanticValidation = applySemanticValidation(
    {
      title: output.title,
      institution: output.institution,
      date: output.date,
      doi: output.doi,
      eventOrJournal: output.eventOrJournal,
    },
    productType,
  )

  const normalizedTitle = normalizeOptionalString(semanticValidation.sanitized.title)
  const normalizedInstitution = normalizeOptionalString(semanticValidation.sanitized.institution)
  const normalizedDate = normalizeDate(semanticValidation.sanitized.date)
  const normalizedDoi = normalizeOptionalString(semanticValidation.sanitized.doi)
  const normalizedEventOrJournal = normalizeOptionalString(
    semanticValidation.sanitized.eventOrJournal,
  )

  const calibratedConfidence = calculateCalibratedConfidence({
    baseConfidence: averageConfidence(output),
    penalties: semanticValidation.penalties,
    normalizedFields: {
      title: normalizedTitle,
      date: normalizedDate,
      doi: normalizedDoi,
      eventOrJournal: normalizedEventOrJournal,
    },
  })

  return {
    semanticValidation,
    normalizedTitle,
    normalizedInstitution,
    normalizedDate,
    normalizedDoi,
    normalizedEventOrJournal,
    calibratedConfidence,
  }
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
  if (/patente|invenci[oó]n|n[úu]mero\s+de\s+solicitud|oficina\s+de\s+patentes/i.test(text)) {
    return 'patent'
  }

  if (/software|github|gitlab|repositorio\s+de\s+c[oó]digo|versi[oó]n\s+\d+/i.test(text)) {
    return 'software'
  }

  if (/reporte\s+t[eé]cnico|technical\s+report|informe\s+t[eé]cnico/i.test(text)) {
    return 'technical_report'
  }

  if (/cap[ií]tulo\s+de\s+libro|book\s+chapter|en:\s+.+editor/i.test(text)) {
    return 'book_chapter'
  }

  if (/isbn|editorial|primera\s+edici[oó]n|segunda\s+edici[oó]n|libro/i.test(text)) {
    return 'book'
  }

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
    'Clasifica el siguiente texto en contexto universitario. El OCR puede mezclar espanol e ingles y tener ruido.',
    'Paso 1: decide documentClassification con una sola etiqueta: academic, non_academic, uncertain.',
    'academic: productos de investigacion o formacion superior (articulo, ponencia, tesis, certificado academico, proyecto, libro, capitulo, reporte tecnico, software academico, patente).',
    'non_academic: documentos administrativos/comerciales/salud/finanzas sin proposito academico (factura, cotizacion, orden de compra, extracto bancario, historia clinica, receta, recibo, etc).',
    'CRITERIO ESTRICTO: Si el documento no tiene ninguna senal clara de produccion intelectual o academica, marca non_academic con confianza > 0.8.',
    'uncertain: evidencia mixta o insuficiente; no fuerces clasificacion cuando las senales se contradicen.',
    'Paso 2: si es academic, asigna productType con una sola opcion: article, conference_paper, thesis, certificate, research_project, book, book_chapter, technical_report, software, patent.',
    'Criterios por tipo (senales tipicas y desambiguacion):',
    '- article: revista/journal, volumen, numero/issue, DOI, ISSN, resumen/abstract, palabras clave. (Ej: "Publicado en Revista de Ciencias, Vol 5" -> article)',
    '- conference_paper: congreso/simposio/encuentro, proceedings, ISBN del evento, ponencia/oral/poster, sede/ciudad. (Ej: "Memorias del IV Congreso de Ingenieria" -> conference_paper)',
    '- thesis: tesis/trabajo de grado/disertacion, director, jurados, facultad, programa, aprobacion/sustentacion.',
    '- certificate: certificado/constancia/diploma, entidad emisora, horas, participacion/asistencia/ponente/instructor. (ATENCION: un certificado academico valida formacion o participacion en eventos, NO es una constancia laboral ni salarial).',
    '- research_project: proyecto de investigacion, codigo del proyecto, fuente de financiacion, investigador principal, vigencia.',
    '- book: editorial, ISBN de libro, edicion, coleccion, ciudad de publicacion.',
    '- book_chapter: capitulo de libro, "En:", editores, paginas de capitulo, libro anfitrion.',
    '- technical_report: reporte tecnico/informe tecnico/white paper/manual, numero de reporte, revision.',
    '- software: software/sistema/plataforma/libreria, version, repositorio, licencia, lenguaje.',
    '- patent: patente, oficina de patentes, numero de solicitud/publicacion, estado (submitted/published/granted/expired).',
    'Si documentClassification es non_academic o uncertain puedes dejar productType en null.',
    'Devuelve classificationRationale breve (1 frase, maximo 240 caracteres) CITANDO EXACTAMENTE 2-4 tokens/frases textuales literales del documento que justifiquen la eleccion, en lugar de usar descripciones genericas.',
    '',
    text.slice(0, 20_000),
  ].join('\n')
}

function buildPrompt(text: string, productType: ProductType, enriched: boolean): string {
  const guidance = {
    article: [
      'Tipo article:',
      '- Extrae con prioridad title, authors, date, doi, keywords y eventOrJournal.',
      '- En article, eventOrJournal debe ser el nombre de la revista (journal name).',
      '- Busca en portada/encabezado/pie y en bloques con Vol., Num., Issue, pp., ISSN, Journal, Revista.',
      '- Si hay varias entidades candidatas de revista, prioriza la asociada al DOI o al titulo del articulo.',
    ].join('\n'),
    conference_paper: [
      'Tipo conference_paper:',
      '- Extrae title, authors, date, institution, keywords y eventOrJournal.',
      '- En conference_paper, eventOrJournal debe ser el nombre del evento/congreso.',
      '- Busca pistas como Congreso, Simposio, Proceedings, ISBN, sede, ciudad, pais, fecha del evento.',
      '- Distingue nombre del evento de nombre de revista; si aparecen ambos, para este campo usa el evento.',
    ].join('\n'),
    thesis: [
      'Tipo thesis:',
      '- Extrae title, authors, institution, date y keywords.',
      '- Prioriza universidad/facultad/programa, director(es), jurados y fecha de aprobacion o sustentacion.',
      '- Busca en portada, acta de aprobacion y paginas preliminares.',
      '- eventOrJournal normalmente no aplica en tesis; solo usalo si hay un evento claramente relacionado.',
    ].join('\n'),
    certificate: [
      'Tipo certificate:',
      '- Extrae title, authors (si hay titular), institution, date y eventOrJournal.',
      '- En certificate, institution suele ser la entidad emisora y eventOrJournal el evento relacionado.',
      '- Busca palabras Certifica, Constancia, Diploma, Horas, Participacion, Asistencia, Ponente.',
      '- Si hay fecha de emision y vencimiento, usa date para la fecha principal de emision.',
    ].join('\n'),
    research_project: [
      'Tipo research_project:',
      '- Extrae title, authors/investigadores, institution, date y keywords.',
      '- Prioriza codigo de proyecto, financiacion, investigador principal y rango de fechas.',
      '- Busca en secciones Resumen ejecutivo, Datos del proyecto, Convocatoria, Presupuesto.',
      '- eventOrJournal no suele aplicar; solo reportalo si hay evento formal asociado al proyecto.',
    ].join('\n'),
    book: [
      'Tipo book:',
      '- Extrae title, authors, date, doi (si existe), keywords y eventOrJournal solo si realmente aplica.',
      '- Prioriza editorial, ISBN, edicion, ciudad, idioma y total de paginas.',
      '- Busca en portada, pagina legal, colofon y metadatos editoriales.',
    ].join('\n'),
    book_chapter: [
      'Tipo book_chapter:',
      '- Extrae title del capitulo, authors, date y keywords.',
      '- Prioriza libro anfitrion, editores, paginas del capitulo, editorial, ISBN del libro.',
      '- Busca marcadores En:, Capitulo, Editors/Compiladores, pp., DOI del capitulo.',
      '- eventOrJournal no aplica salvo que el capitulo provenga de actas de evento.',
    ].join('\n'),
    technical_report: [
      'Tipo technical_report:',
      '- Extrae title, authors, institution, date, keywords.',
      '- Prioriza numero de reporte, tipo de reporte, revision, patrocinador y URL de repositorio.',
      '- Busca frases Reporte Tecnico, Technical Report, White Paper, Manual, Version/Revision.',
    ].join('\n'),
    software: [
      'Tipo software:',
      '- Extrae title, authors, institution, date y keywords cuando aparezcan en documentacion del software.',
      '- Prioriza version, fecha de lanzamiento, repositorio, licencia, lenguaje y plataforma.',
      '- Busca en README, encabezados de release notes, URL de GitHub/GitLab, SPDX/license.',
    ].join('\n'),
    patent: [
      'Tipo patent:',
      '- Extrae title, inventores/autores, institution (si aplica), date y doi solo si existe.',
      '- Prioriza oficina de patentes, numeros de solicitud/publicacion, estado y fechas clave.',
      '- Busca Application No., Publication No., Grant Date, Assignee, IPC/CPC classification.',
    ].join('\n'),
  }[productType]

  const retryInstructions = enriched
    ? 'Haz una segunda lectura mas inferencial. Si un dato es ambiguo pero altamente probable, reportalo con menor confianza en lugar de omitirlo. No inventes ni fabriques datos bajo ninguna circunstancia.'
    : 'Si no encuentras un dato, devuelvelo vacio.'

  return [
    'Extrae metadatos academicos estructurados del siguiente texto OCR.',
    'Responde siguiendo exactamente el esquema solicitado.',
    'Usa espanol para interpretar el contenido, incluso si hay terminos en ingles.',
    'Campos base a intentar siempre: authors, title, institution, date, keywords, doi, eventOrJournal.',
    'REGLA ESTRICTA para fechas: usa UNICAMENTE formato ISO 8601 (YYYY-MM-DD). Si solo existe el anio, usa YYYY-01-01. Si solo hay mes y anio, usa YYYY-MM-01. No uses otros formatos.',
    'REGLA ESTRICTA para DOI: el DOI debe comenzar con 10. (ejemplo: 10.1234/abcd.2026.10). Devuelve SOLO el identificador limpio, sin prefijo "doi:", sin URL "https://doi.org/" ni texto adicional. Si no aparece un DOI literal en el texto, devuelve null.',
    'PROHIBIDO inventar DOIs, ISSNs, ISBNs o numeros identificadores que no aparezcan literalmente en el texto. Si dudas, devuelve null con confianza 0.',
    'Autores y keywords: devuelve listas separadas, limpiando duplicados evidentes. No uses "et al." como nombre de autor. No repitas un autor incompleto junto a su version completa.',
    'Interpreta abreviaturas frecuentes: Vol., Num., No., Issue, pp., ed., ISBN, ISSN, Proc., Conf., Univ.',
    'Confianza por entidad entre 0 y 1: alta si explicito, media si inferido por contexto, baja si ambiguo. Si no hay evidencia textual, la confianza debe ser 0.',
    'No inventes valores que no esten soportados por evidencia textual.',
    guidance,
    retryInstructions,
    'Regla para eventOrJournal: article=revista; conference_paper=evento; certificate=evento relacionado; otros tipos solo si aplica claramente.',
    '',
    text.slice(0, 24_000),
  ].join('\n')
}

function buildProductSpecificPrompt(
  text: string,
  productType: ProductType,
  commonExtraction: Pick<
    AcademicEntityOutput,
    'title' | 'authors' | 'institution' | 'date' | 'doi' | 'eventOrJournal'
  >,
): string {
  const typeInstructions: Record<ProductType, string[]> = {
    article: [
      'Extrae para article: journalName, volume, issue, pages, issn, indexing[], openAccess, articleType, journalCountry, journalAbbreviation, publisher, areaOfKnowledge, language, license.',
      'Detecta indexacion en listas como Scopus, WoS, Publindex, SciELO, Redalyc.',
      'openAccess=true solo si aparece explicitamente Open Access/Acceso Abierto o licencia libre.',
    ],
    conference_paper: [
      'Extrae para conference_paper: eventName, eventCity, eventCountry, eventDate, presentationType, isbn, conferenceAcronym, conferenceNumber, proceedingsTitle, publisher, pages, eventSponsor, areaOfKnowledge, language.',
      'eventDate debe ser fecha del evento y no de publicacion del PDF, si ambas aparecen.',
      'presentationType solo si hay evidencia textual clara: oral/poster/workshop/keynote.',
    ],
    thesis: [
      'Extrae para thesis: thesisLevel, director, university, faculty, approvalDate, repositoryUrl, program, jurors[], degreeGrantor, degreeName, areaOfKnowledge, modality, language, pages, projectCode.',
      'thesisLevel deducelo por palabras: pregrado, especializacion, maestria, doctorado.',
      'modality solo con evidencia: investigacion, monografia, proyecto_aplicado u otro.',
    ],
    certificate: [
      'Extrae para certificate: issuingEntity, certificateType, relatedEvent, issueDate, expirationDate, hours, location, modality, areaOfKnowledge, projectCode.',
      'certificateType solo entre participacion, ponente, asistencia, instructor, otro.',
      'modality solo entre presencial, virtual, hibrida.',
    ],
    research_project: [
      'Extrae para research_project: projectCode, fundingSource, startDate, endDate, projectStatus, coResearchers[], principalInvestigatorName, institution, programOrCall, areaOfKnowledge, keywords[], budget.',
      'projectStatus solo entre active, completed, suspended.',
      'budget debe ser numero sin simbolos ni separadores de miles.',
    ],
    book: [
      'Extrae para book: bookPublisher, bookIsbn, bookEdition, bookCity, bookCollection, bookTotalPages, bookLanguage, bookPublicationDate.',
      'bookTotalPages debe ser numero entero positivo.',
    ],
    book_chapter: [
      'Extrae para book_chapter: chapterBookTitle, chapterNumber, chapterPages, chapterEditors[], chapterPublisher, chapterIsbn, chapterEdition, chapterLanguage, chapterPublicationDate.',
      'chapterPages conserva formato de rango (ej: 45-67) si asi aparece en el texto.',
    ],
    technical_report: [
      'Extrae para technical_report: reportNumber, reportInstitution, reportType, reportSponsor, reportPublicationDate, reportRevision, reportPages, reportRepositoryUrl, reportAreaOfKnowledge, reportLanguage.',
      'reportType solo entre final, interim, white_paper, manual, other.',
    ],
    software: [
      'Extrae para software: softwareVersion, softwareReleaseDate, softwareRepositoryUrl, softwareLicense, softwareProgrammingLanguage, softwarePlatform, softwareType, softwareRegistrationNumber.',
      'softwareType solo entre desktop, web, mobile, library, other.',
    ],
    patent: [
      'Extrae para patent: patentOffice, patentApplicationNumber, patentPublicationNumber, patentApplicationDate, patentPublicationDate, patentGrantDate, patentStatus, patentAssignee, patentInventors[], patentCountry, patentClassification.',
      'patentStatus solo entre submitted, published, granted, expired.',
    ],
  }

  return [
    'Extraccion especifica por tipo de producto academico (Opcion B: segundo paso especializado).',
    `Tipo objetivo: ${productType}`,
    'Responde exactamente con el esquema estructurado solicitado.',
    'Fechas en ISO 8601 (YYYY-MM-DD). Si solo hay anio usa YYYY-01-01.',
    'No inventes datos. Si no hay evidencia suficiente, omite el campo.',
    'Listas: devuelve arrays limpios sin elementos vacios.',
    ...typeInstructions[productType],
    'Contexto de la primera extraccion comun (usar como pista, no como unica fuente):',
    JSON.stringify(commonExtraction),
    '',
    text.slice(0, 24_000),
  ].join('\n')
}

export async function extractProductSpecificMetadata(input: {
  text: string
  productType: ProductType
  commonExtraction: Pick<
    AcademicEntityExtractionResult,
    'authors' | 'title' | 'institution' | 'date' | 'doi' | 'eventOrJournal'
  >
  traceId?: string
  documentId?: string
}): Promise<ProductSpecificMetadata> {
  const schema = productSpecificSchemas[input.productType]

  const result = await executeStructuredObject(
    buildProductSpecificPrompt(input.text, input.productType, {
      title: input.commonExtraction.title?.value ?? null,
      authors: input.commonExtraction.authors.map((author) => author.value),
      institution: input.commonExtraction.institution?.value ?? null,
      date: input.commonExtraction.date?.value?.toISOString().slice(0, 10) ?? null,
      doi: input.commonExtraction.doi?.value ?? null,
      eventOrJournal: input.commonExtraction.eventOrJournal?.value ?? null,
    }),
    0.25,
    schema,
    { traceId: input.traceId, documentId: input.documentId },
  )

  return result.output
}

async function executeStructuredExtraction(
  prompt: string,
  temperature: number,
  traceContext?: { traceId?: string; documentId?: string },
): Promise<{
  output: AcademicEntityOutput
  provider: StructuredLlmProvider
  modelId: string
  attempts: RuntimeNerAttemptTrace[]
}> {
  return executeStructuredObject(prompt, temperature, academicEntitySchema, traceContext)
}

async function executeStructuredObject<TSchema extends z.ZodTypeAny>(
  prompt: string,
  temperature: number,
  schema: TSchema,
  traceContext?: { traceId?: string; documentId?: string },
): Promise<{
  output: z.infer<TSchema>
  provider: StructuredLlmProvider
  modelId: string
  attempts: RuntimeNerAttemptTrace[]
}> {
  const env = validateEnv(getRuntimeConfigSafe())
  const candidates = getStructuredModelCandidates()
  const maxCandidateAttempts = Math.max(1, Math.min(candidates.length, env.nerMaxCandidateAttempts))
  let lastError: unknown = null
  let attempt = 0
  const attempts: RuntimeNerAttemptTrace[] = []

  const schemaRetryPrompt = [
    'ATENCION: la respuesta previa no cumplio el esquema.',
    'Responde solo con un objeto JSON valido que cumpla exactamente el esquema requerido.',
    'No incluyas campos adicionales ni valores fuera de enum.',
    prompt,
  ].join('\n\n')

  for (const candidate of candidates.slice(0, maxCandidateAttempts)) {
    const candidateStrategies: Array<{ prompt: string; temperature: number; retryPolicy: string }> =
      [{ prompt, temperature, retryPolicy: 'primary' }]

    for (let strategyIndex = 0; strategyIndex < candidateStrategies.length; strategyIndex += 1) {
      const strategy = candidateStrategies.at(strategyIndex)
      if (!strategy) {
        continue
      }

      attempt += 1
      const attemptStart = Date.now()

      try {
        const result = await withTimeout({
          label: `ner_model_request_${candidate.modelId}`,
          timeoutMs: env.nerRequestTimeoutMs,
          run: () =>
            generateText({
              model: candidate.model,
              temperature: strategy.temperature,
              output: Output.object({ schema }),
              prompt: strategy.prompt,
            }),
        })

        const parsedOutput = schema.parse(result.output)

        logPipelineEvent({
          traceId: traceContext?.traceId,
          documentId: traceContext?.documentId,
          stage: 'ner',
          event: 'candidate_succeeded',
          provider: candidate.name,
          modelId: candidate.modelId,
          attempt,
          durationMs: Date.now() - attemptStart,
          metadata: {
            timeoutMs: env.nerRequestTimeoutMs,
            retryPolicy: strategy.retryPolicy,
          },
        })

        attempts.push({
          attempt,
          provider: candidate.name,
          modelId: candidate.modelId,
          status: 'succeeded',
          durationMs: Date.now() - attemptStart,
        })

        return {
          output: parsedOutput,
          provider: candidate.name,
          modelId: candidate.modelId,
          attempts,
        }
      } catch (error) {
        lastError = error
        const classified = classifyPipelineError(error)

        attempts.push({
          attempt,
          provider: candidate.name,
          modelId: candidate.modelId,
          status: 'failed',
          durationMs: Date.now() - attemptStart,
          errorType: classified.errorType,
          errorMessage: truncateAttemptErrorMessage(classified.errorMessage),
        })

        logPipelineEvent({
          traceId: traceContext?.traceId,
          documentId: traceContext?.documentId,
          stage: 'ner',
          event: 'candidate_failed',
          provider: candidate.name,
          modelId: candidate.modelId,
          attempt,
          durationMs: Date.now() - attemptStart,
          errorType: classified.errorType,
          errorMessage: classified.errorMessage,
          metadata: {
            retryPolicy: strategy.retryPolicy,
          },
        })

        if (classified.errorType === 'schema_validation' && strategy.retryPolicy === 'primary') {
          const isLowCapacity =
            candidate.modelId.includes('lite') || candidate.modelId.includes('20b')

          if (isLowCapacity) {
            logPipelineEvent({
              traceId: traceContext?.traceId,
              documentId: traceContext?.documentId,
              stage: 'ner',
              event: 'candidate_retry_discarded_low_capacity',
              provider: candidate.name,
              modelId: candidate.modelId,
              attempt,
              metadata: {
                trigger: classified.errorType,
                reason: 'Model lacks capacity for schema recovery',
              },
            })
          } else {
            candidateStrategies.push({
              prompt: schemaRetryPrompt,
              temperature: Math.min(temperature, 0.15),
              retryPolicy: 'schema_tight_retry',
            })

            logPipelineEvent({
              traceId: traceContext?.traceId,
              documentId: traceContext?.documentId,
              stage: 'ner',
              event: 'candidate_retry_selected',
              provider: candidate.name,
              modelId: candidate.modelId,
              attempt,
              metadata: {
                retryPolicy: 'schema_tight_retry',
                trigger: classified.errorType,
              },
            })
          }
        }
      }
    }
  }

  logPipelineEvent({
    traceId: traceContext?.traceId,
    documentId: traceContext?.documentId,
    stage: 'ner',
    event: 'candidate_budget_exhausted',
    metadata: {
      maxCandidateAttempts,
      availableCandidates: candidates.length,
    },
  })

  const error: StructuredExecutionError =
    lastError instanceof Error ? lastError : new Error('No fue posible extraer entidades')

  error.attempts = attempts
  throw error
}

async function detectProductProfile(text: string): Promise<{
  productType: ProductType
  documentClassification: 'academic' | 'non_academic' | 'uncertain'
  classificationSource: 'heuristic' | 'llm' | 'hybrid'
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
        classificationSource: 'hybrid',
      }
    }

    return {
      productType: modelProductType,
      documentClassification: modelClassification,
      classificationConfidence: modelConfidence,
      classificationRationale: modelRationale ?? heuristic.classificationRationale,
      classificationSource: 'llm',
    }
  } catch (error) {
    const classified = classifyPipelineError(error)
    logPipelineEvent({
      stage: 'ner',
      event: 'classification_fallback_to_heuristic',
      errorType: classified.errorType,
      errorMessage: classified.errorMessage,
      metadata: {
        fallback: 'heuristic',
      },
    })

    return {
      productType: heuristic.productType,
      documentClassification: heuristic.documentClassification,
      classificationConfidence: heuristic.classificationConfidence,
      classificationRationale: heuristic.classificationRationale,
      classificationSource: 'heuristic',
    }
  }
}

export async function extractAcademicEntities(input: {
  text: string
  extractionSource: OcrProvider
  ocrBlocks?: OcrTextBlock[]
  traceId?: string
  documentId?: string
}): Promise<AcademicEntityExtractionResult> {
  const env = validateEnv(getRuntimeConfigSafe())
  const nerStart = Date.now()
  const profile = await detectProductProfile(input.text)
  const detectedProductType = profile.productType
  const ocrBlocks = input.ocrBlocks ?? []

  logPipelineEvent({
    traceId: input.traceId,
    documentId: input.documentId,
    stage: 'ner',
    event: 'start',
    metadata: {
      textLength: input.text.length,
      extractionSource: input.extractionSource,
      threshold: env.nerConfidenceThreshold,
      maxCandidateAttempts: env.nerMaxCandidateAttempts,
    },
  })

  const firstPass = await executeStructuredExtraction(
    buildPrompt(input.text, detectedProductType, false),
    0.2,
    { traceId: input.traceId, documentId: input.documentId },
  )
  const nerAttemptTrace: NerAttemptTraceEntry[] = firstPass.attempts.map((attemptTrace) => ({
    ...attemptTrace,
    scope: 'extraction_first_pass',
  }))

  let selected = firstPass
  let selectedEvaluation = evaluateExtractionCandidate(firstPass.output, detectedProductType)
  const firstPassConfidence = averageConfidence(firstPass.output)

  if (firstPassConfidence < env.nerConfidenceThreshold) {
    logPipelineEvent({
      traceId: input.traceId,
      documentId: input.documentId,
      stage: 'ner',
      event: 'second_pass_triggered',
      provider: firstPass.provider,
      modelId: firstPass.modelId,
      metadata: {
        firstPassConfidence,
        threshold: env.nerConfidenceThreshold,
      },
    })

    try {
      const secondPass = await executeStructuredExtraction(
        buildPrompt(input.text, detectedProductType, true),
        0.35,
        { traceId: input.traceId, documentId: input.documentId },
      )

      const secondPassEvaluation = evaluateExtractionCandidate(
        secondPass.output,
        detectedProductType,
      )

      nerAttemptTrace.push(
        ...secondPass.attempts.map((attemptTrace) => ({
          ...attemptTrace,
          scope: 'extraction_second_pass' as const,
        })),
      )

      if (
        secondPassEvaluation.calibratedConfidence.score >=
        selectedEvaluation.calibratedConfidence.score
      ) {
        selected = secondPass
        selectedEvaluation = secondPassEvaluation
      } else {
        logPipelineEvent({
          traceId: input.traceId,
          documentId: input.documentId,
          stage: 'ner',
          event: 'second_pass_discarded',
          provider: secondPass.provider,
          modelId: secondPass.modelId,
          metadata: {
            firstPassScore: selectedEvaluation.calibratedConfidence.score,
            secondPassScore: secondPassEvaluation.calibratedConfidence.score,
            reason: 'lower_calibrated_confidence',
          },
        })
      }
    } catch (error) {
      const structuredError = error as StructuredExecutionError

      if (Array.isArray(structuredError.attempts) && structuredError.attempts.length > 0) {
        nerAttemptTrace.push(
          ...structuredError.attempts.map((attemptTrace) => ({
            ...attemptTrace,
            scope: 'extraction_second_pass' as const,
          })),
        )
      }

      const classified = classifyPipelineError(error)
      logPipelineEvent({
        traceId: input.traceId,
        documentId: input.documentId,
        stage: 'ner',
        event: 'second_pass_failed',
        provider: firstPass.provider,
        modelId: firstPass.modelId,
        errorType: classified.errorType,
        errorMessage: classified.errorMessage,
        metadata: {
          firstPassConfidence,
          threshold: env.nerConfidenceThreshold,
          fallback: 'kept_first_pass',
        },
      })
    }
  }

  const selectedOutput = selected.output

  const semanticValidation = selectedEvaluation.semanticValidation
  const normalizedTitle = selectedEvaluation.normalizedTitle
  const normalizedInstitution = selectedEvaluation.normalizedInstitution
  const normalizedDate = selectedEvaluation.normalizedDate
  const normalizedDoi = selectedEvaluation.normalizedDoi
  const normalizedEventOrJournal = selectedEvaluation.normalizedEventOrJournal
  const calibratedConfidence = selectedEvaluation.calibratedConfidence

  const extractionConfidence = calibratedConfidence.score

  logPipelineEvent({
    traceId: input.traceId,
    documentId: input.documentId,
    stage: 'ner',
    event: 'completed',
    provider: selected.provider,
    modelId: selected.modelId,
    durationMs: Date.now() - nerStart,
    metadata: {
      extractionConfidence,
      semanticPenalty: calibratedConfidence.semanticPenalty,
      evidenceCoverage: calibratedConfidence.evidenceCoverage,
      semanticReasonsCount: semanticValidation.reasons.length,
      productType: detectedProductType,
      documentClassification: profile.documentClassification,
    },
  })

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
    extractionConfidence,
    evidenceCoverage: calibratedConfidence.evidenceCoverage,
    nerProvider: selected.provider,
    nerModel: selected.modelId,
    nerAttemptTrace,
    extractedAt: new Date(),
    classificationSource: profile.classificationSource,
  }
}
