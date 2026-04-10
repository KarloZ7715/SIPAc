import { describe, expect, it } from 'vitest'
import { publicChatModelPickerLabel } from '~~/server/services/chat/model-selection'

describe('publicChatModelPickerLabel', () => {
  it('devuelve nombres legibles del modelo (sin IDs) para entradas conocidas', () => {
    expect(publicChatModelPickerLabel('groq', 'openai/gpt-oss-120b')).toBe('GPT-OSS 120B')
    expect(publicChatModelPickerLabel('groq', 'openai/gpt-oss-20b')).toBe('GPT-OSS 20B')
    expect(publicChatModelPickerLabel('cerebras', 'qwen-3-235b-a22b-instruct-2507')).toBe(
      'Qwen 3 235B Instruct',
    )
    expect(publicChatModelPickerLabel('nvidia', 'moonshotai/kimi-k2-instruct-0905')).toBe(
      'Kimi K2 Instruct',
    )
    expect(publicChatModelPickerLabel('openrouter', 'google/gemma-4-31b-it:free')).toBe(
      'Gemma 4 31B IT (gratis)',
    )
  })

  it('usa un texto genérico si el modelo no está mapeado', () => {
    expect(publicChatModelPickerLabel('openrouter', 'unknown/model-id')).toBe(
      'OpenRouter — modelo adicional',
    )
  })
})
