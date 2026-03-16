import type { ProductType } from '~~/app/types'

export interface ProductSpecificValidationResult {
  sanitized: Record<string, unknown>
  droppedFields: string[]
  corrections: string[]
}

const THESIS_LEVELS = new Set(['pregrado', 'maestria', 'especializacion', 'doctorado'])
const THESIS_MODALITIES = new Set(['investigacion', 'monografia', 'proyecto_aplicado', 'otro'])
const CERTIFICATE_TYPES = new Set(['participacion', 'ponente', 'asistencia', 'instructor', 'otro'])
const CERTIFICATE_MODALITIES = new Set(['presencial', 'virtual', 'hibrida'])
const ARTICLE_TYPES = new Set(['original', 'revision', 'corto', 'carta', 'otro'])
const PRESENTATION_TYPES = new Set(['oral', 'poster', 'workshop', 'keynote'])
const REPORT_TYPES = new Set(['final', 'interim', 'white_paper', 'manual', 'other'])
const SOFTWARE_TYPES = new Set(['desktop', 'web', 'mobile', 'library', 'other'])
const PATENT_STATUS_VALUES = new Set(['submitted', 'published', 'granted', 'expired'])
const PROJECT_STATUS_VALUES = new Set(['active', 'completed', 'suspended'])

const PAGE_RANGE_PATTERN = /^\d+(-\d+)?$/
const HTTP_URL_PATTERN = /^https?:\/\//i

function toIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }

  return parsed.toISOString().slice(0, 10)
}

function toPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(value)) {
    return undefined
  }

  return Number.isInteger(value) && value > 0 ? value : undefined
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function dropField(
  sanitized: Record<string, unknown>,
  droppedFields: string[],
  corrections: string[],
  field: string,
  reason: string,
) {
  sanitized[field] = undefined
  droppedFields.push(field)
  corrections.push(reason)
}

function validateEnumField(input: {
  sanitized: Record<string, unknown>
  droppedFields: string[]
  corrections: string[]
  field: string
  allowed: Set<string>
  reason: string
}) {
  const value = input.sanitized[input.field]
  if (!isNonEmptyString(value)) {
    return
  }

  if (!input.allowed.has(value)) {
    dropField(input.sanitized, input.droppedFields, input.corrections, input.field, input.reason)
  }
}

function validatePageRangeField(input: {
  sanitized: Record<string, unknown>
  droppedFields: string[]
  corrections: string[]
  field: string
  reason: string
}) {
  const value = input.sanitized[input.field]
  if (!isNonEmptyString(value)) {
    return
  }

  if (!PAGE_RANGE_PATTERN.test(value.trim())) {
    dropField(input.sanitized, input.droppedFields, input.corrections, input.field, input.reason)
  }
}

function validateHttpUrlField(input: {
  sanitized: Record<string, unknown>
  droppedFields: string[]
  corrections: string[]
  field: string
  reason: string
}) {
  const value = input.sanitized[input.field]
  if (!isNonEmptyString(value)) {
    return
  }

  if (!HTTP_URL_PATTERN.test(value.trim())) {
    dropField(input.sanitized, input.droppedFields, input.corrections, input.field, input.reason)
  }
}

function validatePositiveIntegerField(input: {
  sanitized: Record<string, unknown>
  droppedFields: string[]
  corrections: string[]
  field: string
  reason: string
}) {
  const value = input.sanitized[input.field]
  if (value === undefined) {
    return
  }

  if (toPositiveInteger(value) === undefined) {
    dropField(input.sanitized, input.droppedFields, input.corrections, input.field, input.reason)
  }
}

function validateIssnField(input: {
  sanitized: Record<string, unknown>
  droppedFields: string[]
  corrections: string[]
  field: string
  reason: string
}) {
  const value = input.sanitized[input.field]
  if (!isNonEmptyString(value)) return

  const cleaned = value.trim().replace(/^issn\s*:\s*/i, '')
  if (!/^\d{4}-\d{3}[\dxX]$/i.test(cleaned)) {
    dropField(input.sanitized, input.droppedFields, input.corrections, input.field, input.reason)
  } else {
    input.sanitized[input.field] = cleaned.toUpperCase()
  }
}

function validateIsbnField(input: {
  sanitized: Record<string, unknown>
  droppedFields: string[]
  corrections: string[]
  field: string
  reason: string
}) {
  const value = input.sanitized[input.field]
  if (!isNonEmptyString(value)) return

  const cleaned = value.trim().replace(/^isbn\s*:\s*/i, '')
  const withoutHyphens = cleaned.replace(/-/g, '')

  if (!/^(?:97[89])?\d{9}[\dxX]$/i.test(withoutHyphens)) {
    dropField(input.sanitized, input.droppedFields, input.corrections, input.field, input.reason)
  } else {
    input.sanitized[input.field] = cleaned.toUpperCase()
  }
}

