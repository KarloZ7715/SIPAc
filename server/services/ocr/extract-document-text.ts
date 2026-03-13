import { generateText } from 'ai'
import type { AllowedMimeType, OcrProvider, DocumentAnchor } from '~~/app/types'
import { getGoogleVisionModel } from '~~/server/services/llm/provider'

interface OcrExtractionInput {
  buffer: Buffer
  mimeType: AllowedMimeType
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
): Promise<{ text: string; blocks: OcrTextBlock[] }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) })
  const pdf = await loadingTask.promise

  try {
    const pages: string[] = []
    const blocks: OcrTextBlock[] = []

    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
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
    }

    return {
      text: normalizeExtractedText(pages.join('\n\n')),
      blocks,
    }
  } finally {
    await loadingTask.destroy()
  }
}

async function extractWithGemini(buffer: Buffer, mimeType: AllowedMimeType): Promise<string> {
  const result = await generateText({
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
  })

  return normalizeExtractedText(result.text)
}

export async function extractDocumentText(input: OcrExtractionInput): Promise<OcrExtractionResult> {
  let nativeText = ''
  let nativeBlocks: OcrTextBlock[] = []
  let nativeExtractionSucceeded = false

  if (input.mimeType === 'application/pdf') {
    try {
      const nativeExtraction = await extractNativePdfText(input.buffer)
      nativeText = nativeExtraction.text
      nativeBlocks = nativeExtraction.blocks
      nativeExtractionSucceeded = nativeText.length > 0

      if (isNativeTextReliable(nativeText)) {
        return {
          text: nativeText,
          provider: 'pdfjs_native',
          confidence: estimateNativeConfidence(nativeText),
          blocks: nativeBlocks,
        }
      }
    } catch {
      // Si falla la lectura nativa, se usa OCR visual como degradacion controlada.
    }
  }

  if (nativeExtractionSucceeded) {
    return {
      text: nativeText,
      provider: 'pdfjs_native',
      confidence: estimateNativeConfidence(nativeText),
      blocks: nativeBlocks,
    }
  }

  const visionText = await extractWithGemini(input.buffer, input.mimeType)

  return {
    text: visionText,
    provider: 'gemini_vision',
    modelId: 'gemini-2.5-flash',
    confidence: estimateVisionConfidence(visionText),
    blocks: [],
  }
}
