import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

interface EvalCase {
  id: string
  productType: string
  expected: {
    title: string | null
    doi: string | null
    eventOrJournal: string | null
    authors: string[]
  }
  predicted: {
    title: string | null
    doi: string | null
    eventOrJournal: string | null
    authors: string[]
  }
}

function normalizeText(value: string | null): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  return trimmed.length ? trimmed : null
}

function scoreCase(sample: EvalCase) {
  const fields: Array<'title' | 'doi' | 'eventOrJournal'> = ['title', 'doi', 'eventOrJournal']
  let exactMatches = 0
  let expectedPresent = 0
  let predictedPresent = 0

  for (const field of fields) {
    const expected = normalizeText(sample.expected[field])
    const predicted = normalizeText(sample.predicted[field])

    if (expected) {
      expectedPresent += 1
    }

    if (predicted) {
      predictedPresent += 1
    }

    if (expected === predicted) {
      exactMatches += 1
    }
  }

  const expectedAuthors = new Set(sample.expected.authors.map((name) => name.toLowerCase().trim()))
  const predictedAuthors = new Set(
    sample.predicted.authors.map((name) => name.toLowerCase().trim()),
  )
  const authorHits = [...expectedAuthors].filter((name) => predictedAuthors.has(name)).length
  const authorRecall = expectedAuthors.size ? authorHits / expectedAuthors.size : 1

  return {
    exactFieldRate: exactMatches / fields.length,
    coverage: expectedPresent === 0 ? 1 : predictedPresent / expectedPresent,
    authorRecall,
  }
}

describe('NER Field Evals', () => {
  it('meets baseline quality thresholds over golden set', () => {
    const currentDir = dirname(fileURLToPath(import.meta.url))
    const fixturePath = resolve(currentDir, 'fixtures/ner-golden-set.json')
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as EvalCase[]

    const scores = fixture.map(scoreCase)
    const avgExactFieldRate =
      scores.reduce((acc, score) => acc + score.exactFieldRate, 0) / scores.length
    const avgCoverage = scores.reduce((acc, score) => acc + score.coverage, 0) / scores.length
    const avgAuthorRecall =
      scores.reduce((acc, score) => acc + score.authorRecall, 0) / scores.length

    expect(avgExactFieldRate).toBeGreaterThanOrEqual(0.75)
    expect(avgCoverage).toBeGreaterThanOrEqual(0.75)
    expect(avgAuthorRecall).toBeGreaterThanOrEqual(0.8)
  })
})
