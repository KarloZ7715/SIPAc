import { describe, expect, it } from 'vitest'
import { publicChatModelPickerLabel } from '~~/server/services/chat/model-selection'

describe('publicChatModelPickerLabel', () => {
  it('devuelve nombres legibles del modelo (sin IDs) para entradas conocidas', () => {
    expect(publicChatModelPickerLabel('gemini', 'gemini-3.1-flash-lite')).toBe(
      'Gemini 3.1 Flash Lite (preview)',
    )
    expect(publicChatModelPickerLabel('gemini', 'gemma-4-31b-it')).toBe('Gemma 4 31B (preview)')
    expect(publicChatModelPickerLabel('cerebras', 'zai-glm-4.7')).toBe('GLM 4.7 (Cerebras)')
    expect(publicChatModelPickerLabel('nvidia', 'z-ai/glm-5.1')).toBe('GLM 5.1')
    expect(publicChatModelPickerLabel('nvidia', 'deepseek-ai/deepseek-v4-pro')).toBe(
      'DeepSeek V4 Pro',
    )
    expect(publicChatModelPickerLabel('nvidia', 'moonshotai/kimi-k2.6')).toBe('Kimi K2.6')
    expect(publicChatModelPickerLabel('openrouter', 'moonshotai/kimi-k2.6:free')).toBe(
      'Kimi K2.6 (gratis)',
    )
  })

  it('usa un texto genérico si el modelo no está mapeado', () => {
    expect(publicChatModelPickerLabel('openrouter', 'unknown/model-id')).toBe(
      'OpenRouter — modelo adicional',
    )
  })
})
