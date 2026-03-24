import { describe, expect, it } from 'vitest'
import { buildConfirmedRepositoryFilter } from '~~/server/services/products/confirmed-repository-search'

describe('confirmed repository search filters', () => {
  it('amplia la búsqueda por institución a campos específicos de cada subtipo', () => {
    const filter = buildConfirmedRepositoryFilter({
      institution: 'Universidad de Córdoba',
      productType: 'thesis',
    })

    const serialized = JSON.stringify(filter)

    expect(serialized).toContain('manualMetadata.institution')
    expect(serialized).toContain('extractedEntities.institution.value')
    expect(serialized).toContain('university')
    expect(serialized).toContain('degreeGrantor')
    expect(serialized).toContain('publisher')
    expect(serialized).toContain('eventSponsor')
    expect(serialized).toContain('reportInstitution')
    expect(serialized).toContain('issuingEntity')
  })

  it('usa búsqueda regex amplia para search en vez de depender solo de $text', () => {
    const filter = buildConfirmedRepositoryFilter({
      search: 'inteligencia artificial educativa',
    })

    const serialized = JSON.stringify(filter)

    expect(serialized).toContain('manualMetadata.title')
    expect(serialized).toContain('manualMetadata.authors')
    expect(serialized).toContain('manualMetadata.keywords')
    expect(serialized).toContain('journalName')
    expect(serialized).toContain('proceedingsTitle')
    expect(serialized).not.toContain('"$text"')
  })
})
