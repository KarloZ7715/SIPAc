import { describe, expect, it } from 'vitest'

import {
  mergeAcademicEntityOutputs,
  shouldForceSecondPassForCompleteness,
} from '../../../server/services/ner/merge-academic-entity-outputs'

const baseConfidence = {
  authors: 0.9,
  title: 0.9,
  institution: 0.85,
  date: 0.88,
  keywords: 0.87,
  doi: 0.86,
  eventOrJournal: 0.84,
}

describe('mergeAcademicEntityOutputs', () => {
  it('une autores y palabras clave sin duplicar', () => {
    const first = {
      authors: ['Ana Perez'],
      title: 'Titulo largo',
      institution: 'Univ A',
      date: '2026-01-01',
      keywords: ['ia'],
      doi: '10.1/a',
      eventOrJournal: 'Revista X',
      confidence: { ...baseConfidence },
    }
    const second = {
      authors: ['Ana Perez', 'Luis Gomez'],
      title: 'Titulo largo',
      institution: 'Univ B',
      date: '2026-01-01',
      keywords: ['ia', 'educacion'],
      doi: '10.1/a',
      eventOrJournal: 'Revista X',
      confidence: { ...baseConfidence, authors: 0.92, keywords: 0.91 },
    }

    const merged = mergeAcademicEntityOutputs(first, second)
    expect(merged.authors).toEqual(['Ana Perez', 'Luis Gomez'])
    expect(merged.keywords.sort()).toEqual(['educacion', 'ia'].sort())
    expect(merged.confidence.authors).toBe(Math.min(0.9, 0.92))
    expect(merged.confidence.keywords).toBe(Math.min(0.87, 0.91))
  })

  it('elige el titulo con mayor confianza cuando difieren', () => {
    const first = {
      authors: ['A'],
      title: 'Corto',
      institution: null,
      date: null,
      keywords: [],
      doi: null,
      eventOrJournal: null,
      confidence: { ...baseConfidence, title: 0.5 },
    }
    const second = {
      authors: ['A'],
      title: 'Titulo completo del documento',
      institution: null,
      date: null,
      keywords: [],
      doi: null,
      eventOrJournal: null,
      confidence: { ...baseConfidence, title: 0.95 },
    }

    const merged = mergeAcademicEntityOutputs(first, second)
    expect(merged.title).toBe('Titulo completo del documento')
    expect(merged.confidence.title).toBe(0.95)
  })
})

describe('shouldForceSecondPassForCompleteness', () => {
  it('pide segunda pasada con un autor y senales de lista', () => {
    const output = {
      authors: ['Solo'],
      title: null,
      institution: null,
      date: null,
      keywords: [],
      doi: null,
      eventOrJournal: null,
      confidence: baseConfidence,
    }
    const text =
      'Autores: Ana Perez, Luis Gomez y Maria Lopez. Palabras clave: prueba. Universidad Demo.'
    expect(shouldForceSecondPassForCompleteness(text, output, 'article')).toBe(true)
  })

  it('no fuerza si ya hay varios autores', () => {
    const output = {
      authors: ['A', 'B'],
      title: null,
      institution: null,
      date: null,
      keywords: [],
      doi: null,
      eventOrJournal: null,
      confidence: baseConfidence,
    }
    expect(shouldForceSecondPassForCompleteness('Ana, Luis y Maria', output, 'article')).toBe(false)
  })

  it('fuerza segunda pasada en ponencia si hay congreso pero falta nombre de evento', () => {
    const output = {
      authors: ['X'],
      title: 'Mi ponencia',
      institution: 'Univ',
      date: '2026-01-01',
      keywords: ['ia'],
      doi: null,
      eventOrJournal: null,
      confidence: baseConfidence,
    }
    const text = 'Presentado en el IV Congreso Internacional de Educacion. Memorias 2025.'
    expect(shouldForceSecondPassForCompleteness(text, output, 'conference_paper')).toBe(true)
  })
})
