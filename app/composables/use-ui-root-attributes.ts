import type {
  UiDensityPreference,
  UiFontScale,
  UiMotionPreference,
} from '~~/app/composables/use-ui-preferences'

export interface UiAccessibilityAttributes {
  fontScale?: UiFontScale
  highContrast?: boolean
  underlineLinks?: boolean
}

export function applyUiRootAttributes(
  element: HTMLElement,
  motion: UiMotionPreference,
  density: UiDensityPreference,
  accessibility?: UiAccessibilityAttributes,
) {
  element.dataset.motion = motion
  element.dataset.density = density
  if (accessibility?.fontScale) {
    element.dataset.fontScale = accessibility.fontScale
  }
  if (typeof accessibility?.highContrast === 'boolean') {
    element.dataset.contrast = accessibility.highContrast ? 'high' : 'normal'
  }
  if (typeof accessibility?.underlineLinks === 'boolean') {
    element.dataset.underline = accessibility.underlineLinks ? 'on' : 'off'
  }
}

export function useUiRootAttributes() {
  const {
    motionPreference,
    densityPreference,
    fontScalePreference,
    highContrastPreference,
    underlineLinksPreference,
    initUiPreferences,
  } = useUiPreferences()

  function buildAccessibility(): UiAccessibilityAttributes {
    return {
      fontScale: fontScalePreference.value,
      highContrast: highContrastPreference.value,
      underlineLinks: underlineLinksPreference.value,
    }
  }

  function applyCurrentUiRootAttributes() {
    if (!import.meta.client) {
      return
    }

    const accessibility = buildAccessibility()
    applyUiRootAttributes(
      document.documentElement,
      motionPreference.value,
      densityPreference.value,
      accessibility,
    )
    applyUiRootAttributes(
      document.body,
      motionPreference.value,
      densityPreference.value,
      accessibility,
    )
  }

  useHead(() => ({
    htmlAttrs: {
      'data-motion': motionPreference.value,
      'data-density': densityPreference.value,
      'data-font-scale': fontScalePreference.value,
      'data-contrast': highContrastPreference.value ? 'high' : 'normal',
      'data-underline': underlineLinksPreference.value ? 'on' : 'off',
    },
    bodyAttrs: {
      'data-motion': motionPreference.value,
      'data-density': densityPreference.value,
      'data-font-scale': fontScalePreference.value,
      'data-contrast': highContrastPreference.value ? 'high' : 'normal',
      'data-underline': underlineLinksPreference.value ? 'on' : 'off',
    },
  }))

  watch(
    [
      motionPreference,
      densityPreference,
      fontScalePreference,
      highContrastPreference,
      underlineLinksPreference,
    ],
    () => {
      applyCurrentUiRootAttributes()
    },
    { immediate: true },
  )

  if (import.meta.client) {
    initUiPreferences()
  }

  return {
    applyCurrentUiRootAttributes,
  }
}
