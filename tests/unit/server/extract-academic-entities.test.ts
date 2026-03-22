import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as LlmProviderModule from '../../../server/services/llm/provider'

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

vi.mock('~~/server/services/llm/provider', async (importOriginal) => {
  const actual = (await importOriginal()) as LlmProviderModule
  return {
    ...actual,
    getStructuredModelCandidates: mockGetStructuredModelCandidates,
  }
})

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
  classifyPipelineError: (error: unknown) => {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

    if (message.includes('schema') || message.includes('validation')) {
      return {
        errorType: 'schema_validation',
        errorMessage: String(error instanceof Error ? error.message : error),
      }
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return {
        errorType: 'timeout',
        errorMessage: String(error instanceof Error ? error.message : error),
      }
    }

    return {
      errorType: 'runtime_error',
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  },
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
      nerAlwaysSecondPass: false,
      nerMergeExtractionPasses: true,
      nerProductSpecificFillPass: true,
      nerProductSpecificSparseThreshold: 0.4,
      nvidiaApiKey: '',
      nvidiaApiBaseUrl: 'https://integrate.api.nvidia.com/v1',
      openrouterApiKey: '',
      openrouterAppUrl: '',
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

  it('fusiona autores de ambas pasadas cuando nerMergeExtractionPasses es true', async () => {
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
            authors: ['Ana Perez'],
            title: 'Articulo fusion',
            institution: 'Universidad Demo',
            date: '2026-01-20',
            keywords: ['ia'],
            doi: '10.1000/final',
            eventOrJournal: 'Revista Final',
            confidence: {
              authors: 0.35,
              title: 0.35,
              institution: 0.35,
              date: 0.35,
              keywords: 0.35,
              doi: 0.35,
              eventOrJournal: 0.35,
            },
          },
        }
      }

      return {
        output: {
          authors: ['Luis Gomez'],
          title: 'Articulo fusion',
          institution: 'Universidad Demo',
          date: '2026-01-20',
          keywords: ['ocr'],
          doi: '10.1000/final',
          eventOrJournal: 'Revista Final',
          confidence: {
            authors: 0.93,
            title: 0.94,
            institution: 0.9,
            date: 0.88,
            keywords: 0.9,
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
      traceId: 'trace-ner-merge',
      documentId: 'doc-ner-merge',
    })

    expect(extractionCallCount).toBe(2)
    expect(result.authors.map((a) => a.value).sort()).toEqual(['Ana Perez', 'Luis Gomez'].sort())
    expect(result.keywords.map((k) => k.value).sort()).toEqual(['ia', 'ocr'].sort())
    expect(
      mockLogPipelineEvent.mock.calls.some(([p]) => p?.event === 'extraction_passes_merged'),
    ).toBe(true)
  })

  it('keeps first pass result when second pass fails', async () => {
    let extractionCallCount = 0

    mockGenerateText.mockImplementation(async ({ prompt }: { prompt: string }) => {
      if (prompt.includes('Clasifica el siguiente texto')) {
        return {
          output: {
            documentClassification: 'academic',
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
      true,
    )
    expect(
      result.nerAttemptTrace?.some(
        (entry) => entry.scope === 'extraction_second_pass' && entry.status === 'failed',
      ),
    ).toBe(true)
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

  it('sanitizes malformed doi/date and applies confidence penalty', async () => {
    mockGenerateText.mockImplementation(async ({ prompt }: { prompt: string }) => {
      if (prompt.includes('Clasifica el siguiente texto')) {
        return {
          output: {
            documentClassification: 'academic',
            classificationConfidence: 0.89,
            classificationRationale: 'Clasificacion valida',
            productType: 'article',
            productTypeConfidence: 0.81,
          },
        }
      }

      return {
        output: {
          authors: ['Ada Lovelace'],
          title: 'Articulo con metadatos inconsistentes',
          institution: 'Universidad Demo',
          date: '2026-99-20',
          keywords: ['ia'],
          doi: 'doi:ABC123',
          eventOrJournal: 'Revista de Prueba',
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
    })

    const { extractAcademicEntities } =
      await import('../../../server/services/ner/extract-academic-entities')

    const result = await extractAcademicEntities({
      text: 'Texto academico con DOI malformado y fecha invalida',
      extractionSource: 'pdfjs_native',
      traceId: 'trace-ner-5',
      documentId: 'doc-ner-5',
    })

    expect(result.doi).toBeUndefined()
    expect(result.date).toBeUndefined()
    expect(result.extractionConfidence).toBeLessThan(0.7)
    expect(
      mockLogPipelineEvent.mock.calls.some(
        ([payload]) =>
          payload?.event === 'completed' &&
          payload?.stage === 'ner' &&
          typeof payload?.metadata?.semanticPenalty === 'number' &&
          typeof payload?.metadata?.evidenceCoverage === 'number',
      ),
    ).toBe(true)
  })

  it('extracts product-specific metadata for the detected subtype schema', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        journalName: 'Revista de Ingenieria',
        volume: '8',
        issue: '2',
        pages: '44-58',
        openAccess: true,
        articleType: 'original',
      },
    })

    const { extractProductSpecificMetadata } =
      await import('../../../server/services/ner/extract-academic-entities')

    const result = await extractProductSpecificMetadata({
      text: 'Texto OCR con Vol. 8 Num. 2 y DOI',
      productType: 'article',
      commonExtraction: {
        authors: [{ value: 'Ada Lovelace', confidence: 0.92, anchors: [] }],
        title: { value: 'Articulo Demo', confidence: 0.91, anchors: [] },
        institution: undefined,
        date: undefined,
        doi: { value: '10.1000/demo', confidence: 0.9, anchors: [] },
        eventOrJournal: undefined,
      },
      traceId: 'trace-ner-specific-1',
      documentId: 'doc-ner-specific-1',
    })

    expect(result.journalName).toBe('Revista de Ingenieria')
    expect(result.volume).toBe('8')
    expect(result.openAccess).toBe(true)
  })

  it('rejects product-specific payload with unknown keys and invalid enums', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        journalName: 'Revista de Ingenieria',
        articleType: 'invalid_type',
        rogueField: 'unexpected',
      },
    })

    const { extractProductSpecificMetadata } =
      await import('../../../server/services/ner/extract-academic-entities')

    await expect(
      extractProductSpecificMetadata({
        text: 'Texto OCR con metadatos de articulo',
        productType: 'article',
        commonExtraction: {
          authors: [{ value: 'Ada Lovelace', confidence: 0.92, anchors: [] }],
          title: { value: 'Articulo Demo', confidence: 0.91, anchors: [] },
          institution: undefined,
          date: undefined,
          doi: { value: '10.1000/demo', confidence: 0.9, anchors: [] },
          eventOrJournal: undefined,
        },
      }),
    ).rejects.toThrow()
  })

  it('tras fallo de esquema en un modelo pasa al siguiente candidato sin reintentar el mismo', async () => {
    let geminiFlashCalls = 0

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
          geminiFlashCalls += 1
          throw new Error('schema validation failed for response payload')
        }

        return {
          output: {
            authors: ['Ada Lovelace'],
            title: 'Articulo en segundo candidato',
            institution: 'Universidad Demo',
            date: '2026-03-14',
            keywords: ['ia'],
            doi: '10.1000/demo.1',
            eventOrJournal: 'Revista Demo',
            confidence: {
              authors: 0.92,
              title: 0.91,
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
      text: 'Texto academico para probar fallback tras schema',
      extractionSource: 'pdfjs_native',
      traceId: 'trace-ner-6',
      documentId: 'doc-ner-6',
    })

    expect(geminiFlashCalls).toBe(1)
    expect(result.nerProvider).toBe('groq')
    expect(result.nerModel).toBe('openai/gpt-oss-120b')
    expect(result.title?.value).toBe('Articulo en segundo candidato')
    expect(
      mockLogPipelineEvent.mock.calls.some(
        ([payload]) => payload?.event === 'candidate_retry_selected',
      ),
    ).toBe(false)
  })
})
