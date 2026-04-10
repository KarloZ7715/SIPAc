<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow?: string
    title: string
    description: string
    icon?: string
    compact?: boolean
  }>(),
  {
    eyebrow: '',
    icon: '',
    compact: false,
  },
)
</script>

<template>
  <section
    class="page-hero panel-surface paper-texture hero-warm fade-up relative overflow-hidden px-6 py-8 sm:px-8 sm:py-9"
  >
    <div
      class="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-sipac-200 opacity-20 blur-3xl"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute -bottom-16 -left-16 size-56 rounded-full bg-earth-200 opacity-15 blur-3xl"
      aria-hidden="true"
    />

    <div
      class="relative grid gap-6"
      :class="$slots.aside ? 'xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]' : ''"
    >
      <div class="space-y-5">
        <div v-if="eyebrow" class="section-chip">
          {{ eyebrow }}
        </div>

        <div class="flex items-start gap-4">
          <span
            v-if="icon"
            class="hero-icon-shell flex size-12 shrink-0 items-center justify-center rounded-3xl bg-white/78 text-sipac-700 shadow-[0_20px_44px_-34px_rgba(18,63,40,0.45)] ring-1 ring-white/75"
          >
            <UIcon :name="icon" class="size-6" />
          </span>

          <div class="min-w-0 space-y-3">
            <h1
              class="font-display text-3xl font-semibold text-text sm:text-4xl"
              :class="compact ? 'max-w-3xl' : 'max-w-4xl'"
            >
              {{ title }}
            </h1>
            <p
              class="max-w-3xl text-sm leading-7 text-text-muted sm:text-base"
              :class="compact ? 'max-w-2xl' : ''"
            >
              {{ description }}
            </p>
          </div>
        </div>

        <div v-if="$slots.badges" class="flex flex-wrap items-center gap-3">
          <slot name="badges" />
        </div>

        <div v-if="$slots.actions" class="flex flex-wrap gap-3 pt-1">
          <slot name="actions" />
        </div>

        <div v-if="$slots.default">
          <slot />
        </div>
      </div>

      <div v-if="$slots.aside" class="space-y-4">
        <slot name="aside" />
      </div>
    </div>
  </section>
</template>
