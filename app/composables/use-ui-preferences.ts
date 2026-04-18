export type UiMotionPreference = 'normal' | 'reduced' | 'minimal'
export type UiDensityPreference = 'comfortable' | 'compact'
export type UiFontScale = 'sm' | 'md' | 'lg'

type StoredUiPreferences = {
  motion?: UiMotionPreference
  density?: UiDensityPreference
  fontScale?: UiFontScale
  highContrast?: boolean
  underlineLinks?: boolean
}

const UI_MOTION_STORAGE_KEY = 'sipac:ui:motion-preference'
const UI_DENSITY_STORAGE_KEY = 'sipac:ui:density-preference'
const UI_FONT_SCALE_STORAGE_KEY = 'sipac:ui:font-scale-preference'
const UI_HIGH_CONTRAST_STORAGE_KEY = 'sipac:ui:high-contrast-preference'
const UI_UNDERLINE_LINKS_STORAGE_KEY = 'sipac:ui:underline-links-preference'

const UI_MOTION_COOKIE_KEY = 'sipac_ui_motion_preference'
const UI_DENSITY_COOKIE_KEY = 'sipac_ui_density_preference'
const UI_FONT_SCALE_COOKIE_KEY = 'sipac_ui_font_scale_preference'
const UI_HIGH_CONTRAST_COOKIE_KEY = 'sipac_ui_high_contrast_preference'
const UI_UNDERLINE_LINKS_COOKIE_KEY = 'sipac_ui_underline_links_preference'

let removeSystemMotionListener: (() => void) | null = null

function isUiMotionPreference(value: unknown): value is UiMotionPreference {
  return value === 'normal' || value === 'reduced' || value === 'minimal'
}

function isUiDensityPreference(value: unknown): value is UiDensityPreference {
  return value === 'comfortable' || value === 'compact'
}

function isUiFontScale(value: unknown): value is UiFontScale {
  return value === 'sm' || value === 'md' || value === 'lg'
}

function parseBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 'true' || value === '1') return true
  if (value === false || value === 'false' || value === '0') return false
  return undefined
}

function readStoredUiPreferences(): StoredUiPreferences | null {
  if (!import.meta.client) {
    return null
  }

  try {
    const rawMotion = localStorage.getItem(UI_MOTION_STORAGE_KEY)
    const rawDensity = localStorage.getItem(UI_DENSITY_STORAGE_KEY)
    const rawFontScale = localStorage.getItem(UI_FONT_SCALE_STORAGE_KEY)
    const rawHighContrast = localStorage.getItem(UI_HIGH_CONTRAST_STORAGE_KEY)
    const rawUnderlineLinks = localStorage.getItem(UI_UNDERLINE_LINKS_STORAGE_KEY)

    const stored: StoredUiPreferences = {}
    if (isUiMotionPreference(rawMotion)) stored.motion = rawMotion
    if (isUiDensityPreference(rawDensity)) stored.density = rawDensity
    if (isUiFontScale(rawFontScale)) stored.fontScale = rawFontScale
    const highContrast = parseBoolean(rawHighContrast)
    if (highContrast !== undefined) stored.highContrast = highContrast
    const underlineLinks = parseBoolean(rawUnderlineLinks)
    if (underlineLinks !== undefined) stored.underlineLinks = underlineLinks

    return stored
  } catch {
    return null
  }
}

function readCookieUiPreferences(input: {
  motionCookieValue: unknown
  densityCookieValue: unknown
  fontScaleCookieValue: unknown
  highContrastCookieValue: unknown
  underlineLinksCookieValue: unknown
}): StoredUiPreferences {
  const stored: StoredUiPreferences = {}

  if (isUiMotionPreference(input.motionCookieValue)) stored.motion = input.motionCookieValue
  if (isUiDensityPreference(input.densityCookieValue)) stored.density = input.densityCookieValue
  if (isUiFontScale(input.fontScaleCookieValue)) stored.fontScale = input.fontScaleCookieValue
  const highContrast = parseBoolean(input.highContrastCookieValue)
  if (highContrast !== undefined) stored.highContrast = highContrast
  const underlineLinks = parseBoolean(input.underlineLinksCookieValue)
  if (underlineLinks !== undefined) stored.underlineLinks = underlineLinks

  return stored
}

function persistUiPreference(key: string, value: string) {
  if (!import.meta.client) {
    return
  }

  try {
    localStorage.setItem(key, value)
  } catch {
    // Persistencia opcional; no debe bloquear UI
  }
}

export function createUiPreferencesStore(input: {
  systemReducedMotion: boolean
  saved: StoredUiPreferences | null
}) {
  const motionPreference = ref<UiMotionPreference>(
    input.saved?.motion ?? (input.systemReducedMotion ? 'reduced' : 'normal'),
  )
  const densityPreference = ref<UiDensityPreference>(input.saved?.density ?? 'comfortable')
  const fontScalePreference = ref<UiFontScale>(input.saved?.fontScale ?? 'md')
  const highContrastPreference = ref<boolean>(input.saved?.highContrast ?? false)
  const underlineLinksPreference = ref<boolean>(input.saved?.underlineLinks ?? false)

  return {
    motionPreference,
    densityPreference,
    fontScalePreference,
    highContrastPreference,
    underlineLinksPreference,
  }
}

