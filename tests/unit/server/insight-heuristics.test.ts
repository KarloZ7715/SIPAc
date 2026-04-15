import { describe, expect, it } from 'vitest'
import {
  conferenceProceedingsCompanionKey,
  conferencePaperHasProceedingsSignal,
  countConferencePapersMissingLikelyCompanion,
  publicationYearFromProduct,
} from '~~/server/services/dashboard/insight-heuristics'

describe('insight-heuristics', () => {
  it('publicationYearFromProduct lee eventDate primero', () => {
    expect(
      publicationYearFromProduct({
        _id: { toString: () => 'a' },
        productType: 'conference_paper',
        owner: '507f191e810c19729de860e1',
        eventDate: new Date('2024-06-01T00:00:00.000Z'),
      }),
    ).toBe(2024)
  })

  it('conferenceProceedingsCompanionKey prioriza ISBN', () => {
    const key = conferenceProceedingsCompanionKey({
      _id: { toString: () => 'a' },
      productType: 'conference_paper',
      owner: '507f191e810c19729de860e1',
      isbn: '978-0-12',
      conferenceAcronym: 'ABC',
      eventDate: new Date('2024-01-01'),
    })
    expect(key).toBe('507f191e810c19729de860e1|isbn:978-0-12')
  })

  it('conferencePaperHasProceedingsSignal detecta cualquier señal', () => {
    expect(
      conferencePaperHasProceedingsSignal({
        _id: { toString: () => 'a' },
        productType: 'conference_paper',
        owner: 'x',
        proceedingsTitle: '  ',
        isbn: '',
        conferenceAcronym: 'X',
      }),
    ).toBe(true)
    expect(
      conferencePaperHasProceedingsSignal({
        _id: { toString: () => 'a' },
        productType: 'conference_paper',
        owner: 'x',
      }),
    ).toBe(false)
  })

  it('countConferencePapersMissingLikelyCompanion exige otro documento con misma clave', () => {
    const owner = '507f191e810c19729de860e1'
    const pool = [
      {
        _id: { toString: () => 'p1' },
        productType: 'conference_paper' as const,
        owner,
        conferenceAcronym: 'SIG',
        eventDate: new Date('2024-01-01'),
      },
      {
        _id: { toString: () => 'r1' },
        productType: 'technical_report' as const,
        owner,
        conferenceAcronym: 'SIG',
        eventDate: new Date('2024-01-01'),
      },
    ]
    expect(countConferencePapersMissingLikelyCompanion(pool).count).toBe(0)

    const solo = [
      {
        _id: { toString: () => 'p1' },
        productType: 'conference_paper' as const,
        owner,
        conferenceAcronym: 'SIG',
        eventDate: new Date('2024-01-01'),
      },
    ]
    expect(countConferencePapersMissingLikelyCompanion(solo).count).toBe(1)
  })
})
