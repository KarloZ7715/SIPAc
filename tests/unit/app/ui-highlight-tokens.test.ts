import { describe, expect, it } from 'vitest'
import { HIGHLIGHT_CONFIDENCE_STYLES } from '~~/app/config/ui-highlight-tokens'

describe('highlight confidence styles', () => {
  it('defines neutral/high/medium/low keys', () => {
    expect(Object.keys(HIGHLIGHT_CONFIDENCE_STYLES).sort()).toEqual([
      'high',
      'low',
      'medium',
      'neutral',
    ])
  })
})
