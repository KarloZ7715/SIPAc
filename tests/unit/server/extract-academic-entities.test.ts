import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGenerateText,
  mockGetStructuredModelCandidates,
  mockValidateEnv,
  mockLogPipelineEvent,
} = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockGetStructuredModelCandidates: vi.fn(),
  mockValidateEnv: vi.fn(),
  mockLogPipelineEvent: vi.fn(),
}))

vi.mock('ai', () => ({
  generateText: mockGenerateText,
  Output: {
    object: ({ schema }: { schema: unknown }) => ({ schema }),
  },
}))

vi.mock('~~/server/services/llm/provider', () => ({
  getStructuredModelCandidates: mockGetStructuredModelCandidates,
}))

vi.mock('~~/server/utils/env', () => ({
  validateEnv: mockValidateEnv,
}))

vi.mock('#imports', () => ({
  useRuntimeConfig: vi.fn(() => ({})),
}))

vi.mock('nuxt/app', () => ({
  useRuntimeConfig: vi.fn(() => ({})),
  useNuxtApp: vi.fn(() => ({ $config: {} })),
}))

vi.mock('~~/server/utils/pipeline-observability', () => ({
  classifyPipelineError: (error: unknown) => ({
    errorType: 'runtime_error',
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
  logPipelineEvent: mockLogPipelineEvent,
  withTimeout: async <T>(input: { run: () => Promise<T> }) => await input.run(),
}))

describe('extractAcademicEntities', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockValidateEnv.mockReturnValue({
      nerRequestTimeoutMs: 35_000,
      nerConfidenceThreshold: 0.7,
      nerMaxCandidateAttempts: 4,
    })

    mockGetStructuredModelCandidates.mockReturnValue([
      { name: 'gemini', modelId: 'gemini-2.5-flash', model: 'model-gemini-flash' },
      { name: 'groq', modelId: 'openai/gpt-oss-120b', model: 'model-groq-120b' },
      { name: 'gemini', modelId: 'gemini-2.5-flash-lite', model: 'model-gemini-flash-lite' },
      { name: 'groq', modelId: 'openai/gpt-oss-20b', model: 'model-groq-20b' },
    ])
  })

  it('falls back to the next candidate when the first one fails', async () => {
    mockGenerateText.mockImplementation(
      async ({ prompt, model }: { prompt: string; model: string }) => {
        if (prompt.includes('Clasifica el siguiente texto')) {
          return {
            output: {
              documentClassification: 'academic',
              classificationConfidence: 0.88,
              classificationRationale: 'Clasificacion valida',
              productType: 'article',
              productTypeConfidence: 0.8,
            },
          }
        }

        if (model === 'model-gemini-flash') {
          throw new Error('provider temporary failure')
        }

        return {
          output: {
            authors: ['Ana Perez'],
            title: 'Articulo de prueba',
            institution: 'Universidad Demo',
            date: '2026-03-13',
            keywords: ['ia', 'ocr'],
            doi: '10.1000/demo',
            eventOrJournal: 'Revista Demo',
            confidence: {
              authors: 0.92,
              title: 0.94,
              institution: 0.88,
              date: 0.86,
              keywords: 0.91,
              doi: 0.9,
              eventOrJournal: 0.89,
            },
          },
        }
      },
    )

    const { extractAcademicEntities } =
      await import('../../../server/services/ner/extract-academic-entities')

    const result = await extractAcademicEntities({
      text: 'Texto academico con DOI 10.1000/demo',
      extractionSource: 'pdfjs_native',
      traceId: 'trace-ner-1',
      documentId: 'doc-ner-1',
    })

    expect(result.nerProvider).toBe('groq')
    expect(result.nerModel).toBe('openai/gpt-oss-120b')
    expect(result.title?.value).toBe('Articulo de prueba')
  })

  it('triggers second pass when first pass confidence is below threshold', async () => {
    let extractionCallCount = 0

    mockGenerateText.mockImplementation(async ({ prompt }: { prompt: string }) => {
      if (prompt.includes('Clasifica el siguiente texto')) {
        return {
          output: {
            documentClassification: 'academic',
            classificationConfidence: 0.9,
            classificationRationale: 'Clasificacion valida',
            productType: 'article',
            productTypeConfidence: 0.82,
          },
        }
      }

      extractionCallCount += 1

      if (extractionCallCount === 1) {
        return {
          output: {
            authors: ['Autor Uno'],
            title: 'Borrador',
            institution: null,
            date: null,
            keywords: [],
            doi: null,
            eventOrJournal: null,
            confidence: {
              authors: 0.2,
              title: 0.25,
              institution: 0,
              date: 0,
              keywords: 0,
              doi: 0,
              eventOrJournal: 0,
            },
          },
        }
      }

      return {
        output: {
          authors: ['Autor Uno', 'Autor Dos'],
          title: 'Version final',
          institution: 'Universidad Demo',
          date: '2026-01-20',
          keywords: ['educacion', 'ia'],
          doi: '10.1000/final',
          eventOrJournal: 'Revista Final',
          confidence: {
            authors: 0.93,
            title: 0.94,
            institution: 0.9,
            date: 0.88,
            keywords: 0.92,
            doi: 0.91,
            eventOrJournal: 0.89,
          },
        },
      }
    })

    const { extractAcademicEntities } =
      await import('../../../server/services/ner/extract-academic-entities')

    const result = await extractAcademicEntities({
      text: 'Texto academico con metadatos variados',
      extractionSource: 'pdfjs_native',
      traceId: 'trace-ner-2',
      documentId: 'doc-ner-2',
    })

    expect(extractionCallCount).toBe(2)
    expect(result.title?.value).toBe('Version final')
    expect(result.extractionConfidence).toBeGreaterThan(0.8)
  })

  it('keeps first pass result when second pass fails', async () => {
    let extractionCallCount = 0

    mockGenerateText.mockImplementation(async ({ prompt }: { prompt: string }) => {
      if (prompt.includes('Clasifica el siguiente texto')) {
        return {
          output: {
            documentClassification: 'non_academic',
            classificationConfidence: 0.86,
            classificationRationale: 'Clasificacion valida',
            productType: 'article',
            productTypeConfidence: 0.81,
          },
        }
      }

      extractionCallCount += 1

      if (extractionCallCount === 1) {
        return {
          output: {
            authors: ['Autor Inicial'],
            title: 'Documento no academico',
            institution: null,
            date: null,
            keywords: ['prueba'],
            doi: null,
            eventOrJournal: null,
            confidence: {
              authors: 0.35,
              title: 0.3,
              institution: 0,
              date: 0,
              keywords: 0.25,
              doi: 0,
              eventOrJournal: 0,
            },
          },
        }
      }

      throw new Error('Unprocessable Entity')
    })

    const { extractAcademicEntities } =
      await import('../../../server/services/ner/extract-academic-entities')

    const result = await extractAcademicEntities({
      text: 'Contenido breve no academico para gatillar baja confianza',
      extractionSource: 'pdfjs_native',
      traceId: 'trace-ner-3',
      documentId: 'doc-ner-3',
    })

    expect(extractionCallCount).toBe(5)
    expect(result.title?.value).toBe('Documento no academico')
    expect(result.nerAttemptTrace?.some((entry) => entry.scope === 'extraction_second_pass')).toBe(
      false,
    )
  })

  it('truncates long provider error messages in ner attempt trace', async () => {
    const longErrorMessage = `Failed after 3 attempts. Last error: ${'x'.repeat(500)}`

    mockGenerateText.mockImplementation(
      async ({ prompt, model }: { prompt: string; model: string }) => {
        if (prompt.includes('Clasifica el siguiente texto')) {
          return {
            output: {
              documentClassification: 'academic',
              classificationConfidence: 0.9,
              classificationRationale: 'Clasificacion valida',
              productType: 'article',
              productTypeConfidence: 0.82,
            },
          }
        }

        if (model === 'model-gemini-flash') {
          throw new Error(longErrorMessage)
        }

        return {
          output: {
            authors: ['Ana Perez'],
            title: 'Articulo de prueba',
            institution: 'Universidad Demo',
            date: '2026-03-13',
            keywords: ['ia'],
            doi: '10.1000/demo',
            eventOrJournal: 'Revista Demo',
            confidence: {
              authors: 0.9,
              title: 0.9,
              institution: 0.9,
              date: 0.9,
              keywords: 0.9,
              doi: 0.9,
              eventOrJournal: 0.9,
            },
          },
        }
      },
    )

    const { extractAcademicEntities } =
      await import('../../../server/services/ner/extract-academic-entities')

    const result = await extractAcademicEntities({
      text: 'Texto academico con DOI 10.1000/demo',
      extractionSource: 'pdfjs_native',
      traceId: 'trace-ner-4',
      documentId: 'doc-ner-4',
    })

    const failedAttempt = result.nerAttemptTrace?.find((entry) => entry.status === 'failed')
    expect(failedAttempt?.errorMessage).toBeDefined()
    expect(failedAttempt?.errorMessage?.length ?? 0).toBeLessThanOrEqual(280)
    expect(failedAttempt?.errorMessage?.endsWith('...')).toBe(true)
  })
})
