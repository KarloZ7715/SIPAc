import type { TransitionProps } from 'vue'

export type PageTransitionName = 'page-shell' | 'page-shell-soft' | 'page-shell-auth'

function isAuthRoute(path: string) {
  return path === '/login' || path === '/register'
}

export function resolvePageTransitionName(path: string): PageTransitionName {
  if (isAuthRoute(path)) {
    return 'page-shell-auth'
  }

  return 'page-shell'
}

export function applyPageTransitionRootState(element: HTMLElement, active: boolean) {
  element.dataset.pageTransition = active ? 'running' : 'idle'
}

export function usePageMotion() {
  const route = useRoute()
  const visibleRoutePath = useState<string>('page-motion-visible-route-path', () => route.path)
  const visibleRouteFullPath = useState<string>(
    'page-motion-visible-route-full-path',
    () => route.fullPath,
  )
  const layoutRoutePath = useState<string>('page-motion-layout-route-path', () => route.path)
  const isPageTransitionActive = useState<boolean>('page-motion-active', () => false)

  function syncVisibleRoute() {
    visibleRoutePath.value = route.path
    visibleRouteFullPath.value = route.fullPath
  }

  function syncLayoutRoute() {
    layoutRoutePath.value = route.path
  }

  function finishPageTransition() {
    syncVisibleRoute()
    syncLayoutRoute()

    if (!import.meta.client) {
      isPageTransitionActive.value = false
      return
    }

    requestAnimationFrame(() => {
      isPageTransitionActive.value = false
    })
  }

  const pageTransition = computed<TransitionProps>(() => ({
    name: resolvePageTransitionName(route.path),
    mode: 'out-in',
    onBeforeLeave: () => {
      isPageTransitionActive.value = true
    },
    onAfterLeave: () => {
      // Switch layout constraints after outgoing page is removed
      // but before incoming page enters
      syncLayoutRoute()
    },
    onAfterEnter: finishPageTransition,
    onEnterCancelled: finishPageTransition,
    onLeaveCancelled: finishPageTransition,
  }))

  return {
    pageTransition,
    visibleRoutePath: computed(() => visibleRoutePath.value),
    visibleRouteFullPath: computed(() => visibleRouteFullPath.value),
    layoutRoutePath: computed(() => layoutRoutePath.value),
    isPageTransitionActive: computed(() => isPageTransitionActive.value),
    syncVisibleRoute,
    syncLayoutRoute,
  }
}