export function useUiPreferences() {
  const motionCookie = useCookie<string | undefined>(UI_MOTION_COOKIE_KEY, {
    sameSite: 'lax',
    path: '/',
  })
  const densityCookie = useCookie<string | undefined>(UI_DENSITY_COOKIE_KEY, {
    sameSite: 'lax',
    path: '/',
  })
  const fontScaleCookie = useCookie<string | undefined>(UI_FONT_SCALE_COOKIE_KEY, {
    sameSite: 'lax',
    path: '/',
  })
  const highContrastCookie = useCookie<string | undefined>(UI_HIGH_CONTRAST_COOKIE_KEY, {
    sameSite: 'lax',
    path: '/',
  })
  const underlineLinksCookie = useCookie<string | undefined>(UI_UNDERLINE_LINKS_COOKIE_KEY, {
    sameSite: 'lax',
    path: '/',
  })

  const cookiePreferences = readCookieUiPreferences({
    motionCookieValue: motionCookie.value,
    densityCookieValue: densityCookie.value,
    fontScaleCookieValue: fontScaleCookie.value,
    highContrastCookieValue: highContrastCookie.value,
    underlineLinksCookieValue: underlineLinksCookie.value,
  })

  const motionPreference = useState<UiMotionPreference>(
    'ui-motion-preference',
    () => cookiePreferences.motion ?? 'normal',
  )
  const densityPreference = useState<UiDensityPreference>(
    'ui-density-preference',
    () => cookiePreferences.density ?? 'comfortable',
  )
  const fontScalePreference = useState<UiFontScale>(
    'ui-font-scale-preference',
    () => cookiePreferences.fontScale ?? 'md',
  )
  const highContrastPreference = useState<boolean>(
    'ui-high-contrast-preference',
    () => cookiePreferences.highContrast ?? false,
  )
  const underlineLinksPreference = useState<boolean>(
    'ui-underline-links-preference',
    () => cookiePreferences.underlineLinks ?? false,
  )

  const explicitMotionPreference = useState<boolean>('ui-motion-explicit-preference', () =>
    Boolean(cookiePreferences.motion),
  )
  const initialized = useState<boolean>('ui-preferences-initialized', () => false)

  const prefersReducedMotion = computed(() => motionPreference.value !== 'normal')
  const prefersMinimalMotion = computed(() => motionPreference.value === 'minimal')

  function initUiPreferences() {
    if (!import.meta.client || initialized.value) {
      return
    }

    const systemMotionQuery = matchMedia('(prefers-reduced-motion: reduce)')
    const stored = readStoredUiPreferences() ?? {}
    const cookieStored = readCookieUiPreferences({
      motionCookieValue: motionCookie.value,
      densityCookieValue: densityCookie.value,
      fontScaleCookieValue: fontScaleCookie.value,
      highContrastCookieValue: highContrastCookie.value,
      underlineLinksCookieValue: underlineLinksCookie.value,
    })
    const store = createUiPreferencesStore({
      systemReducedMotion: systemMotionQuery.matches,
      saved: {
        motion: cookieStored.motion ?? stored.motion,
        density: cookieStored.density ?? stored.density,
        fontScale: cookieStored.fontScale ?? stored.fontScale,
        highContrast: cookieStored.highContrast ?? stored.highContrast,
        underlineLinks: cookieStored.underlineLinks ?? stored.underlineLinks,
      },
    })

    motionPreference.value = store.motionPreference.value
    densityPreference.value = store.densityPreference.value
    fontScalePreference.value = store.fontScalePreference.value
    highContrastPreference.value = store.highContrastPreference.value
    underlineLinksPreference.value = store.underlineLinksPreference.value
    explicitMotionPreference.value = Boolean(cookieStored.motion ?? stored.motion)
    initialized.value = true

    motionCookie.value = motionPreference.value
    densityCookie.value = densityPreference.value
    fontScaleCookie.value = fontScalePreference.value
    highContrastCookie.value = highContrastPreference.value ? 'true' : 'false'
    underlineLinksCookie.value = underlineLinksPreference.value ? 'true' : 'false'

    if (!removeSystemMotionListener) {
      const onSystemMotionChange = (event: MediaQueryListEvent) => {
        if (explicitMotionPreference.value) {
          return
        }

        motionPreference.value = event.matches ? 'reduced' : 'normal'
      }

      systemMotionQuery.addEventListener('change', onSystemMotionChange)
      removeSystemMotionListener = () => {
        systemMotionQuery.removeEventListener('change', onSystemMotionChange)
      }
    }
  }

  function setMotionPreference(next: UiMotionPreference) {
    motionPreference.value = next
    explicitMotionPreference.value = true
    motionCookie.value = next
    persistUiPreference(UI_MOTION_STORAGE_KEY, next)
  }

  function setDensityPreference(next: UiDensityPreference) {
    densityPreference.value = next
    densityCookie.value = next
    persistUiPreference(UI_DENSITY_STORAGE_KEY, next)
  }

  function setFontScalePreference(next: UiFontScale) {
    fontScalePreference.value = next
    fontScaleCookie.value = next
    persistUiPreference(UI_FONT_SCALE_STORAGE_KEY, next)
  }

  function setHighContrastPreference(next: boolean) {
    highContrastPreference.value = next
    const serialized = next ? 'true' : 'false'
    highContrastCookie.value = serialized
    persistUiPreference(UI_HIGH_CONTRAST_STORAGE_KEY, serialized)
  }

  function setUnderlineLinksPreference(next: boolean) {
    underlineLinksPreference.value = next
    const serialized = next ? 'true' : 'false'
    underlineLinksCookie.value = serialized
    persistUiPreference(UI_UNDERLINE_LINKS_STORAGE_KEY, serialized)
  }

  return {
    motionPreference,
    densityPreference,
    fontScalePreference,
    highContrastPreference,
    underlineLinksPreference,
    prefersReducedMotion,
    prefersMinimalMotion,
    initUiPreferences,
    setMotionPreference,
    setDensityPreference,
    setFontScalePreference,
    setHighContrastPreference,
    setUnderlineLinksPreference,
  }
}
