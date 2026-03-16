import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGenerateText, mockGetDocument } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockGetDocument: vi.fn(),
}))

vi.mock('ai', () => ({
  generateText: mockGenerateText,
}))

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: mockGetDocument,
}))

vi.mock('~~/server/services/llm/provider', () => ({
  getGoogleVisionModel: vi.fn(() => 'gemini-vision-model'),
}))

vi.mock('~~/server/utils/env', () => ({
  validateEnv: vi.fn(() => ({
    ocrRequestTimeoutMs: 45_000,
  })),
}))

vi.mock('#imports', () => ({
  useRuntimeConfig: vi.fn(() => ({})),
}))

vi.mock('nuxt/app', () => ({
  useRuntimeConfig: vi.fn(() => ({})),
  useNuxtApp: vi.fn(() => ({ $config: {} })),
}))

function buildPdfLoadingTask(input: {
  itemsByPage: Array<Array<Record<string, unknown>>>
  failPages?: number[]
}) {
  const failPages = new Set(input.failPages ?? [])
  const destroy = vi.fn(async () => undefined)

  const pdf = {
    numPages: input.itemsByPage.length,
    getPage: vi.fn(async (pageIndex: number) => {
      if (failPages.has(pageIndex)) {
        throw new Error(`page ${pageIndex} parse error`)
      }

      const pageItems = input.itemsByPage[pageIndex - 1] ?? []

      return {
        getViewport: vi.fn(() => ({ width: 800, height: 1000 })),
        getTextContent: vi.fn(async () => ({ items: pageItems })),
      }
    }),
  }

  return {
    promise: Promise.resolve(pdf),
    destroy,
  }
}

describe('extractDocumentText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses pdfjs_native and skips Gemini for reliable PDF native text', async () => {
    const longText = 'la palabra academica de prueba '.repeat(40).trim()
    mockGetDocument.mockReturnValue(
      buildPdfLoadingTask({
        itemsByPage: [
          [
            {
              str: longText,
              transform: [1, 0, 0, 12, 20, 300],
              width: 320,
              height: 14,
            },
          ],
        ],
      }),
    )

    const { extractDocumentText } =
      await import('../../../server/services/ocr/extract-document-text')

    const result = await extractDocumentText({
      buffer: Buffer.from('pdf-content'),
      mimeType: 'application/pdf',
      traceId: 'trace-1',
      documentId: 'doc-1',
    })

    expect(result.provider).toBe('pdfjs_native')
    expect(result.text.length).toBeGreaterThan(120)
    expect(mockGenerateText).not.toHaveBeenCalled()
  })

  it('falls back to Gemini Vision when native PDF extraction fails completely', async () => {
    mockGetDocument.mockReturnValue(
      buildPdfLoadingTask({
        itemsByPage: [[], []],
        failPages: [1, 2],
      }),
    )

    mockGenerateText.mockResolvedValue({ text: 'texto extraido por vision' })

    const { extractDocumentText } =
      await import('../../../server/services/ocr/extract-document-text')

    const result = await extractDocumentText({
      buffer: Buffer.from('pdf-content'),
      mimeType: 'application/pdf',
      traceId: 'trace-2',
      documentId: 'doc-2',
    })

    expect(result.provider).toBe('gemini_vision')
    expect(result.modelId).toBe('gemini-2.5-flash')
    expect(mockGenerateText).toHaveBeenCalledTimes(1)
  })

  it('falls back to Gemini when native PDF text is partial and below reliability threshold', async () => {
    const shortText = 'titulo autor 2026'
    mockGetDocument.mockReturnValue(
      buildPdfLoadingTask({
        itemsByPage: [
          [
            {
              str: shortText,
              transform: [1, 0, 0, 12, 20, 300],
              width: 140,
              height: 14,
            },
          ],
        ],
      }),
    )

    mockGenerateText.mockResolvedValue({ text: 'texto recuperado con vision desde fallback' })

    const { extractDocumentText } =
      await import('../../../server/services/ocr/extract-document-text')

    const result = await extractDocumentText({
      buffer: Buffer.from('pdf-content'),
      mimeType: 'application/pdf',
      traceId: 'trace-3',
      documentId: 'doc-3',
    })

    expect(result.provider).toBe('gemini_vision')
    expect(result.text).toContain('fallback')
    expect(mockGenerateText).toHaveBeenCalledTimes(1)
  })
})
