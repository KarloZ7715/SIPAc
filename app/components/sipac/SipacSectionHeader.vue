<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    eyebrow?: string
    title: string
    description?: string
    center?: boolean
    size?: 'lg' | 'md'
  }>(),
  {
    eyebrow: '',
    description: '',
    center: false,
    size: 'lg',
  },
)

const titleClass = computed(() =>
  props.size === 'md'
    ? 'mt-2 font-display text-2xl font-semibold text-text sm:text-3xl'
    : 'mt-3 font-display text-4xl font-semibold text-text sm:text-5xl',
)
</script>

<template>
  <div :class="props.center ? 'text-center' : ''">
    <p
      v-if="props.eyebrow"
      class="text-[0.72rem] font-semibold tracking-[0.22em] text-sipac-700 uppercase"
    >
      {{ props.eyebrow }}
    </p>
    <h2 :class="titleClass">
      {{ props.title }}
    </h2>
    <p
      v-if="props.description"
      class="mt-2 max-w-2xl text-sm leading-6 text-text-muted sm:text-base sm:leading-7"
      :class="props.center ? 'mx-auto' : ''"
    >
      {{ props.description }}
    </p>

    <div
      v-if="$slots.actions"
      class="mt-4 flex flex-wrap gap-3"
      :class="props.center ? 'justify-center' : ''"
    >
      <slot name="actions" />
    </div>
  </div>
</template>
