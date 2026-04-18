<script setup lang="ts">
defineProps<{
  chapter: string
  title: string
  description?: string
}>()
</script>

<template>
  <header class="relative mb-6 space-y-2">
    <p
      class="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-text-soft uppercase"
    >
      <span class="block h-px w-6 bg-text-soft/40" aria-hidden="true" />
      {{ chapter }}
    </p>
    <h2 class="font-display text-3xl leading-[1.15] font-medium text-text md:text-4xl">
      {{ title }}
    </h2>
    <p v-if="description" class="max-w-2xl text-sm leading-[1.7] text-text-muted md:text-base">
      {{ description }}
    </p>
  </header>
</template>
