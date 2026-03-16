import type { OcrProvider } from '~~/app/types'

export interface OcrQualityAssessment {
  score: number
  status: 'good' | 'fair' | 'poor'
  reasons: string[]
}

export interface OcrQualityInput {
  text: string
  provider: OcrProvider
  confidence?: number
  blocksCount?: number
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function computeSuspiciousRatio(text: string): number {
  if (!text.length) {
    return 1
  }

  const suspiciousChars = (text.match(/[^\p{L}\p{N}\s.,;:()\-_/]/gu) ?? []).length
  return suspiciousChars / text.length
}

export function evaluateOcrQuality(input: OcrQualityInput): OcrQualityAssessment {
  const normalizedText = input.text.trim()
  const textLength = normalizedText.length
  const words = normalizedText.split(/\s+/).filter(Boolean).length
  const suspiciousRatio = computeSuspiciousRatio(normalizedText)
  const confidence = typeof input.confidence === 'number' ? clampUnit(input.confidence) : 0.5
  const isVisionProvider = input.provider === 'gemini_vision'
  const blocksFactor = isVisionProvider ? 1 : Math.min(1, (input.blocksCount ?? 0) / 80)

  const score = clampUnit(
    Math.min(textLength / 1200, 1) * 0.3 +
      Math.min(words / 220, 1) * 0.3 +
      confidence * 0.2 +
      (1 - suspiciousRatio) * 0.1 +
      blocksFactor * 0.1,
  )

  const reasons: string[] = []

  if (textLength < 120) {
    reasons.push('text_too_short')
  }

  if (words < 20) {
    reasons.push('word_count_too_low')
  }

  if (confidence < 0.45) {
    reasons.push('low_provider_confidence')
  }

  if (suspiciousRatio > 0.35) {
    reasons.push('high_symbol_noise')
  }

  let status: 'good' | 'fair' | 'poor'
  if (score >= 0.6) {
    status = 'good'
  } else if (score >= 0.45) {
    status = 'fair'
  } else {
    status = 'poor'
  }

  return {
    score: Number(score.toFixed(3)),
    status,
    reasons,
  }
}
