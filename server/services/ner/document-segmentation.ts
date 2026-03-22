import { Output, generateText } from 'ai'
import { z } from 'zod'
import type { EnvConfig } from '~~/server/utils/env'
import { getGeminiModelById } from '~~/server/services/llm/provider'
import {
  classifyPipelineError,
  logPipelineEvent,
  withTimeout,
} from '~~/server/utils/pipeline-observability'

export interface TextSegmentRange {
  textStart: number
  textEnd: number
  label?: string
}

const segmentationOutputSchema = z
  .object({
    segments: z
      .array(
        z
          .object({
            textStart: z.number().int().min(0),
            textEnd: z.number().int().min(0),
            label: z.string().trim().max(200).optional().nullable(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()

export function countTitleLikeLines(text: string): number {
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  let count = 0
  for (const line of lines) {
    if (line.length < 20 || line.length > 200) continue
    if (/^https?:\/\//i.test(line)) continue
    const words = line.split(/\s+/).filter(Boolean).length
    if (words < 4) continue
    const letters = (line.match(/[A-Za-zÁÉÍÓÚÜáéíóúüÑñ]/g) ?? []).length
    if (letters === 0 || letters / line.length < 0.45) continue
    const upper = (line.match(/[A-ZÁÉÍÓÚÜÑ]/g) ?? []).length
    if (upper / letters > 0.32) count++
  }
  return count
}

export function heuristicSuggestsMultipleWorks(text: string): boolean {
  const len = text.length
  if (len < 12_000) return false
  const titles = countTitleLikeLines(text)
  if (titles >= 4) return true
  if (titles >= 3 && len >= 18_000) return true
  if (titles >= 2 && len >= 35_000) return true
  return false
}

function normalizeAndValidateRanges(
  fullLength: number,
  raw: TextSegmentRange[],
  minSegmentChars: number,
  maxSegments: number,
): TextSegmentRange[] {
  const sorted = [...raw]
    .map((s) => ({
      textStart: Math.max(0, Math.min(s.textStart, fullLength)),
      textEnd: Math.max(0, Math.min(s.textEnd, fullLength)),
      label: s.label?.trim() || undefined,
    }))
    .filter((s) => s.textEnd > s.textStart)
    .sort((a, b) => a.textStart - b.textStart)

  const merged: TextSegmentRange[] = []
  for (const seg of sorted) {
    const last = merged[merged.length - 1]
    if (last && seg.textStart <= last.textEnd) {
      last.textEnd = Math.max(last.textEnd, seg.textEnd)
      if (!last.label && seg.label) last.label = seg.label
    } else {
      merged.push({ ...seg })
    }
  }

  const sized = merged.filter((s) => s.textEnd - s.textStart >= minSegmentChars)
  const capped = sized.slice(0, maxSegments)

  if (capped.length === 0) {
    return [{ textStart: 0, textEnd: fullLength }]
  }

  const firstSeg = capped[0]!
  const lastSeg = capped[capped.length - 1]!
  firstSeg.textStart = 0
  lastSeg.textEnd = fullLength

  for (let i = 1; i < capped.length; i++) {
    const prev = capped[i - 1]!
    const cur = capped[i]!
    if (cur.textStart < prev.textEnd) {
      cur.textStart = prev.textEnd
    }
    if (cur.textEnd <= cur.textStart) {
      cur.textEnd = Math.min(fullLength, cur.textStart + minSegmentChars)
    }
  }

  const final = capped.filter((s) => s.textEnd - s.textStart >= minSegmentChars)
  return final.length > 0 ? final : [{ textStart: 0, textEnd: fullLength }]
}

export interface ResolveSegmentsParams {
  fullText: string
  env: EnvConfig
  forceSingle: boolean
  traceId?: string
  documentId?: string
}

export interface ResolveSegmentsResult {
  segments: TextSegmentRange[]
  usedLlm: boolean
  heuristicMultiple: boolean
  warning?: string
}

export async function resolveTextSegments(
  params: ResolveSegmentsParams,
): Promise<ResolveSegmentsResult> {
  const { fullText, env, forceSingle, traceId, documentId } = params
  const len = fullText.length

  if (len === 0) {
    return {
      segments: [{ textStart: 0, textEnd: 0 }],
      usedLlm: false,
      heuristicMultiple: false,
      warning: 'Texto vacío',
    }
  }

  if (forceSingle) {
    return {
      segments: [{ textStart: 0, textEnd: len }],
      usedLlm: false,
      heuristicMultiple: false,
    }
  }

  const heuristicMultiple = heuristicSuggestsMultipleWorks(fullText)

  if (!heuristicMultiple || !env.nerSegmentationEnabled) {
    return {
      segments: [{ textStart: 0, textEnd: len }],
      usedLlm: false,
      heuristicMultiple,
      warning:
        heuristicMultiple && !env.nerSegmentationEnabled
          ? 'El texto sugiere varias obras; activa NER_SEGMENTATION_ENABLED para intentar dividirlas automáticamente.'
          : undefined,
    }
  }

  if (len > env.nerSegmentationInputMaxChars) {
    logPipelineEvent({
      traceId,
      documentId,
      stage: 'ner',
      event: 'segmentation_skipped_text_too_long',
      metadata: {
        textLength: len,
        maxChars: env.nerSegmentationInputMaxChars,
      },
    })
    return {
      segments: [{ textStart: 0, textEnd: len }],
      usedLlm: false,
      heuristicMultiple,
      warning:
        'Documento demasiado largo para segmentación automática con el límite actual; se procesó como una sola obra.',
    }
  }

  const model = getGeminiModelById(env.nerSegmentationModelId)
  const prompt = [
    'Eres un asistente que divide el texto plano de un PDF (p. ej. libro de resúmenes de congreso) en varias obras independientes.',
    'Cada obra suele tener título propio y autores distintos.',
    'Devuelve SOLO JSON con el esquema: { "segments": [ { "textStart", "textEnd", "label"?: string } ] }.',
    'textStart y textEnd son índices de carácter 0-based sobre el TEXTO COMPLETO, con la misma semántica que String.prototype.slice: el segmento es texto.slice(textStart, textEnd) (textEnd es EXCLUSIVO).',
    `Máximo ${env.nerSegmentationMaxSegments} segmentos.`,
    'Si hay una sola obra, devuelve un solo segmento que cubra todo el texto (0 hasta longitud total).',
    'No inventes trozos fuera del texto; los índices deben estar entre 0 y la longitud del texto.',
    '',
    '--- TEXTO ---',
    fullText,
    '--- FIN ---',
  ].join('\n')

  try {
    const started = Date.now()
    const result = await withTimeout({
      label: 'ner_segmentation',
      timeoutMs: Math.min(env.nerRequestTimeoutMs, 25_000),
      run: () =>
        generateText({
          model,
          temperature: 0.1,
          maxRetries: 0,
          output: Output.object({ schema: segmentationOutputSchema }),
          prompt,
        }),
    })

    const parsed = segmentationOutputSchema.parse(result.output)
    const ranges: TextSegmentRange[] = parsed.segments.map((s) => ({
      textStart: s.textStart,
      textEnd: s.textEnd,
      label: s.label ?? undefined,
    }))

    const normalized = normalizeAndValidateRanges(
      len,
      ranges,
      env.nerSegmentationMinSegmentChars,
      env.nerSegmentationMaxSegments,
    )

    logPipelineEvent({
      traceId,
      documentId,
      stage: 'ner',
      event: 'segmentation_completed',
      provider: 'gemini',
      modelId: env.nerSegmentationModelId,
      durationMs: Date.now() - started,
      metadata: {
        segmentCount: normalized.length,
        heuristicMultiple,
      },
    })

    return {
      segments: normalized,
      usedLlm: true,
      heuristicMultiple,
    }
  } catch (error) {
    const classified = classifyPipelineError(error)
    logPipelineEvent({
      traceId,
      documentId,
      stage: 'ner',
      event: 'segmentation_failed',
      errorType: classified.errorType,
      errorMessage: classified.errorMessage,
      metadata: { fallback: 'single_segment' },
    })
    return {
      segments: [{ textStart: 0, textEnd: len }],
      usedLlm: false,
      heuristicMultiple,
      warning: 'No se pudo segmentar el documento; se procesó como una sola obra.',
    }
  }
}
