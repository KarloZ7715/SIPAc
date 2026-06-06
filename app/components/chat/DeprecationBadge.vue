<script setup lang="ts">
/**
 * Badge reutilizable para marcar opciones de modelo (chat, OCR, NER, etc.) que
 * están a punto de deprecarse o ya lo están. El icono `clock-3` y el tooltip
 * se basan en la fecha real (`deprecationDateIso`) — no en texto hardcoded.
 *
 * Ejemplo de uso:
 *   <DeprecationBadge
 *     :deprecation-date-iso="option.deprecationDateIso"
 *     :badge-text="option.deprecationBadgeText"
 *   />
 */
type BadgeSize = 'xs' | 'sm' | 'md'

const props = withDefaults(
  defineProps<{
    /** Fecha ISO en la que el modelo se depreca (ej. "2026-05-27T00:00:00.000Z"). */
    deprecationDateIso?: string
    /** Texto del tooltip/badge. Si está vacío, se autogenera desde la fecha. */
    badgeText?: string
    /** Tamaño del badge. Por defecto 'sm' (4x4, igual que el composer actual). */
    size?: BadgeSize
  }>(),
  { deprecationDateIso: '', badgeText: '', size: 'sm' },
)

const SIZE_CLASSES: Record<BadgeSize, string> = {
  xs: 'size-3',
  sm: 'size-4',
  md: 'size-5',
}

const ICON_CLASSES: Record<BadgeSize, string> = {
  xs: 'size-2',
  sm: 'size-2.5',
  md: 'size-3',
}

function defaultBadgeText(deprecationDateIso: string | undefined): string {
  if (!deprecationDateIso) return ''
  const date = new Date(deprecationDateIso)
  if (Number.isNaN(date.getTime())) return ''
  return `Se depreca el ${date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}`
}

const tooltip = computed(() => props.badgeText || defaultBadgeText(props.deprecationDateIso))
</script>

<template>
  <span
    v-if="deprecationDateIso"
    class="inline-flex shrink-0 items-center justify-center rounded-full border border-warning/35 bg-warning/10 text-warning"
    :class="SIZE_CLASSES[size]"
    :title="tooltip"
    :aria-label="tooltip"
  >
    <UIcon name="i-lucide-clock-3" :class="ICON_CLASSES[size]" />
  </span>
</template>
