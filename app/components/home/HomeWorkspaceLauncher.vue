<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string
    outcome: string
    to: string
    icon: string
    label?: string
    tone?: 'primary' | 'earth' | 'neutral'
    active?: boolean
  }>(),
  {
    label: '',
    tone: 'neutral',
    active: false,
  },
)

const toneClasses = computed(() => {
  if (props.tone === 'earth') {
    return {
      shell: props.active
        ? 'home-dock-item-earth border-earth-300/85 bg-earth-50/82'
        : 'home-dock-item-earth border-earth-200/70 bg-white/90',
      icon: 'bg-earth-50/88 text-earth-700',
      label: 'text-earth-700',
      arrow: 'text-earth-700',
    }
  }

  if (props.tone === 'primary') {
    return {
      shell: props.active
        ? 'home-dock-item-primary border-sipac-300/85 bg-sipac-50/86'
        : 'home-dock-item-primary border-sipac-200/70 bg-white/90',
      icon: 'bg-sipac-50/88 text-sipac-700',
      label: 'text-sipac-700',
      arrow: 'text-sipac-700',
    }
  }

  return {
    shell: props.active
      ? 'home-dock-item-neutral border-border bg-surface-elevated/94'
      : 'home-dock-item-neutral border-border/70 bg-white/90',
    icon: 'bg-surface-muted/94 text-text',
    label: 'text-text-soft',
    arrow: 'text-text-soft',
  }
})
</script>

<template>
  <NuxtLink
    v-bind="$attrs"
    :to="to"
    class="home-dock-item group relative flex items-start gap-4 overflow-hidden rounded-[1.35rem] border px-4 py-4"
    :class="toneClasses.shell"
  >
    <div class="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/78" aria-hidden="true" />

    <span
      class="flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-[0_14px_24px_-22px_rgb(20_20_19/0.18)]"
      :class="toneClasses.icon"
    >
      <UIcon :name="icon" class="size-5" />
    </span>

    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <p class="text-base font-semibold text-text">{{ title }}</p>
        <span
          v-if="label"
          class="text-[0.68rem] font-semibold tracking-[0.16em] uppercase"
          :class="toneClasses.label"
        >
          {{ label }}
        </span>
      </div>
      <p class="mt-2 text-sm leading-6 text-text-muted">{{ outcome }}</p>
    </div>

    <span class="home-inline-arrow mt-1 hidden sm:flex" :class="toneClasses.arrow">
      <span class="sr-only">Abrir {{ title }}</span>
      <UIcon
        name="i-lucide-arrow-up-right"
        class="home-inline-arrow-icon size-4.5"
        aria-hidden="true"
      />
    </span>
  </NuxtLink>
</template>
