import { describe, expect, it } from 'vitest'

describe('normalizePublicationLanguageForMongo', () => {
  it('maps Spanish labels to spanish', async () => {
    const { normalizePublicationLanguageForMongo } =
      await import('../../../server/utils/publication-language')

    expect(normalizePublicationLanguageForMongo('Español')).toBe('spanish')
    expect(normalizePublicationLanguageForMongo('español')).toBe('spanish')
    expect(normalizePublicationLanguageForMongo('ES')).toBe('spanish')
    expect(normalizePublicationLanguageForMongo('Castellano')).toBe('spanish')
  })

  it('returns undefined for empty or unknown', async () => {
    const { normalizePublicationLanguageForMongo } =
      await import('../../../server/utils/publication-language')

    expect(normalizePublicationLanguageForMongo('')).toBeUndefined()
    expect(normalizePublicationLanguageForMongo(null)).toBeUndefined()
    expect(normalizePublicationLanguageForMongo('Klingon')).toBeUndefined()
  })

  it('maps English and French', async () => {
    const { normalizePublicationLanguageForMongo } =
      await import('../../../server/utils/publication-language')

    expect(normalizePublicationLanguageForMongo('English')).toBe('english')
    expect(normalizePublicationLanguageForMongo('Inglés')).toBe('english')
    expect(normalizePublicationLanguageForMongo('Français')).toBe('french')
  })
})
