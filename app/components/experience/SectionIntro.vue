<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow?: string
    title: string
    description?: string
  }>(),
  {
    eyebrow: '',
    description: '',
  },
)
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div class="min-w-0">
      <p
        v-if="eyebrow"
        class="text-[0.68rem] font-semibold tracking-[0.18em] text-text-soft uppercase"
      >
        {{ eyebrow }}
      </p>
      <h2 class="mt-1 font-display text-2xl font-semibold text-text">{{ title }}</h2>
      <p v-if="description" class="mt-1 max-w-2xl text-sm leading-6 text-text-muted">
        {{ description }}
      </p>
    </div>

    <div v-if="$slots.actions" class="flex flex-wrap gap-3">
      <slot name="actions" />
    </div>
  </div>
</template>
