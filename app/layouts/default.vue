<script setup lang="ts">
const DEFAULT_SIDEBAR_WIDTH_REM = 18.5
const MIN_SIDEBAR_WIDTH_REM = 16.5
const MAX_SIDEBAR_WIDTH_REM = 24
const COLLAPSED_SIDEBAR_WIDTH_REM = 5.75
const SIDEBAR_WIDTH_STORAGE_KEY = 'sipac:layout:sidebar-width'
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'sipac:layout:sidebar-collapsed'
const SIDEBAR_WIDTH_COOKIE_KEY = 'sipac_layout_sidebar_width'
const SIDEBAR_COLLAPSED_COOKIE_KEY = 'sipac_layout_sidebar_collapsed'

const mobileSidebarOpen = useState<boolean>('sipac-mobile-sidebar-open', () => false)
const sidebarWidthCookie = useCookie<string>(SIDEBAR_WIDTH_COOKIE_KEY, {
  sameSite: 'lax',
  path: '/',
})
const sidebarCollapsedCookie = useCookie<string>(SIDEBAR_COLLAPSED_COOKIE_KEY, {
  sameSite: 'lax',
  path: '/',
})
const desktopSidebarCollapsed = useState<boolean>(
  'sipac-desktop-sidebar-collapsed',
  () => parseCollapsedState(sidebarCollapsedCookie.value) ?? false,
)
const desktopSidebarWidthRem = useState<number>('sipac-desktop-sidebar-width-rem', () =>
  clampSidebarWidth(parseSidebarWidth(sidebarWidthCookie.value) ?? DEFAULT_SIDEBAR_WIDTH_REM),
)

const route = useRoute()
const { layoutRoutePath } = usePageMotion()
const { densityPreference, initUiPreferences } = useUiPreferences()
const { applyCurrentUiRootAttributes } = useUiRootAttributes()

const isCompactDensity = computed(() => densityPreference.value === 'compact')
const isChatRoute = computed(() => layoutRoutePath.value.startsWith('/chat'))
const isWorkspaceDocumentsRoute = computed(() => layoutRoutePath.value === '/workspace-documents')
const isWideWorkspaceRoute = computed(
  () =>
    layoutRoutePath.value === '/' ||
    layoutRoutePath.value === '/dashboard' ||
    layoutRoutePath.value === '/repository' ||
    isWorkspaceDocumentsRoute.value,
)

const isSidebarResizing = ref(false)
const isLayoutReady = ref(false)
let stopSidebarResizeListeners: (() => void) | null = null

function clampSidebarWidth(nextWidth: number) {
  return Math.min(MAX_SIDEBAR_WIDTH_REM, Math.max(MIN_SIDEBAR_WIDTH_REM, nextWidth))
}

function parseSidebarWidth(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseCollapsedState(value: unknown) {
  if (value === true || value === '1' || value === 'true') {
    return true
  }
  if (value === false || value === '0' || value === 'false') {
    return false
  }
  return null
}

function hasSidebarWidthCookie() {
  return parseSidebarWidth(sidebarWidthCookie.value) !== null
}

function hasSidebarCollapsedCookie() {
  return parseCollapsedState(sidebarCollapsedCookie.value) !== null
}

function readRootFontSize() {
  if (!import.meta.client) {
    return 16
  }

  const fontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 16
}

function persistSidebarWidth(nextWidth: number) {
  const normalized = String(clampSidebarWidth(nextWidth))
  sidebarWidthCookie.value = normalized

  if (!import.meta.client) {
    return
  }

  try {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, normalized)
  } catch {
    // Persistencia opcional; no debe bloquear el shell.
  }
}

function persistSidebarCollapsed(nextCollapsed: boolean) {
  const normalized = nextCollapsed ? '1' : '0'
  sidebarCollapsedCookie.value = normalized

  if (!import.meta.client) {
    return
  }

  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, normalized)
  } catch {
    // Persistencia opcional; no debe bloquear el shell.
  }
}

function syncSidebarWidthFromStorage() {
  if (!import.meta.client) {
    return
  }

  if (hasSidebarWidthCookie()) {
    return
  }

  try {
    const rawValue = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
    const parsed = parseSidebarWidth(rawValue)

    if (parsed !== null) {
      desktopSidebarWidthRem.value = clampSidebarWidth(parsed)
      sidebarWidthCookie.value = String(clampSidebarWidth(parsed))
    }
  } catch {
    desktopSidebarWidthRem.value = clampSidebarWidth(desktopSidebarWidthRem.value)
  }
}

