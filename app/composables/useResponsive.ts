import { useBreakpoints } from '@vueuse/core'

const tailwindBreakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

type ResponsiveBreakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export function useResponsive() {
  const breakpoints = useBreakpoints(tailwindBreakpoints)
  const currentBreakpoint = breakpoints.active()

  const breakpoint = computed<ResponsiveBreakpoint>(() => {
    if (import.meta.server) {
      return 'lg'
    }

    const activeBreakpoint = currentBreakpoint.value
    if (
      activeBreakpoint === 'sm' ||
      activeBreakpoint === 'md' ||
      activeBreakpoint === 'lg' ||
      activeBreakpoint === 'xl' ||
      activeBreakpoint === '2xl'
    ) {
      return activeBreakpoint
    }

    return 'xs'
  })

  const isMobile = computed(() => (import.meta.server ? false : breakpoints.smaller('md').value))
  const isTablet = computed(() =>
    import.meta.server ? false : breakpoints.between('md', 'lg').value,
  )
  const isDesktop = computed(() =>
    import.meta.server ? true : breakpoints.greaterOrEqual('lg').value,
  )

  return {
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
  }
}
