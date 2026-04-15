<script setup lang="ts">
interface HomeRailItem {
  label: string
  value: string
  note: string
  icon: string
  tone?: 'primary' | 'earth' | 'neutral'
}

defineProps<{
  title: string
  description: string
  items: HomeRailItem[]
}>()

function toneClasses(tone: HomeRailItem['tone']) {
  if (tone === 'earth') {
    return {
      shell: 'home-rail-item home-rail-item-earth border-earth-200/80 bg-earth-50/78',
      icon: 'bg-white/88 text-earth-700',
      value: 'text-earth-800',
      pill: 'bg-earth-100/78 text-earth-700',
    }
  }

  if (tone === 'primary') {
    return {
      shell: 'home-rail-item home-rail-item-primary border-sipac-200/80 bg-sipac-50/82',
      icon: 'bg-white/88 text-sipac-700',
      value: 'text-sipac-800',
      pill: 'bg-sipac-100/78 text-sipac-700',
    }
  }

  return {
    shell: 'home-rail-item home-rail-item-neutral border-border/70 bg-white/84',
    icon: 'bg-surface-muted/92 text-text',
    value: 'text-text',
    pill: 'bg-surface-muted text-text-soft',
  }
}
</script>

<template>
  <section
    class="home-rail panel-surface relative overflow-hidden px-4 py-4 sm:px-5 sm:py-5 md:px-6"
  >
    <div class="home-rail-orb" aria-hidden="true" />

    <div class="relative space-y-5">
      <div class="space-y-2">
        <p class="text-[0.68rem] font-semibold tracking-[0.18em] text-text-soft uppercase">
          Señales de hoy
        </p>
        <h2 class="font-display text-xl font-medium leading-snug text-text">{{ title }}</h2>
        <p class="text-sm leading-[1.6] text-text-muted">{{ description }}</p>
      </div>

      <div class="space-y-3">
        <article
          v-for="item in items"
          :key="item.label"
          class="relative overflow-hidden rounded-[1.3rem] border px-4 py-4"
          :class="toneClasses(item.tone).shell"
        >
          <div
            class="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/70"
            aria-hidden="true"
          />

          <div class="flex items-start gap-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-2xl shadow-[0_16px_28px_-24px_rgb(20_20_19/0.22)]"
              :class="toneClasses(item.tone).icon"
            >
              <UIcon :name="item.icon" class="size-5" />
            </span>

            <div class="min-w-0 flex-1">
              <div
                class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <p class="text-sm font-semibold text-text">{{ item.label }}</p>
                <span
                  class="inline-flex w-fit max-w-full items-center justify-center rounded-full px-2.5 py-1 text-sm font-semibold whitespace-normal text-left sm:min-w-[2.25rem] sm:text-center"
                  :class="[toneClasses(item.tone).value, toneClasses(item.tone).pill]"
                >
                  {{ item.value }}
                </span>
              </div>
              <p class="mt-2 text-sm leading-6 text-text-muted">
                {{ item.note }}
              </p>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
