<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    color?: 'primary' | 'neutral' | 'success' | 'warning' | 'error' | 'info'
    variant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    type?: 'button' | 'submit' | 'reset'
    to?: string
    icon?: string
    trailing?: boolean
    loading?: boolean
    block?: boolean
  }>(),
  {
    color: 'primary',
    variant: 'solid',
    size: 'md',
    type: 'button',
    to: undefined,
    icon: undefined,
    trailing: false,
    loading: false,
    block: false,
  },
)
</script>

<template>
  <UButton
    v-bind="$attrs"
    :type="props.type"
    :to="props.to"
    :icon="props.icon"
    :trailing="props.trailing"
    :loading="props.loading"
    :block="props.block"
    :color="props.color"
    :variant="props.variant"
    :size="props.size"
  >
    <slot />
  </UButton>
</template>
