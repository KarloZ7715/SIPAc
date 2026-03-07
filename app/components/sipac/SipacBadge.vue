<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    color?: 'primary' | 'neutral' | 'success' | 'warning' | 'error' | 'info'
    variant?: 'solid' | 'outline' | 'soft' | 'subtle'
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    color: 'neutral',
    variant: 'subtle',
    size: 'md',
  },
)
</script>

<template>
  <UBadge :color="props.color" :variant="props.variant" :size="props.size">
    <slot />
  </UBadge>
</template>