function syncSidebarCollapsedFromStorage() {
  if (!import.meta.client) {
    return
  }

  if (hasSidebarCollapsedCookie()) {
    return
  }

  try {
    const rawValue = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)
    const parsed = parseCollapsedState(rawValue)
    if (parsed !== null) {
      desktopSidebarCollapsed.value = parsed
      sidebarCollapsedCookie.value = parsed ? '1' : '0'
    }
  } catch {
    desktopSidebarCollapsed.value = false
  }
}

function updateSidebarWidthFromClientX(clientX: number) {
  if (!import.meta.client) {
    return
  }

  const nextWidth = clampSidebarWidth(clientX / readRootFontSize())
  desktopSidebarWidthRem.value = nextWidth
}

function stopSidebarResize() {
  stopSidebarResizeListeners?.()
  stopSidebarResizeListeners = null
  isSidebarResizing.value = false

  if (!import.meta.client) {
    return
  }

  document.body.style.removeProperty('cursor')
  document.body.style.removeProperty('user-select')
}

function startSidebarResize(event: MouseEvent | TouchEvent) {
  if (!import.meta.client) {
    return
  }

  if (desktopSidebarCollapsed.value) {
    desktopSidebarCollapsed.value = false
  }

  stopSidebarResize()
  isSidebarResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  const onMove = (moveEvent: globalThis.MouseEvent | globalThis.TouchEvent) => {
    const point =
      'touches' in moveEvent ? (moveEvent.touches[0] ?? moveEvent.changedTouches[0]) : moveEvent

    if (!point) {
      return
    }

    updateSidebarWidthFromClientX(point.clientX)
  }

  const onEnd = () => {
    stopSidebarResize()
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onEnd)
  window.addEventListener('touchmove', onMove, { passive: true })
  window.addEventListener('touchend', onEnd)
  window.addEventListener('touchcancel', onEnd)

  stopSidebarResizeListeners = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onEnd)
    window.removeEventListener('touchmove', onMove)
    window.removeEventListener('touchend', onEnd)
    window.removeEventListener('touchcancel', onEnd)
  }

  const startPoint = 'touches' in event ? event.touches[0] : event
  if (startPoint) {
    updateSidebarWidthFromClientX(startPoint.clientX)
  }
}

function toggleDesktopSidebarCollapsed() {
  desktopSidebarCollapsed.value = !desktopSidebarCollapsed.value
}

const resolvedSidebarWidthRem = computed(() =>
  desktopSidebarCollapsed.value
    ? COLLAPSED_SIDEBAR_WIDTH_REM
    : clampSidebarWidth(desktopSidebarWidthRem.value),
)

const desktopSidebarStyle = computed(() => ({
  width: `${resolvedSidebarWidthRem.value}rem`,
  minWidth: `${resolvedSidebarWidthRem.value}rem`,
  maxWidth: `${resolvedSidebarWidthRem.value}rem`,
}))

const contentWidthClass = computed(() => {
  if (isChatRoute.value) {
    return 'max-w-none w-full'
  }

  if (isWideWorkspaceRoute.value) {
    return 'max-w-[96rem] xl:px-10'
  }

  return 'max-w-[75rem]'
})

const contentSpacingClass = computed(() => {
  if (isChatRoute.value) {
    return 'py-0'
  }

  if (isWideWorkspaceRoute.value) {
    return isCompactDensity.value ? 'py-3 lg:py-4' : 'py-4 lg:py-5'
  }

  return isCompactDensity.value ? 'py-4 lg:py-5' : 'py-5 lg:py-6'
})

const mainHorizontalPaddingClass = computed(() =>
  isChatRoute.value
    ? isCompactDensity.value
      ? 'px-2.5 sm:px-3 lg:px-4'
      : 'px-3 sm:px-4 lg:px-5'
    : isCompactDensity.value
      ? 'px-3 sm:px-5 lg:px-6'
      : 'px-4 sm:px-6 lg:px-8',
)

const chatMainLayoutClass = computed(() =>
  isChatRoute.value ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : '',
)

