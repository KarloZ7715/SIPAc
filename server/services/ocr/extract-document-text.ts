import { generateText } from 'ai'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AllowedMimeType, OcrProvider, DocumentAnchor } from '~~/app/types'
import { getGoogleVisionModel } from '~~/server/services/llm/provider'
import { validateEnv } from '~~/server/utils/env'
import {
  classifyPipelineError,
  logPipelineEvent,
  withTimeout,
} from '~~/server/utils/pipeline-observability'

const require = createRequire(import.meta.url)
const pdfjsPackageDir = dirname(require.resolve('pdfjs-dist/package.json'))
const standardFontDataUrl = `${pathToFileURL(join(pdfjsPackageDir, 'standard_fonts')).toString().replace(/\/$/, '')}/`

interface OcrExtractionInput {
  buffer: Buffer
  mimeType: AllowedMimeType
  traceId?: string
  documentId?: string
}

export interface OcrExtractionResult {
  text: string
  provider: OcrProvider
  modelId?: string
  confidence?: number
  blocks: OcrTextBlock[]
}

export interface OcrTextBlock {
  text: string
  anchor: DocumentAnchor
}

interface TextSignal {
  length: number
  words: number
  letterRatio: number
}

type NativePdfErrorCategory =
  | 'font_data_missing'
  | 'encrypted_pdf'
  | 'malformed_pdf'
  | 'page_parse_error'
  | 'unknown_pdf_error'

interface NativePdfExtractionDiagnostics {
  totalPages: number
  extractedPages: number
  failedPages: number
  errorCategories: NativePdfErrorCategory[]
}

function getRuntimeConfigSafe(): Record<string, unknown> {
  try {
    return useRuntimeConfig()
  } catch {
    return {}
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function classifyNativePdfError(errorMessage: string): NativePdfErrorCategory {
  const normalized = errorMessage.toLowerCase()

  if (normalized.includes('standardfontdataurl') || normalized.includes('font')) {
    return 'font_data_missing'
  }

  if (normalized.includes('password') || normalized.includes('encrypted')) {
    return 'encrypted_pdf'
  }

  if (
    normalized.includes('invalid pdf') ||
    normalized.includes('malformed') ||
    normalized.includes('corrupt')
  ) {
    return 'malformed_pdf'
  }

  if (normalized.includes('page')) {
    return 'page_parse_error'
  }

  return 'unknown_pdf_error'
}

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()
}

function measureTextSignal(value: string): TextSignal {
  const normalized = value.trim()
  const length = normalized.length
  const words = normalized.split(/\s+/).filter(Boolean).length
  const letters = (normalized.match(/[\p{L}]/gu) ?? []).length

  return {
    length,
    words,
    letterRatio: length === 0 ? 0 : letters / length,
  }
}

function isNativeTextReliable(value: string): boolean {
  const signal = measureTextSignal(value)
  return signal.length >= 120 && signal.words >= 25 && signal.letterRatio >= 0.45
}

function estimateNativeConfidence(value: string): number {
  const signal = measureTextSignal(value)
  if (signal.length === 0) return 0

  const score = 0.42 + Math.min(signal.length / 6000, 0.28) + Math.min(signal.words / 350, 0.2)
  return Number(Math.min(0.95, score).toFixed(3))
}

function estimateVisionConfidence(value: string): number {
  const signal = measureTextSignal(value)
  if (signal.length === 0) return 0

  const score = 0.46 + Math.min(signal.length / 5000, 0.25) + Math.min(signal.words / 300, 0.2)
  return Number(Math.min(0.9, score).toFixed(3))
}

function clampToUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  if (value <= 0) {
    return 0
  }

  if (value >= 1) {
    return 1
  }

  return value
}

function normalizePageRect(input: {
  x: number
  y: number
  width: number
  height: number
  pageWidth: number
  pageHeight: number
}) {
  const safePageWidth = Math.max(input.pageWidth, 1)
  const safePageHeight = Math.max(input.pageHeight, 1)

  const left = clampToUnit(input.x / safePageWidth)
  const top = clampToUnit(input.y / safePageHeight)
  const right = clampToUnit((input.x + input.width) / safePageWidth)
  const bottom = clampToUnit((input.y + input.height) / safePageHeight)

  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  }
}

