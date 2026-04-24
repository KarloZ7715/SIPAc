import { useMediaQuery } from '@vueuse/core'

/**
 * Detects low-end devices and user motion preferences.
 *
 * Target baseline: Android 2GB RAM (hardwareConcurrency <= 2 or deviceMemory <= 2).
 * Uses `shouldReduceAnimations` to gate heavy motion-v props and CSS transitions.
 */
export function useDeviceCapability() {
  const isLowEnd = computed(() => {
    if (import.meta.server) return false
    const nav = navigator as { hardwareConcurrency?: number; deviceMemory?: number }
    return (nav.hardwareConcurrency ?? 4) <= 2 || (nav.deviceMemory ?? 4) <= 2
  })

  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  const shouldReduceAnimations = computed(() => isLowEnd.value || prefersReducedMotion.value)

  return { isLowEnd, prefersReducedMotion, shouldReduceAnimations }
}
