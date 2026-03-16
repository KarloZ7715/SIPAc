import { describe, expect, it } from 'vitest'
import {
  normalizeDoiCandidate,
  normalizeIsoDateCandidate,
  applySemanticValidation,
} from '../../../server/services/ner/semantic-validation'

describe('semantic-validation', () => {
  describe('normalizeDoiCandidate', () => {
    it('normalizes valid DOIs to lowercase without prefixes', () => {
      expect(normalizeDoiCandidate('10.1234/EX.2026.001')).toBe('10.1234/ex.2026.001')
      expect(normalizeDoiCandidate('doi: 10.1234/abcd')).toBe('10.1234/abcd')
      expect(normalizeDoiCandidate('https://doi.org/10.1234/abcd')).toBe('10.1234/abcd')
      expect(normalizeDoiCandidate('http://dx.doi.org/10.1234/abcd')).toBe('10.1234/abcd')
    })

    it('returns undefined for invalid DOIs', () => {
      expect(normalizeDoiCandidate('invalid-doi')).toBeUndefined()
      expect(normalizeDoiCandidate(null)).toBeUndefined()
      expect(normalizeDoiCandidate('')).toBeUndefined()
    })
  })

  describe('normalizeIsoDateCandidate', () => {
    it('parses valid ISO dates', () => {
      expect(normalizeIsoDateCandidate('2026-03-16')?.toISOString()).toMatch(/^2026-03-16/)
      expect(normalizeIsoDateCandidate('2026')?.toISOString()).toMatch(/^2026-01-01/)
    })

    it('returns undefined for invalid dates', () => {
      expect(normalizeIsoDateCandidate('16/03/2026')).toBeUndefined()
      expect(normalizeIsoDateCandidate('2026-13-45')).toBeUndefined()
      expect(normalizeIsoDateCandidate('not-a-date')).toBeUndefined()
      expect(normalizeIsoDateCandidate(null)).toBeUndefined()
    })
  })

  describe('applySemanticValidation', () => {
    it('applies penalties for invalid DOI and Date', () => {
      const result = applySemanticValidation(
        {
          title: 'Test',
          institution: 'Test Inst',
          date: 'invalid-date',
          doi: 'invalid-doi',
          eventOrJournal: null,
        },
        'article',
      )

      expect(result.penalties.doi).toBe(0.25)
      expect(result.penalties.date).toBe(0.2)
      expect(result.penalties.eventOrJournal).toBe(0.15)
      expect(result.reasons).toHaveLength(3)
      expect(result.sanitized.doi).toBeNull()
      expect(result.sanitized.date).toBeNull()
    })

    it('penalizes eventOrJournal when it is present for types that do not use it', () => {
      const result = applySemanticValidation(
        {
          title: 'Test Thesis',
          institution: 'Test Inst',
          date: '2026-03-16',
          doi: null,
          eventOrJournal: 'Some Journal',
        },
        'thesis',
      )

      expect(result.penalties.eventOrJournal).toBe(0.15)
      expect(result.reasons[0]).toMatch(/no aplica para productType/)
    })

    it('penalizes eventOrJournal when it looks like a conference but type is article', () => {
      const result = applySemanticValidation(
        {
          title: 'Test',
          institution: 'Test Inst',
          date: '2026-03-16',
          doi: '10.1234/abcd',
          eventOrJournal: 'Congreso Internacional de Prueba',
        },
        'article',
      )

      expect(result.penalties.eventOrJournal).toBe(0.2)
      expect(result.reasons[0]).toMatch(/parece evento/)
    })

    it('penalizes eventOrJournal when it looks like a journal but type is conference_paper', () => {
      const result = applySemanticValidation(
        {
          title: 'Test',
          institution: 'Test Inst',
          date: '2026-03-16',
          doi: '10.1234/abcd',
          eventOrJournal: 'Revista Internacional de Prueba',
        },
        'conference_paper',
      )

      expect(result.penalties.eventOrJournal).toBe(0.2)
      expect(result.reasons[0]).toMatch(/parece revista/)
    })

    it('does not penalize valid data', () => {
      const result = applySemanticValidation(
        {
          title: 'Test Article',
          institution: 'Test Inst',
          date: '2026-03-16',
          doi: '10.1234/abcd',
          eventOrJournal: 'Revista de Prueba',
        },
        'article',
      )

      expect(result.penalties.doi).toBe(0)
      expect(result.penalties.date).toBe(0)
      expect(result.penalties.eventOrJournal).toBe(0)
      expect(result.reasons).toHaveLength(0)
      expect(result.sanitized.doi).toBe('10.1234/abcd')
      expect(result.sanitized.date).toBe('2026-03-16')
      expect(result.sanitized.eventOrJournal).toBe('Revista de Prueba')
    })
  })
})