async function extractNativePdfText(
  buffer: Buffer,
): Promise<{ text: string; blocks: OcrTextBlock[]; diagnostics: NativePdfExtractionDiagnostics }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl,
  })
  const pdf = await loadingTask.promise

  try {
    const pages: string[] = []
    const blocks: OcrTextBlock[] = []
    const pageErrors: string[] = []
    const errorCategories = new Set<NativePdfErrorCategory>()

    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
      try {
        const page = await pdf.getPage(pageIndex)
        const viewport = page.getViewport({ scale: 1 })
        const content = await page.getTextContent()
        const pageTokens: string[] = []

        for (const item of content.items) {
          if (!('str' in item && 'transform' in item && 'width' in item)) {
            continue
          }

          const text = String(item.str ?? '').trim()
          if (!text) {
            continue
          }

          const transform = Array.isArray(item.transform) ? item.transform : []
          const tx = Number(transform[4] ?? 0)
          const ty = Number(transform[5] ?? 0)
          const itemHeight = Math.abs(
            Number((item as { height?: number }).height ?? transform[3] ?? 0),
          )
          const itemWidth = Math.abs(Number(item.width ?? transform[0] ?? 0))

          const absoluteTop = viewport.height - ty - itemHeight
          const absoluteLeft = tx

          const normalized = normalizePageRect({
            x: absoluteLeft,
            y: absoluteTop,
            width: itemWidth,
            height: itemHeight,
            pageWidth: viewport.width,
            pageHeight: viewport.height,
          })

          if (normalized.width <= 0 || normalized.height <= 0) {
            continue
          }

          blocks.push({
            text,
            anchor: {
              page: pageIndex,
              x: normalized.x,
              y: normalized.y,
              width: normalized.width,
              height: normalized.height,
              confidence: 0.94,
              provider: 'pdfjs_native',
              sourceText: text,
            },
          })
          pageTokens.push(text)
        }

        const pageText = pageTokens.join(' ').trim()

        if (pageText.length > 0) {
          pages.push(pageText)
        }
      } catch (error) {
        const message = toErrorMessage(error)
        pageErrors.push(`page ${pageIndex}: ${message}`)
        errorCategories.add(classifyNativePdfError(message))
      }
    }

    if (pages.length === 0 && pageErrors.length > 0) {
      throw new Error(
        `No se pudo extraer texto nativo del PDF (${pageErrors.slice(0, 3).join(' | ')})`,
      )
    }

    return {
      text: normalizeExtractedText(pages.join('\n\n')),
      blocks,
      diagnostics: {
        totalPages: pdf.numPages,
        extractedPages: pages.length,
        failedPages: pageErrors.length,
        errorCategories: [...errorCategories],
      },
    }
  } finally {
    await loadingTask.destroy()
  }
}

async function extractWithGemini(buffer: Buffer, mimeType: AllowedMimeType): Promise<string> {
  const env = validateEnv(getRuntimeConfigSafe())

  const result = await withTimeout({
    label: 'gemini_ocr_request',
    timeoutMs: env.ocrRequestTimeoutMs,
    run: () =>
      generateText({
        model: getGoogleVisionModel(),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extrae todo el texto legible del documento en espanol si aplica. No resumas, no traduzcas y no inventes contenido. Devuelve solo el texto transcrito respetando el orden de lectura.',
              },
              {
                type: 'file',
                data: buffer,
                mediaType: mimeType,
              },
            ],
          },
        ],
      }),
  })

  return normalizeExtractedText(result.text)
}

