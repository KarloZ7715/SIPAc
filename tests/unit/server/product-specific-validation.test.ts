import { describe, expect, it } from 'vitest'
import { validateProductSpecificMetadata } from '../../../server/services/ner/product-specific-validation'

describe('validateProductSpecificMetadata', () => {
  it('drops invalid enum and page range fields for article', () => {
    const result = validateProductSpecificMetadata({
      productType: 'article',
      metadata: {
        articleType: 'editorial',
        pages: 'pp. 1-10',
        journalName: 'Revista Demo',
      },
    })

    expect(result.sanitized.articleType).toBeUndefined()
    expect(result.sanitized.pages).toBeUndefined()
    expect(result.sanitized.journalName).toBe('Revista Demo')
    expect(result.droppedFields).toEqual(expect.arrayContaining(['articleType', 'pages']))
  })

  it('drops invalid url and non-integer pages for thesis', () => {
    const result = validateProductSpecificMetadata({
      productType: 'thesis',
      metadata: {
        repositoryUrl: 'ftp://repo.local/thesis',
        pages: 120.5,
        thesisLevel: 'maestria',
      },
    })

    expect(result.sanitized.repositoryUrl).toBeUndefined()
    expect(result.sanitized.pages).toBeUndefined()
    expect(result.sanitized.thesisLevel).toBe('maestria')
    expect(result.droppedFields).toEqual(expect.arrayContaining(['repositoryUrl', 'pages']))
  })

  it('drops invalid enum for patent status and inconsistent grant date', () => {
    const result = validateProductSpecificMetadata({
      productType: 'patent',
      metadata: {
        patentStatus: 'approved',
        patentApplicationDate: '2026-03-10',
        patentGrantDate: '2026-02-10',
      },
    })

    expect(result.sanitized.patentStatus).toBeUndefined()
    expect(result.sanitized.patentGrantDate).toBeUndefined()
    expect(result.droppedFields).toEqual(
      expect.arrayContaining(['patentStatus', 'patentGrantDate']),
    )
  })
})
