<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    eyebrow?: string
    title: string
    description?: string
    icon?: string
    tone?: 'primary' | 'earth' | 'neutral'
  }>(),
  {
    eyebrow: '',
    description: '',
    icon: '',
    tone: 'neutral',
  },
)

const toneClasses = computed(() => {
  if (props.tone === 'primary') {
    return {
      shell: 'border-sipac-200/80 bg-sipac-50/78 shadow-[0_20px_40px_-34px_rgba(17,46,29,0.22)]',
      icon: 'bg-white text-sipac-700',
    }
  }

  if (props.tone === 'earth') {
    return {
      shell: 'border-earth-200/80 bg-earth-50/68 shadow-[0_20px_40px_-34px_rgba(88,57,30,0.18)]',
      icon: 'bg-white text-earth-700',
    }
  }

  return {
    shell: 'border-border/75 bg-white/84 shadow-[0_18px_34px_-30px_rgba(17,46,29,0.14)]',
    icon: 'bg-surface-muted text-sipac-700',
  }
})
</script>

<template>
  <div class="rounded-[1.45rem] border p-5 backdrop-blur-sm" :class="toneClasses.shell">
    <div class="flex items-start gap-3">
      <span
        v-if="icon"
        class="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl"
        :class="toneClasses.icon"
      >
        <UIcon :name="icon" class="size-5" />
      </span>

      <div class="min-w-0 flex-1">
        <p
          v-if="eyebrow"
          class="text-[0.68rem] font-semibold tracking-[0.16em] text-text-soft uppercase"
        >
          {{ eyebrow }}
        </p>
        <h3 class="mt-1 font-semibold text-text">{{ title }}</h3>
        <p v-if="description" class="mt-2 text-sm leading-6 text-text-muted">
          {{ description }}
        </p>

        <div v-if="$slots.default" class="mt-4">
          <slot />
        </div>

        <div v-if="$slots.footer" class="mt-4">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </div>
</template>
