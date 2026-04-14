import { generateText } from 'ai'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  isStructuredOfficeMimeType,
  type AllowedMimeType,
  type DocumentAnchor,
  type OcrProvider,
} from '~~/app/types'
import { extractOfficeStructuredText } from '~~/server/services/ocr/extract-office-structured-text'
import { getGoogleVisionModelCandidates } from '~~/server/services/llm/provider'
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
  forceProvider?: OcrProvider
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
  suspiciousRatio: number
  languageSignal: boolean
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

  const standardChars = (normalized.match(/[\p{L}\p{N}\s.,:;!?()[\]{}-]/gu) ?? []).length
  const suspiciousRatio = length === 0 ? 0 : 1 - standardChars / length

  const tokens = new Set(normalized.toLowerCase().split(/\s+/))
  const commonStopWords = new Set([
    'de',
    'la',
    'el',
    'en',
    'the',
    'and',
    'of',
    'to',
    'in',
    'para',
    'con',
    'por',
    'que',
  ])
  const foundStopWords = [...commonStopWords].filter((word) => tokens.has(word)).length
  const languageSignal = foundStopWords >= 2

  return {
    length,
    words,
    letterRatio: length === 0 ? 0 : letters / length,
    suspiciousRatio,
    languageSignal,
  }
}

function isNativeTextReliable(value: string): boolean {
  const signal = measureTextSignal(value)
  return (
    signal.length >= 120 &&
    signal.words >= 25 &&
    signal.letterRatio >= 0.45 &&
    signal.suspiciousRatio < 0.15 &&
    signal.languageSignal
  )
}

function estimateNativeConfidence(value: string): number {
  const signal = measureTextSignal(value)
  if (signal.length === 0) return 0

  let score = 0.42 + Math.min(signal.length / 6000, 0.28) + Math.min(signal.words / 350, 0.2)

  if (signal.suspiciousRatio > 0.05) {
    score -= signal.suspiciousRatio * 1.5
  }

  if (signal.languageSignal) {
    score += 0.05
  } else if (signal.words > 30) {
    score -= 0.15
  }

  return Number(Math.max(0, Math.min(0.95, score)).toFixed(3))
}

