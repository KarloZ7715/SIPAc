import type { ProductType } from '~~/app/types'

export interface CommonMetadataCandidate {
  title: string | null
  institution: string | null
  date: string | null
  doi: string | null
  eventOrJournal: string | null
}

export interface SemanticValidationResult {
  sanitized: CommonMetadataCandidate
  penalties: {
    doi: number
    date: number
    eventOrJournal: number
  }
  reasons: string[]
}

const DOI_PATTERN = /10\.\d{4,9}\/[-._;()/:a-z0-9]+/i
const JOURNAL_HINTS = /(journal|revista|issn|vol\.|volume|issue|numero|n\.)/i
const CONFERENCE_HINTS = /(congreso|conference|symposium|simposio|proceedings|workshop|summit)/i

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export function normalizeDoiCandidate(value: string | null | undefined): string | undefined {
  const normalized = normalizeOptionalString(value)
  if (!normalized) {
    return undefined
  }

  const cleaned = normalized
    .replace(/^doi\s*:\s*/i, '')
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .trim()

  const match = cleaned.match(DOI_PATTERN)
  if (!match) {
    return undefined
  }

  return match[0].toLowerCase()
}

export function normalizeIsoDateCandidate(value: string | null | undefined): Date | undefined {
  const normalized = normalizeOptionalString(value)
  if (!normalized) {
    return undefined
  }

  const yearOnlyMatch = normalized.match(/^(\d{4})$/)
  if (yearOnlyMatch) {
    return new Date(`${yearOnlyMatch[1]}-01-01`)
  }

  const fullDateMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!fullDateMatch) {
    return undefined
  }

  const parsed = new Date(
    `${fullDateMatch[1]}-${fullDateMatch[2]}-${fullDateMatch[3]}T00:00:00.000Z`,
  )
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }

  if (parsed.toISOString().slice(0, 10) !== normalized) {
    return undefined
  }

  return parsed
}

function applyEventRules(
  productType: ProductType,
  value: string | null,
): {
  normalized: string | null
  penalty: number
  reason?: string
} {
  const normalized = normalizeOptionalString(value)

  if (!normalized) {
    if (productType === 'article') {
      return {
        normalized: null,
        penalty: 0.15,
        reason: 'eventOrJournal vacio para productType article',
      }
    }
    return { normalized: null, penalty: 0 }
  }

  const typesWithoutEventOrJournal: ProductType[] = [
    'thesis',
    'book',
    'research_project',
    'software',
    'patent',
  ]

  if (typesWithoutEventOrJournal.includes(productType)) {
    return {
      normalized,
      penalty: 0.15,
      reason: `eventOrJournal extraido pero no aplica para productType ${productType}`,
    }
  }

  if (
    productType === 'article' &&
    CONFERENCE_HINTS.test(normalized) &&
    !JOURNAL_HINTS.test(normalized)
  ) {
    return {
      normalized,
      penalty: 0.2,
      reason: 'eventOrJournal parece evento para productType article',
    }
  }

  if (
    productType === 'conference_paper' &&
    JOURNAL_HINTS.test(normalized) &&
    !CONFERENCE_HINTS.test(normalized)
  ) {
    return {
      normalized,
      penalty: 0.2,
      reason: 'eventOrJournal parece revista para productType conference_paper',
    }
  }

  return { normalized, penalty: 0 }
}

export function applySemanticValidation(
  candidate: CommonMetadataCandidate,
  productType: ProductType,
): SemanticValidationResult {
  const penalties = {
    doi: 0,
    date: 0,
    eventOrJournal: 0,
  }
  const reasons: string[] = []

  const normalizedDoi = normalizeDoiCandidate(candidate.doi)
  if (candidate.doi && !normalizedDoi) {
    penalties.doi = 0.25
    reasons.push('doi invalido o sin formato canonico')
  }

  const normalizedDate = normalizeIsoDateCandidate(candidate.date)
  if (candidate.date && !normalizedDate) {
    penalties.date = 0.2
    reasons.push('date invalida o no parseable en ISO 8601')
  }

  const eventCheck = applyEventRules(productType, candidate.eventOrJournal)
  if (eventCheck.reason) {
    penalties.eventOrJournal = eventCheck.penalty
    reasons.push(eventCheck.reason)
  }

  return {
    sanitized: {
      title: normalizeOptionalString(candidate.title),
      institution: normalizeOptionalString(candidate.institution),
      date: normalizedDate ? normalizedDate.toISOString().slice(0, 10) : null,
      doi: normalizedDoi ?? null,
      eventOrJournal: eventCheck.normalized,
    },
    penalties,
    reasons,
  }
}