export async function extractDocumentText(input: OcrExtractionInput): Promise<OcrExtractionResult> {
  let nativeText = ''
  let nativeBlocks: OcrTextBlock[] = []
  let nativeExtractionSucceeded = false
  let nativeExtractionError: string | null = null
  let nativeDiagnostics: NativePdfExtractionDiagnostics | null = null
  const ocrStart = Date.now()

  logPipelineEvent({
    traceId: input.traceId,
    documentId: input.documentId,
    stage: 'ocr',
    event: 'start',
    metadata: {
      mimeType: input.mimeType,
      bufferBytes: input.buffer.length,
      timeoutMs: validateEnv(getRuntimeConfigSafe()).ocrRequestTimeoutMs,
    },
  })

  if (input.mimeType === 'application/pdf') {
    const nativeStart = Date.now()

    try {
      const nativeExtraction = await extractNativePdfText(input.buffer)
      nativeText = nativeExtraction.text
      nativeBlocks = nativeExtraction.blocks
      nativeDiagnostics = nativeExtraction.diagnostics
      nativeExtractionSucceeded = nativeText.length > 0

      logPipelineEvent({
        traceId: input.traceId,
        documentId: input.documentId,
        stage: 'ocr',
        event: 'native_pdf_completed',
        provider: 'pdfjs_native',
        durationMs: Date.now() - nativeStart,
        metadata: {
          textLength: nativeText.length,
          blocks: nativeBlocks.length,
          pageCoverage:
            nativeDiagnostics && nativeDiagnostics.totalPages > 0
              ? Number((nativeDiagnostics.extractedPages / nativeDiagnostics.totalPages).toFixed(3))
              : undefined,
          nativeDiagnostics,
        },
      })

      if (isNativeTextReliable(nativeText)) {
        logPipelineEvent({
          traceId: input.traceId,
          documentId: input.documentId,
          stage: 'ocr',
          event: 'completed',
          provider: 'pdfjs_native',
          durationMs: Date.now() - ocrStart,
          metadata: {
            source: 'native_pdf_reliable',
            confidence: estimateNativeConfidence(nativeText),
            nativeDiagnostics,
          },
        })

        return {
          text: nativeText,
          provider: 'pdfjs_native',
          confidence: estimateNativeConfidence(nativeText),
          blocks: nativeBlocks,
        }
      }
    } catch (error) {
      nativeExtractionError = toErrorMessage(error)
      const classified = classifyPipelineError(error)

      logPipelineEvent({
        traceId: input.traceId,
        documentId: input.documentId,
        stage: 'ocr',
        event: 'native_pdf_failed',
        provider: 'pdfjs_native',
        durationMs: Date.now() - nativeStart,
        errorType: classified.errorType,
        errorMessage: classified.errorMessage,
        metadata: {
          errorCategory: classifyNativePdfError(classified.errorMessage),
        },
      })

      // Si falla la lectura nativa, se usa OCR visual como degradacion controlada.
    }
  }

  if (nativeExtractionSucceeded) {
    logPipelineEvent({
      traceId: input.traceId,
      documentId: input.documentId,
      stage: 'ocr',
      event: 'completed',
      provider: 'pdfjs_native',
      durationMs: Date.now() - ocrStart,
      metadata: {
        source: 'native_pdf_partial',
        confidence: estimateNativeConfidence(nativeText),
        nativeDiagnostics,
      },
    })

    return {
      text: nativeText,
      provider: 'pdfjs_native',
      confidence: estimateNativeConfidence(nativeText),
      blocks: nativeBlocks,
    }
  }

  const visionText = await extractWithGemini(input.buffer, input.mimeType)

  if (nativeExtractionError && input.mimeType === 'application/pdf') {
    console.warn(
      `[ocr] fallback to gemini_vision after native PDF extraction failure: ${nativeExtractionError}`,
    )

    logPipelineEvent({
      traceId: input.traceId,
      documentId: input.documentId,
      stage: 'ocr',
      event: 'vision_fallback_triggered',
      provider: 'gemini_vision',
      errorType: 'native_pdf_failed',
      errorMessage: nativeExtractionError,
      metadata: {
        errorCategory: classifyNativePdfError(nativeExtractionError),
      },
    })
  }

  logPipelineEvent({
    traceId: input.traceId,
    documentId: input.documentId,
    stage: 'ocr',
    event: 'completed',
    provider: 'gemini_vision',
    modelId: 'gemini-2.5-flash',
    durationMs: Date.now() - ocrStart,
    metadata: {
      confidence: estimateVisionConfidence(visionText),
      textLength: visionText.length,
    },
  })

  return {
    text: visionText,
    provider: 'gemini_vision',
    modelId: 'gemini-2.5-flash',
    confidence: estimateVisionConfidence(visionText),
    blocks: [],
  }
}
