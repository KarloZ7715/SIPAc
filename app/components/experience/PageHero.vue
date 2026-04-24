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
    class="page-hero page-stage-hero panel-surface paper-texture hero-warm relative overflow-hidden px-4 py-6 max-[380px]:px-3.5 max-[380px]:py-5 sm:px-8 sm:py-9"
  >
    <div
      class="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-sipac-200/90 opacity-25 blur-3xl"
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
      <div class="space-y-4 sm:space-y-5">
        <div v-if="eyebrow" class="section-chip">
          {{ eyebrow }}
        </div>

        <div class="flex items-start gap-3 max-[380px]:gap-2.5 sm:gap-4">
          <span
            v-if="icon"
            class="hero-icon-shell flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/85 text-sipac-700 shadow-[0_4px_24px_rgba(0,0,0,0.06)] ring-1 ring-border/80 max-[380px]:size-9 max-[380px]:rounded-xl sm:size-12 sm:rounded-3xl"
          >
            <UIcon :name="icon" class="size-5 max-[380px]:size-4.5 sm:size-6" />
          </span>

          <div class="min-w-0 space-y-3">
            <h1
              class="font-display text-[1.58rem] font-medium leading-[1.12] text-text max-[380px]:text-[1.4rem] max-[380px]:leading-[1.1] sm:text-[1.875rem] sm:leading-[1.15] md:text-[2.25rem] md:leading-[1.2]"
              :class="compact ? 'max-w-3xl' : 'max-w-4xl'"
            >
              {{ title }}
            </h1>
            <p
              class="max-w-3xl text-sm leading-[1.6] text-text-muted max-[380px]:text-[0.94rem] max-[380px]:leading-[1.55] sm:text-base lg:text-xl"
              :class="compact ? 'max-w-2xl' : ''"
            >
              {{ description }}
            </p>
          </div>
        </div>

        <div v-if="$slots.badges" class="flex flex-wrap items-center gap-3">
          <slot name="badges" />
        </div>

        <div
          v-if="$slots.actions"
          class="flex flex-col gap-2.5 pt-1 sm:flex-row sm:flex-wrap sm:gap-3"
        >
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