const shellRootClass = computed(() =>
  isChatRoute.value
    ? 'app-shell-bg flex h-dvh max-h-dvh flex-col overflow-hidden'
    : 'app-shell-bg min-h-screen',
)

const shellBodyClass = computed(() =>
  isChatRoute.value ? 'flex min-h-0 flex-1 overflow-hidden' : 'flex min-h-screen',
)

const desktopSidebarFrameClass = computed(() => {
  const base = isChatRoute.value
    ? 'relative hidden h-full min-h-0 shrink-0 border-r border-border/70 lg:flex'
    : 'sticky top-0 hidden h-dvh max-h-dvh shrink-0 border-r border-border/70 lg:flex'

  const transition = isLayoutReady.value
    ? 'transition-[width,min-width,max-width] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)]'
    : ''

  return `${base} ${transition}`
})

const desktopSidebarSurfaceClass = computed(() =>
  isChatRoute.value
    ? 'flex h-full min-h-0 flex-1 overflow-hidden'
    : 'flex h-dvh max-h-dvh min-h-0 flex-1 overflow-hidden',
)

const mainColumnClass = computed(() =>
  isChatRoute.value
    ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
    : 'flex min-h-screen min-w-0 flex-1 flex-col',
)

watch(
  () => route.fullPath,
  () => {
    mobileSidebarOpen.value = false
  },
)

watch(
  desktopSidebarWidthRem,
  (nextWidth) => {
    persistSidebarWidth(clampSidebarWidth(nextWidth))
  },
  { immediate: true },
)

watch(
  desktopSidebarCollapsed,
  () => {
    stopSidebarResize()
    persistSidebarCollapsed(desktopSidebarCollapsed.value)
  },
  { immediate: true },
)

onMounted(() => {
  if (import.meta.client) {
    syncSidebarCollapsedFromStorage()
    syncSidebarWidthFromStorage()

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isLayoutReady.value = true
      })
    })
  }

  initUiPreferences()
  applyCurrentUiRootAttributes()
})

onBeforeUnmount(() => {
  stopSidebarResize()
})
</script>

<template>
  <div :class="shellRootClass">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:rounded-full focus:bg-sipac-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#faf9f5]"
    >
      Saltar al contenido principal
    </a>

    <div :class="shellBodyClass">
      <div
        :class="[desktopSidebarFrameClass, isSidebarResizing ? '!duration-0' : '']"
        :style="desktopSidebarStyle"
      >
        <aside class="sipac-dashboard-sidebar overflow-hidden" :class="desktopSidebarSurfaceClass">
          <LayoutAppSidebar
            :collapsed="desktopSidebarCollapsed"
            @toggle-desktop-collapse="toggleDesktopSidebarCollapsed"
          />
        </aside>

        <button
          type="button"
          class="group absolute inset-y-0 -right-2 z-20 hidden w-4 cursor-col-resize touch-none items-center justify-center lg:flex"
          aria-label="Redimensionar barra lateral"
          :aria-valuemin="MIN_SIDEBAR_WIDTH_REM"
          :aria-valuemax="MAX_SIDEBAR_WIDTH_REM"
          :aria-valuenow="resolvedSidebarWidthRem"
          role="separator"
          @mousedown.prevent="startSidebarResize"
          @touchstart.prevent="startSidebarResize"
        >
          <span
            class="sipac-sidebar-resize-handle"
            :class="
              isSidebarResizing ? 'bg-sipac-400 shadow-[0_0_0_4px_rgb(201_100_66_/_0.12)]' : ''
            "
          />
        </button>
      </div>

      <div :class="mainColumnClass">
        <LayoutAppHeader />

        <main
          id="main-content"
          class="mx-auto w-full transition-[padding,max-width] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          :class="[
            mainHorizontalPaddingClass,
            contentWidthClass,
            contentSpacingClass,
            chatMainLayoutClass,
            isChatRoute ? 'min-h-0 flex-1' : '',
          ]"
        >
          <slot />
        </main>
      </div>
    </div>

    <USlideover
      v-model:open="mobileSidebarOpen"
      side="left"
      :overlay="true"
      :ui="{
        content: 'max-w-[18.5rem] border-r border-border/80 bg-surface/98 backdrop-blur-xl',
      }"
    >
      <template #body>
        <div class="h-full overflow-y-auto">
          <LayoutAppSidebar mobile />
        </div>
      </template>
    </USlideover>
  </div>
</template>
