import { generateText } from 'ai'
import type { AllowedMimeType, OcrProvider } from '~~/app/types'
import { getGoogleVisionModel } from '~~/server/services/llm/provider'

interface OcrExtractionInput {
  buffer: Buffer
  mimeType: AllowedMimeType
}

export interface OcrExtractionResult {
  text: string
  provider: OcrProvider
  confidence?: number
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

async function extractNativePdfText(buffer: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) })
  const pdf = await loadingTask.promise

  try {
    const pages: string[] = []

    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex)
      const content = await page.getTextContent()
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .trim()

      if (text.length > 0) {
        pages.push(text)
      }
    }

    return normalizeExtractedText(pages.join('\n\n'))
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
  if (input.mimeType === 'application/pdf') {
    const nativeText = await extractNativePdfText(input.buffer)
    if (nativeText.length >= 120) {
      return {
        text: nativeText,
        provider: 'pdfjs_native',
      }
    }
  }

  return {
    text: await extractWithGemini(input.buffer, input.mimeType),
    provider: 'gemini_vision',
  }
}