function estimateVisionConfidence(value: string): number {
  const signal = measureTextSignal(value)
  if (signal.length === 0) return 0

  let score = 0.46 + Math.min(signal.length / 5000, 0.25) + Math.min(signal.words / 300, 0.2)

  if (signal.suspiciousRatio > 0.05) {
    score -= signal.suspiciousRatio * 1.5
  }

  if (signal.languageSignal) {
    score += 0.05
  } else if (signal.words > 30) {
    score -= 0.15
  }

  return Number(Math.max(0, Math.min(0.9, score)).toFixed(3))
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

        const pageBlocks: OcrTextBlock[] = []

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

          pageBlocks.push({
            text,
            anchor: {
              page: pageIndex,
              x: normalized.x,
              y: normalized.y,
              width: normalized.width,
              height: normalized.height,
              confidence: 0,
              provider: 'pdfjs_native',
              sourceText: text,
            },
          })
          pageTokens.push(text)
        }

        const pageText = pageTokens.join(' ').trim()

        if (pageText.length > 0) {
          const pageConfidence = estimateNativeConfidence(pageText)
          for (const block of pageBlocks) {
            block.anchor.confidence = pageConfidence
            blocks.push(block)
          }
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

const GEMINI_VISION_OCR_PROMPT =
  'Extrae todo el texto legible del documento en espanol si aplica. No resumas, no traduzcas y no inventes contenido. Devuelve solo el texto transcrito respetando el orden de lectura.'

async function extractWithGeminiVisionChain(
  buffer: Buffer,
  mimeType: AllowedMimeType,
  traceContext?: { traceId?: string; documentId?: string },
): Promise<{ text: string; modelId: string }> {
  const env = validateEnv(getRuntimeConfigSafe())
  const candidates = getGoogleVisionModelCandidates()
  const maxAttempts = Math.max(1, Math.min(candidates.length, env.ocrMaxGeminiVisionAttempts))
  const slice = candidates.slice(0, maxAttempts)
  let lastError: unknown = null

  for (let i = 0; i < slice.length; i += 1) {
    const { modelId, model } = slice[i]!
    const attemptStart = Date.now()

    try {
      const result = await withTimeout({
        label: `gemini_ocr_request_${modelId}`,
        timeoutMs: env.ocrRequestTimeoutMs,
        run: () =>
          generateText({
            model,
            maxRetries: 0,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: GEMINI_VISION_OCR_PROMPT },
                  { type: 'file', data: buffer, mediaType: mimeType },
                ],
              },
            ],
          }),
      })

      const text = normalizeExtractedText(result.text)

      logPipelineEvent({
        traceId: traceContext?.traceId,
        documentId: traceContext?.documentId,
        stage: 'ocr',
        event: 'vision_gemini_candidate_succeeded',
        provider: 'gemini_vision',
        modelId,
        attempt: i + 1,
        durationMs: Date.now() - attemptStart,
        metadata: {
          chainIndex: i,
          chainLength: slice.length,
          textLength: text.length,
        },
      })

      return { text, modelId }
    } catch (error) {
      lastError = error
      const classified = classifyPipelineError(error)

      logPipelineEvent({
        traceId: traceContext?.traceId,
        documentId: traceContext?.documentId,
        stage: 'ocr',
        event: 'vision_gemini_candidate_failed',
        provider: 'gemini_vision',
        modelId,
        attempt: i + 1,
        durationMs: Date.now() - attemptStart,
        errorType: classified.errorType,
        errorMessage: classified.errorMessage,
        metadata: { chainIndex: i, chainLength: slice.length },
      })
    }
  }

  logPipelineEvent({
    traceId: traceContext?.traceId,
    documentId: traceContext?.documentId,
    stage: 'ocr',
    event: 'vision_gemini_chain_exhausted',
    provider: 'gemini_vision',
    metadata: { maxAttempts, availableCandidates: candidates.length },
  })

  throw lastError instanceof Error ? lastError : new Error('OCR visión Gemini: cadena agotada')
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

  if (isStructuredOfficeMimeType(input.mimeType) && input.forceProvider !== 'gemini_vision') {
    const officeStart = Date.now()
    let text: string
    try {
      text = await extractOfficeStructuredText(input.buffer, input.mimeType)
    } catch (error) {
      const classified = classifyPipelineError(error)
      logPipelineEvent({
        traceId: input.traceId,
        documentId: input.documentId,
        stage: 'ocr',
        event: 'office_structured_failed',
        provider: 'office_native',
        durationMs: Date.now() - officeStart,
        errorType: classified.errorType,
        errorMessage: classified.errorMessage,
      })
      throw error instanceof Error ? error : new Error('Extracción de documento Office fallida')
    }

    if (!text.trim()) {
      logPipelineEvent({
        traceId: input.traceId,
        documentId: input.documentId,
        stage: 'ocr',
        event: 'office_structured_empty',
        provider: 'office_native',
        durationMs: Date.now() - officeStart,
      })
      throw new Error('No se pudo extraer texto legible del documento Office')
    }

    const confidence = estimateNativeConfidence(text)

    logPipelineEvent({
      traceId: input.traceId,
      documentId: input.documentId,
      stage: 'ocr',
      event: 'completed',
      provider: 'office_native',
      durationMs: Date.now() - officeStart,
      metadata: {
        confidence,
        textLength: text.length,
        source: 'office_structured',
      },
    })

    return {
      text: normalizeExtractedText(text),
      provider: 'office_native',
      confidence,
      blocks: [],
    }
  }

  if (input.mimeType === 'application/pdf' && input.forceProvider !== 'gemini_vision') {
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
      event: 'native_pdf_unreliable_fallback_triggered',
      provider: 'pdfjs_native',
      metadata: {
        source: 'native_pdf_partial',
        confidence: estimateNativeConfidence(nativeText),
        nativeDiagnostics,
      },
    })
  }

  let visionText = ''
  let visionModelId = 'gemini-2.5-flash'

  try {
    const vision = await extractWithGeminiVisionChain(input.buffer, input.mimeType, {
      traceId: input.traceId,
      documentId: input.documentId,
    })
    visionText = vision.text
    visionModelId = vision.modelId
  } catch (error) {
    if (!nativeExtractionSucceeded) {
      throw error
    }

    const classified = classifyPipelineError(error)

    logPipelineEvent({
      traceId: input.traceId,
      documentId: input.documentId,
      stage: 'ocr',
      event: 'vision_fallback_failed_kept_native_partial',
      provider: 'gemini_vision',
      errorType: classified.errorType,
      errorMessage: classified.errorMessage,
      metadata: {
        source: 'native_pdf_partial',
        nativeConfidence: estimateNativeConfidence(nativeText),
      },
    })

    return {
      text: nativeText,
      provider: 'pdfjs_native',
      confidence: estimateNativeConfidence(nativeText),
      blocks: nativeBlocks,
    }
  }

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
    modelId: visionModelId,
    durationMs: Date.now() - ocrStart,
    metadata: {
      confidence: estimateVisionConfidence(visionText),
      textLength: visionText.length,
    },
  })

  return {
    text: visionText,
    provider: 'gemini_vision',
    modelId: visionModelId,
    confidence: estimateVisionConfidence(visionText),
    blocks: [],
  }
}
