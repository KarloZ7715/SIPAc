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
    class="empty-state-editorial rounded-[0.95rem] border border-dashed border-border/75 bg-surface-muted/30 text-center"
    :class="compact ? 'px-4 py-6' : 'px-5 py-10'"
  >
    <UIcon :name="icon" class="mx-auto block size-9 text-sipac-500/75" />
    <h3 class="mt-4 font-display text-[1.05rem] font-medium leading-snug tracking-tight text-text">
      {{ title }}
    </h3>
    <p class="mx-auto mt-1.5 max-w-md text-[0.875rem] leading-[1.65] text-text-muted">
      {{ description }}
    </p>

    <div v-if="$slots.actions" class="mt-5 flex justify-center">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.empty-state-editorial {
  position: relative;
  isolation: isolate;
}
.empty-state-editorial::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(50% 120% at 50% 0%, rgb(201 100 66 / 0.05), transparent 70%);
  z-index: -1;
  border-radius: inherit;
}
</style>
