<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    variant?: 'solid' | 'outline' | 'soft' | 'subtle'
    interactive?: boolean
  }>(),
  {
    variant: 'subtle',
    interactive: false,
  },
)
</script>

<template>
  <UCard :variant="props.variant" :class="props.interactive ? 'interactive-card' : undefined">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>

    <slot />

    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </UCard>
</template>
