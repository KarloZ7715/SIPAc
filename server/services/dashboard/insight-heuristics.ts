import type { ProductType } from '~~/app/types'

/** Tipos que pueden servir como “documento hermano” de una ponencia (actas, informe, otra ficha de congreso). */
export const CONFERENCE_COMPANION_PRODUCT_TYPES: ProductType[] = [
  'conference_paper',
  'technical_report',
]

type LeanProductForConference = {
  _id: { toString: () => string }
  productType: ProductType
  owner: unknown
  conferenceAcronym?: string | null
  isbn?: string | null
  proceedingsTitle?: string | null
  eventDate?: Date | null
  manualMetadata?: { date?: Date | null }
  extractedEntities?: { date?: { value?: Date | null } | null }
}

function trimText(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

export function publicationYearFromProduct(p: LeanProductForConference): number | null {
  const raw = p.eventDate ?? p.manualMetadata?.date ?? p.extractedEntities?.date?.value
  if (!raw) {
    return null
  }
  const d = raw instanceof Date ? raw : new Date(raw)
  if (Number.isNaN(d.getTime())) {
    return null
  }
  return d.getUTCFullYear()
}

/**
 * Clave débil mismo propietario + mismo evento/actas (sin esquema de relaciones).
 * Prioridad: ISBN → acrónimo+año → título de actas+año.
 */
export function conferenceProceedingsCompanionKey(p: LeanProductForConference): string | null {
  const owner = String(p.owner)
  const isbn = trimText(p.isbn).replace(/\s+/g, '')
  if (isbn.length > 0) {
    return `${owner}|isbn:${isbn.toLowerCase()}`
  }

  const acronym = trimText(p.conferenceAcronym).toUpperCase()
  const year = publicationYearFromProduct(p)
  if (acronym.length > 0) {
    return `${owner}|acr:${acronym}|y:${year ?? 'none'}`
  }

  const proc = trimText(p.proceedingsTitle).toLowerCase().slice(0, 80)
  if (proc.length > 0) {
    return `${owner}|proc:${proc}|y:${year ?? 'none'}`
  }

  return null
}

export function conferencePaperHasProceedingsSignal(p: LeanProductForConference): boolean {
  return (
    trimText(p.proceedingsTitle).length > 0 ||
    trimText(p.isbn).length > 0 ||
    trimText(p.conferenceAcronym).length > 0
  )
}

/**
 * Cuenta ponencias con señal de actas/memorias que no comparten clave heurística con ningún otro documento candidato.
 */
export function countConferencePapersMissingLikelyCompanion(pool: LeanProductForConference[]): {
  count: number
  sampleIds: string[]
} {
  const keyToIds = new Map<string, Set<string>>()

  for (const doc of pool) {
    if (!CONFERENCE_COMPANION_PRODUCT_TYPES.includes(doc.productType)) {
      continue
    }
    const key = conferenceProceedingsCompanionKey(doc)
    if (!key) {
      continue
    }
    const id = String(doc._id)
    if (!keyToIds.has(key)) {
      keyToIds.set(key, new Set())
    }
    keyToIds.get(key)!.add(id)
  }

  const sampleIds: string[] = []
  let count = 0

  for (const doc of pool) {
    if (doc.productType !== 'conference_paper') {
      continue
    }
    if (!conferencePaperHasProceedingsSignal(doc)) {
      continue
    }
    const key = conferenceProceedingsCompanionKey(doc)
    if (!key) {
      continue
    }
    const ids = keyToIds.get(key)
    if (!ids || ids.size <= 1) {
      count++
      if (sampleIds.length < 3) {
        sampleIds.push(String(doc._id))
      }
    }
  }

  return { count, sampleIds }
}
