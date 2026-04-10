<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    to: string
    icon: string
    label: string
    caption?: string
    active?: boolean
    collapsed?: boolean
    emphasis?: 'active' | 'quick' | 'neutral'
  }>(),
  {
    caption: '',
    active: false,
    collapsed: false,
    emphasis: 'neutral',
  },
)

const baseClass =
  'interactive-card group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-[background-color,border-color,box-shadow,color] duration-200'

const emphasisClass = computed(() => {
  if (props.emphasis === 'quick' && props.active) {
    return 'border border-sipac-200 bg-sipac-50 text-sipac-800 shadow-[0_12px_24px_-24px_rgba(18,63,40,0.35)]'
  }

  if (props.active || props.emphasis === 'active') {
    return 'bg-sipac-700 text-white shadow-[0_16px_30px_-22px_rgba(18,63,40,0.6)]'
  }

  if (props.emphasis === 'quick') {
    return 'border border-sipac-100/80 bg-sipac-50/78 text-text hover:border-sipac-200 hover:bg-sipac-50'
  }

  return 'text-text hover:border-sipac-200 hover:bg-sipac-50/70'
})

const iconClass = computed(() => {
  if (props.emphasis === 'quick' && props.active) {
    return 'bg-white text-sipac-700 ring-1 ring-sipac-200'
  }

  if (props.active || props.emphasis === 'active') {
    return 'bg-white/14 text-white'
  }

  if (props.emphasis === 'quick') {
    return 'bg-white text-sipac-700 ring-1 ring-sipac-100'
  }

  return 'bg-sipac-50 text-sipac-700 group-hover:bg-white'
})
</script>

<template>
  <NuxtLink
    :to="props.to"
    :aria-label="props.collapsed ? props.label : undefined"
    :aria-current="props.active ? 'page' : undefined"
    :title="props.collapsed ? props.label : undefined"
    :class="[baseClass, emphasisClass]"
  >
    <span
      class="flex size-10 shrink-0 items-center justify-center rounded-2xl transition-colors duration-200"
      :class="iconClass"
    >
      <UIcon :name="props.icon" class="size-5" aria-hidden="true" />
    </span>

    <span v-if="!props.collapsed" class="min-w-0">
      <span class="block font-semibold">{{ props.label }}</span>
      <span
        v-if="props.caption"
        class="block min-w-0 truncate text-xs"
        :class="props.active && props.emphasis !== 'quick' ? 'text-white/72' : 'text-text-muted'"
      >
        {{ props.caption }}
      </span>
    </span>

    <span v-else class="sr-only">{{ props.label }}</span>
  </NuxtLink>
</template>
