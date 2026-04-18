import { describe, expect, it } from 'vitest'
import { createUiPreferencesStore } from '~~/app/composables/use-ui-preferences'

describe('createUiPreferencesStore', () => {
  it('defaults motion from system and density to comfortable', () => {
    const store = createUiPreferencesStore({
      systemReducedMotion: true,
      saved: null,
    })

    expect(store.motionPreference.value).toBe('reduced')
    expect(store.densityPreference.value).toBe('comfortable')
  })

  it('uses saved values when available', () => {
    const store = createUiPreferencesStore({
      systemReducedMotion: false,
      saved: {
        motion: 'minimal',
        density: 'compact',
      },
    })

    expect(store.motionPreference.value).toBe('minimal')
    expect(store.densityPreference.value).toBe('compact')
  })
})
