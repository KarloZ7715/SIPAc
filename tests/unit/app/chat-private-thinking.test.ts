import { describe, expect, it } from 'vitest'
import {
  extractPrivateThinking,
  hasPrivateThinkingBlocks,
  stripPrivateThinkingBlocks,
} from '~~/app/utils/chat-private-thinking'

describe('chat private thinking sanitizer', () => {
  it('removes complete <think> blocks', () => {
    const input = 'Antes <think>analisis interno</think> Despues'
    expect(stripPrivateThinkingBlocks(input)).toBe('Antes  Despues')
  })

  it('removes unclosed <think> blocks to avoid leaks during streaming', () => {
    const input = 'Visible<think>privado en progreso'
    expect(stripPrivateThinkingBlocks(input)).toBe('Visible')
  })

  it('supports case-insensitive tags and multiple blocks', () => {
    const input = '<THINK>a</THINK>uno<think>b</think>dos'
    expect(stripPrivateThinkingBlocks(input)).toBe('unodos')
  })

  it('handles nested think blocks without leaking inner content', () => {
    const input = 'Inicio<think>outer<think>inner</think>outer-end</think>Fin'
    expect(stripPrivateThinkingBlocks(input)).toBe('InicioFin')
  })

  it('detects private thinking tags', () => {
    expect(hasPrivateThinkingBlocks('texto <think>x</think>')).toBe(true)
    expect(hasPrivateThinkingBlocks('texto sin marcas')).toBe(false)
  })

  describe('extractPrivateThinking', () => {
    it('extracts thinking block and clean text when closed', () => {
      const res = extractPrivateThinking('Hello <think>analyzing</think> world')
      expect(res.thinkingText).toBe('analyzing')
      expect(res.cleanText).toBe('Hello  world')
    })

    it('extracts unclosed thinking block and clean text', () => {
      const res = extractPrivateThinking('Hello <think>analyzing')
      expect(res.thinkingText).toBe('analyzing')
      expect(res.cleanText).toBe('Hello ')
    })

    it('extracts multiple thinking blocks concatenating them', () => {
      const res = extractPrivateThinking('A <think>B</think> C <think>D</think> E')
      expect(res.thinkingText).toBe('BD')
      expect(res.cleanText).toBe('A  C  E')
    })
  })
})
