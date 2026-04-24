import { describe, expect, it } from 'vitest'
import { publicChatModelPickerLabel } from '~~/server/services/chat/model-selection'

describe('publicChatModelPickerLabel', () => {
  it('devuelve nombres legibles del modelo (sin IDs) para entradas conocidas', () => {
    expect(publicChatModelPickerLabel('gemini', 'gemini-3.1-flash-lite-preview')).toBe(
      'Gemini 3.1 Flash Lite (preview)',
    )
    expect(publicChatModelPickerLabel('gemini', 'gemma-4-31b-it')).toBe('Gemma 4 31B (preview)')
    expect(publicChatModelPickerLabel('cerebras', 'qwen-3-235b-a22b-instruct-2507')).toBe(
      'Qwen 3 235B Instruct',
    )
    expect(publicChatModelPickerLabel('nvidia', 'moonshotai/kimi-k2-thinking')).toBe(
      'Kimi K2 Thinking',
    )
    expect(publicChatModelPickerLabel('nvidia', 'moonshotai/kimi-k2-instruct-0905')).toBe(
      'Kimi K2 Instruct',
    )
    expect(publicChatModelPickerLabel('openrouter', 'nvidia/nemotron-3-super-120b-a12b:free')).toBe(
      'Nemotron 3 Super 120B (preview)',
    )
  })

  it('usa un texto genérico si el modelo no está mapeado', () => {
    expect(publicChatModelPickerLabel('openrouter', 'unknown/model-id')).toBe(
      'OpenRouter — modelo adicional',
    )
  })
})
