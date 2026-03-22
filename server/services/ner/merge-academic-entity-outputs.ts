import type { ProductType } from '~~/app/types'

export interface AcademicEntityStructuredOutput {
  authors: string[]
  title: string | null
  institution: string | null
  date: string | null
  keywords: string[]
  doi: string | null
  eventOrJournal: string | null
  confidence: {
    authors: number
    title: number
    institution: number
    date: number
    keywords: number
    doi: number
    eventOrJournal: number
  }
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === 'string' && normalizeWhitespace(value).length > 0
}

function mergeUniqueByKey(
  primary: string[],
  secondary: string[],
  keyFn: (s: string) => string,
): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of [...primary, ...secondary]) {
    const normalized = normalizeWhitespace(raw)
    if (!normalized) continue
    const key = keyFn(normalized)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }
  return result
}

function pickScalarField(
  a: string | null,
  b: string | null,
  confA: number,
  confB: number,
): { value: string | null; confidence: number } {
  const hasA = isNonEmptyString(a)
  const hasB = isNonEmptyString(b)
  if (!hasA && !hasB) {
    return { value: null, confidence: Math.min(confA, confB) }
  }
  if (!hasB) {
    return { value: normalizeWhitespace(a!), confidence: confA }
  }
  if (!hasA) {
    return { value: normalizeWhitespace(b!), confidence: confB }
  }

  const na = normalizeWhitespace(a!)
  const nb = normalizeWhitespace(b!)
  if (na === nb) {
    return { value: na, confidence: Math.max(confA, confB) }
  }

  return confA >= confB ? { value: na, confidence: confA } : { value: nb, confidence: confB }
}

export function mergeAcademicEntityOutputs(
  first: AcademicEntityStructuredOutput,
  second: AcademicEntityStructuredOutput,
): AcademicEntityStructuredOutput {
  const authors = mergeUniqueByKey(first.authors, second.authors, (s) => s.toLowerCase())
  const keywords = mergeUniqueByKey(first.keywords, second.keywords, (s) => s.toLowerCase())

  const authorsConfidence =
    first.authors.length > 0 && second.authors.length > 0
      ? Math.min(first.confidence.authors, second.confidence.authors)
      : first.authors.length > 0
        ? first.confidence.authors
        : second.confidence.authors

  const keywordsConfidence =
    first.keywords.length > 0 && second.keywords.length > 0
      ? Math.min(first.confidence.keywords, second.confidence.keywords)
      : first.keywords.length > 0
        ? first.confidence.keywords
        : second.confidence.keywords

  const title = pickScalarField(
    first.title,
    second.title,
    first.confidence.title,
    second.confidence.title,
  )
  const institution = pickScalarField(
    first.institution,
    second.institution,
    first.confidence.institution,
    second.confidence.institution,
  )
  const date = pickScalarField(
    first.date,
    second.date,
    first.confidence.date,
    second.confidence.date,
  )
  const doi = pickScalarField(first.doi, second.doi, first.confidence.doi, second.confidence.doi)
  const eventOrJournal = pickScalarField(
    first.eventOrJournal,
    second.eventOrJournal,
    first.confidence.eventOrJournal,
    second.confidence.eventOrJournal,
  )

  return {
    authors,
    title: title.value,
    institution: institution.value,
    date: date.value,
    keywords,
    doi: doi.value,
    eventOrJournal: eventOrJournal.value,
    confidence: {
      authors: authorsConfidence,
      title: title.confidence,
      institution: institution.confidence,
      date: date.confidence,
      keywords: keywordsConfidence,
      doi: doi.confidence,
      eventOrJournal: eventOrJournal.confidence,
    },
  }
}

const KEYWORD_SECTION_RE = /\bpalabras\s+clave\b|\bkeywords\b|\bindex\s+terms\b/i

function hasNonEmptyScalar(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Dispara segunda pasada comun cuando el OCR sugiere metadatos que la primera pasada no reflejo
 * (no solo autores/palabras clave: titulo, institucion, evento/revista, fechas, etc. segun tipo).
 */
export function shouldForceSecondPassForCompleteness(
  text: string,
  output: AcademicEntityStructuredOutput,
  productType: ProductType,
): boolean {
  const window = text.slice(0, 24_000)

  if (output.authors.length <= 1) {
    const multiAuthorCue =
      /\bet\s+al\.?\b/i.test(window) ||
      /\b(and|y)\s+[A-ZÁÉÍÓÚÑ]/i.test(window) ||
      /;\s*[A-ZÁÉÍÓÚÑ]/.test(window)
    const listCue = /[,;]/.test(window)
    if (multiAuthorCue && listCue) {
      return true
    }
  }

  if (KEYWORD_SECTION_RE.test(window) && output.keywords.length < 2) {
    return true
  }

  if (productType === 'conference_paper') {
    const eventCue =
      /\b(congreso|conference|simposio|symposium|encuentro|colloquium|proceedings|memorias|actas)\b/i.test(
        window,
      )
    if (eventCue && !hasNonEmptyScalar(output.eventOrJournal)) {
      return true
    }
  }

  if (productType === 'article') {
    const journalCue =
      /\b(issn|vol\.|volume|volumen|issue|numero|n[úu]m\.|revista|journal)\b/i.test(window)
    if (journalCue && !hasNonEmptyScalar(output.eventOrJournal)) {
      return true
    }
  }

  if (productType === 'thesis') {
    const thesisCue =
      /\b(tesis|dissertation|trabajo\s+de\s+grado|director|jurado|sustentaci[oó]n)\b/i.test(window)
    if (thesisCue && !hasNonEmptyScalar(output.institution)) {
      return true
    }
  }

  if (productType === 'certificate') {
    const certCue =
      /\b(certifica|constancia|diploma|horas\s+de|participaci[oó]n|asistencia)\b/i.test(window)
    if (certCue && !hasNonEmptyScalar(output.institution)) {
      return true
    }
  }

  if (productType === 'research_project') {
    const projCue =
      /\b(proyecto\s+de\s+investigaci[oó]n|investigador\s+principal|codigo\s+de\s+proyecto|convocatoria)\b/i.test(
        window,
      )
    if (projCue && !hasNonEmptyScalar(output.institution)) {
      return true
    }
  }

  if (productType === 'book') {
    const bookCue = /\b(isbn|editorial|ediciones?|libro)\b/i.test(window)
    if (bookCue && !hasNonEmptyScalar(output.title)) {
      return true
    }
  }

  if (productType === 'book_chapter') {
    const chCue = /\b(cap[ií]tulo|chapter|en:\s|editado\s+por|editors?|compiladores?)\b/i.test(
      window,
    )
    if (chCue && !hasNonEmptyScalar(output.title)) {
      return true
    }
  }

  if (productType === 'technical_report') {
    const repCue =
      /\b(reporte\s+t[eé]cnico|technical\s+report|informe\s+t[eé]cnico|white\s+paper)\b/i.test(
        window,
      )
    if (repCue && !hasNonEmptyScalar(output.institution)) {
      return true
    }
  }

  if (productType === 'software') {
    const softCue =
      /\b(version|v\d+\.|github\.com|gitlab\.com|repositorio|licencia|release\s+notes)\b/i.test(
        window,
      )
    if (softCue && !hasNonEmptyScalar(output.institution)) {
      return true
    }
  }

  if (productType === 'patent') {
    const patCue = /\b(patente|solicitud|application\s+no|inventor|ipc|cpc)\b/i.test(window)
    if (patCue && output.authors.length <= 1 && /\b(and|y)\s+[A-ZÁÉÍÓÚÑ]/i.test(window)) {
      return true
    }
  }

  return false
}
