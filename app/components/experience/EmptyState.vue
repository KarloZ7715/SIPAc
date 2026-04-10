<script setup lang="ts">
withDefaults(
  defineProps<{
    icon: string
    title: string
    description: string
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)
</script>

<template>
  <div
    class="rounded-2xl border border-dashed border-border bg-surface-muted/35 text-center"
    :class="compact ? 'px-4 py-6' : 'px-5 py-8'"
  >
    <span
      class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white/80 text-text-soft shadow-[0_14px_24px_-22px_rgba(17,46,29,0.15)]"
    >
      <UIcon :name="icon" class="size-6" />
    </span>
    <h3 class="mt-3 text-sm font-semibold text-text">{{ title }}</h3>
    <p class="mx-auto mt-1 max-w-md text-sm leading-6 text-text-muted">
      {{ description }}
    </p>

    <div v-if="$slots.actions" class="mt-4 flex justify-center">
      <slot name="actions" />
    </div>
  </div>
</template>