export function validateProductSpecificMetadata(input: {
  productType: ProductType
  metadata: Record<string, unknown>
}): ProductSpecificValidationResult {
  const sanitized = { ...input.metadata }
  const droppedFields: string[] = []
  const corrections: string[] = []

  if (input.productType === 'thesis') {
    const thesisLevel =
      typeof sanitized.thesisLevel === 'string' ? sanitized.thesisLevel : undefined

    if (thesisLevel && !THESIS_LEVELS.has(thesisLevel)) {
      dropField(
        sanitized,
        droppedFields,
        corrections,
        'thesisLevel',
        'thesisLevel fuera de enum permitido',
      )
    }

    validateEnumField({
      sanitized,
      droppedFields,
      corrections,
      field: 'modality',
      allowed: THESIS_MODALITIES,
      reason: 'modality fuera de enum permitido',
    })

    validateHttpUrlField({
      sanitized,
      droppedFields,
      corrections,
      field: 'repositoryUrl',
      reason: 'repositoryUrl no inicia con http(s)://',
    })

    validatePositiveIntegerField({
      sanitized,
      droppedFields,
      corrections,
      field: 'pages',
      reason: 'pages no es entero positivo',
    })
  }

  if (input.productType === 'article') {
    validateEnumField({
      sanitized,
      droppedFields,
      corrections,
      field: 'articleType',
      allowed: ARTICLE_TYPES,
      reason: 'articleType fuera de enum permitido',
    })

    validatePageRangeField({
      sanitized,
      droppedFields,
      corrections,
      field: 'pages',
      reason: 'pages no cumple formato de rango',
    })

    validateIssnField({
      sanitized,
      droppedFields,
      corrections,
      field: 'issn',
      reason: 'issn no cumple formato ####-####',
    })
  }

  if (input.productType === 'conference_paper') {
    validateEnumField({
      sanitized,
      droppedFields,
      corrections,
      field: 'presentationType',
      allowed: PRESENTATION_TYPES,
      reason: 'presentationType fuera de enum permitido',
    })

    validatePageRangeField({
      sanitized,
      droppedFields,
      corrections,
      field: 'pages',
      reason: 'pages no cumple formato de rango',
    })

    validateIsbnField({
      sanitized,
      droppedFields,
      corrections,
      field: 'isbn',
      reason: 'isbn no cumple formato valido',
    })
  }

  if (input.productType === 'certificate') {
    validateEnumField({
      sanitized,
      droppedFields,
      corrections,
      field: 'certificateType',
      allowed: CERTIFICATE_TYPES,
      reason: 'certificateType fuera de enum permitido',
    })

    validateEnumField({
      sanitized,
      droppedFields,
      corrections,
      field: 'modality',
      allowed: CERTIFICATE_MODALITIES,
      reason: 'modality fuera de enum permitido',
    })
  }

  if (input.productType === 'research_project') {
    validateEnumField({
      sanitized,
      droppedFields,
      corrections,
      field: 'projectStatus',
      allowed: PROJECT_STATUS_VALUES,
      reason: 'projectStatus fuera de enum permitido',
    })
  }

  if (input.productType === 'book') {
    validatePositiveIntegerField({
      sanitized,
      droppedFields,
      corrections,
      field: 'bookTotalPages',
      reason: 'bookTotalPages no es entero positivo',
    })

    validateIsbnField({
      sanitized,
      droppedFields,
      corrections,
      field: 'bookIsbn',
      reason: 'bookIsbn no cumple formato valido',
    })
  }

  if (input.productType === 'book_chapter') {
    validatePageRangeField({
      sanitized,
      droppedFields,
      corrections,
      field: 'chapterPages',
      reason: 'chapterPages no cumple formato de rango',
    })

    validateIsbnField({
      sanitized,
      droppedFields,
      corrections,
      field: 'chapterIsbn',
      reason: 'chapterIsbn no cumple formato valido',
    })
  }

  if (input.productType === 'technical_report') {
    const reportPages = toPositiveInteger(sanitized.reportPages)

    if (sanitized.reportPages !== undefined && reportPages === undefined) {
      dropField(
        sanitized,
        droppedFields,
        corrections,
        'reportPages',
        'reportPages no es entero positivo',
      )
    }

    validateEnumField({
      sanitized,
      droppedFields,
      corrections,
      field: 'reportType',
      allowed: REPORT_TYPES,
      reason: 'reportType fuera de enum permitido',
    })

    validateHttpUrlField({
      sanitized,
      droppedFields,
      corrections,
      field: 'reportRepositoryUrl',
      reason: 'reportRepositoryUrl no inicia con http(s)://',
    })
  }

  if (input.productType === 'software') {
    validateEnumField({
      sanitized,
      droppedFields,
      corrections,
      field: 'softwareType',
      allowed: SOFTWARE_TYPES,
      reason: 'softwareType fuera de enum permitido',
    })

    validateHttpUrlField({
      sanitized,
      droppedFields,
      corrections,
      field: 'softwareRepositoryUrl',
      reason: 'softwareRepositoryUrl no inicia con http(s)://',
    })
  }

  if (input.productType === 'patent') {
    const applicationDate = toIsoDate(sanitized.patentApplicationDate)
    const grantDate = toIsoDate(sanitized.patentGrantDate)

    if (applicationDate && grantDate && grantDate < applicationDate) {
      dropField(
        sanitized,
        droppedFields,
        corrections,
        'patentGrantDate',
        'patentGrantDate anterior a patentApplicationDate',
      )
    }

    validateEnumField({
      sanitized,
      droppedFields,
      corrections,
      field: 'patentStatus',
      allowed: PATENT_STATUS_VALUES,
      reason: 'patentStatus fuera de enum permitido',
    })
  }

  const compactSanitized = Object.fromEntries(
    Object.entries(sanitized).filter(([, value]) => value !== undefined),
  )

  return {
    sanitized: compactSanitized,
    droppedFields,
    corrections,
  }
}
