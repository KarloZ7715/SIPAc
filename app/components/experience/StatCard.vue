<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    caption?: string
    icon?: string
    tone?: 'primary' | 'earth' | 'neutral'
    trend?: string
  }>(),
  {
    caption: '',
    icon: '',
    tone: 'primary',
    trend: '',
  },
)

const toneClasses = computed(() => {
  if (props.tone === 'earth') {
    return {
      badge: 'bg-earth-50 text-earth-700',
      value: 'text-earth-700',
      ring: 'hover:border-earth-200',
    }
  }

  if (props.tone === 'neutral') {
    return {
      badge: 'bg-surface-muted text-text',
      value: 'text-text',
      ring: 'hover:border-border',
    }
  }

  return {
    badge: 'bg-sipac-50 text-sipac-700',
    value: 'text-sipac-700',
    ring: 'hover:border-sipac-200',
  }
})
</script>

<template>
  <SipacCard class="card-glow" :class="toneClasses.ring" interactive>
    <template #header>
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
            {{ label }}
          </p>
          <p
            class="mt-3 text-4xl font-semibold tabular-nums counter-animate"
            :class="toneClasses.value"
          >
            {{ value }}
          </p>
        </div>

        <span
          v-if="icon"
          class="flex size-10 items-center justify-center rounded-2xl"
          :class="toneClasses.badge"
        >
          <UIcon :name="icon" class="size-5" />
        </span>
      </div>
    </template>

    <p v-if="caption" class="text-sm leading-6 text-text-muted">{{ caption }}</p>
    <p v-if="trend" class="mt-2 text-sm font-medium text-sipac-700">{{ trend }}</p>

    <template v-if="$slots.default">
      <slot />
    </template>
  </SipacCard>
</template>
