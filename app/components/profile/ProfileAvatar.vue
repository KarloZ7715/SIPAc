<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    name: string
    seed?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  {
    seed: '',
    size: 'lg',
  },
)

function hashString(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/u).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
})

const palette = [
  ['#f3e4c6', '#c96442'],
  ['#e8d4b8', '#a3552e'],
  ['#eadbc0', '#8c6d3f'],
  ['#e6d0b5', '#b35c32'],
  ['#d9c6a2', '#6b5330'],
]

const gradient = computed(() => {
  const key = (props.seed || props.name || 'sipac').toLowerCase()
  const index = hashString(key) % palette.length
  const [from, to] = palette[index]!
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'size-10 text-sm'
    case 'md':
      return 'size-14 text-lg'
    case 'lg':
      return 'size-20 text-2xl'
    case 'xl':
    default:
      return 'size-24 text-3xl'
  }
})
</script>

<template>
  <div
    class="relative inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-white shadow-[0_0_0_1px_rgb(20_20_19/0.06),0_24px_48px_-28px_rgb(20_20_19/0.18)] ring-4 ring-white/70"
    :class="sizeClasses"
    :style="{ background: gradient }"
    :aria-label="`Avatar de ${props.name}`"
    role="img"
  >
    <span class="drop-shadow-sm">{{ initials }}</span>
  </div>
</template>
