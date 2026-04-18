import { describe, expect, it } from 'vitest'
import { applyUiRootAttributes } from '~~/app/composables/use-ui-root-attributes'

describe('applyUiRootAttributes', () => {
  it('sets motion and density attributes', () => {
    const element = document.createElement('html')
    applyUiRootAttributes(element, 'minimal', 'compact')
    expect(element.dataset.motion).toBe('minimal')
    expect(element.dataset.density).toBe('compact')
  })
})
