<script setup lang="ts">
interface HomeWorkstageAction {
  label: string
  to: string
  icon?: string
}

interface HomeWorkstageMetric {
  label: string
  value: string
  note: string
}

interface HomeWorkstageSignal {
  label: string
  value: string
  note: string
  icon: string
}

const props = defineProps<{
  eyebrow: string
  statusLabel: string
  statusTone?: 'primary' | 'earth' | 'neutral'
  title: string
  summary: string
  primaryAction: HomeWorkstageAction
  secondaryAction?: HomeWorkstageAction | null
  metrics: HomeWorkstageMetric[]
  focusEyebrow: string
  focusTitle: string
  focusValue: string
  focusMeta: string
  signals: HomeWorkstageSignal[]
}>()

const badgeColor = computed<'primary' | 'warning' | 'neutral'>(() => {
  if (props.statusTone === 'earth') {
    return 'warning'
  }

  if (props.statusTone === 'primary') {
    return 'primary'
  }

  return 'neutral'
})

const toneClasses = computed(() => {
  if (props.statusTone === 'earth') {
    return {
      shell: 'home-cockpit--earth',
      focus: 'home-focus-card--earth',
    }
  }

  if (props.statusTone === 'primary') {
    return {
      shell: 'home-cockpit--primary',
      focus: 'home-focus-card--primary',
    }
  }

  return {
    shell: 'home-cockpit--neutral',
    focus: 'home-focus-card--neutral',
  }
})
</script>

<template>
  <section
    class="home-cockpit panel-surface paper-texture relative overflow-hidden px-6 py-6 sm:px-8 sm:py-7"
    :class="toneClasses.shell"
  >
    <div class="home-cockpit-halo" aria-hidden="true" />
    <div class="home-cockpit-grid" aria-hidden="true" />

    <div class="relative space-y-6">
      <div class="flex flex-wrap items-center gap-3">
        <div class="home-eyebrow-chip">
          {{ eyebrow }}
        </div>

        <SipacBadge :color="badgeColor" variant="outline" size="md">
          {{ statusLabel }}
        </SipacBadge>
      </div>

      <div class="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_21rem] xl:items-start">
        <div class="space-y-5">
          <div class="space-y-3">
            <h1
              class="max-w-4xl font-display text-[2.4rem] leading-tight font-semibold text-text sm:text-[3.35rem]"
            >
              {{ title }}
            </h1>
            <p class="max-w-3xl text-sm leading-7 text-text-muted sm:text-base">
              {{ summary }}
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <SipacButton
              :to="primaryAction.to"
              :icon="primaryAction.icon"
              size="lg"
              class="shadow-[0_24px_40px_-28px_rgba(18,63,40,0.55)]"
            >
              {{ primaryAction.label }}
            </SipacButton>

            <SipacButton
              v-if="secondaryAction"
              :to="secondaryAction.to"
              :icon="secondaryAction.icon"
              color="neutral"
              variant="soft"
              size="lg"
            >
              {{ secondaryAction.label }}
            </SipacButton>
          </div>

          <div class="grid gap-3 md:grid-cols-3">
            <article
              v-for="metric in metrics"
              :key="metric.label"
              class="home-cockpit-metric rounded-[1.3rem] border border-white/70 bg-white/84 px-4 py-4 backdrop-blur-sm"
            >
              <p class="text-[0.68rem] font-semibold tracking-[0.16em] text-text-soft uppercase">
                {{ metric.label }}
              </p>
              <p class="mt-3 text-2xl font-semibold text-text">{{ metric.value }}</p>
              <p class="mt-2 text-sm leading-6 text-text-muted">{{ metric.note }}</p>
            </article>
          </div>
        </div>

        <aside
          class="home-focus-card rounded-[1.7rem] border border-white/65 px-5 py-5"
          :class="toneClasses.focus"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[0.68rem] font-semibold tracking-[0.18em] text-text-soft uppercase">
                {{ focusEyebrow }}
              </p>
              <h2 class="mt-3 text-xl font-semibold text-text">{{ focusTitle }}</h2>
            </div>

            <span class="home-focus-icon">
              <UIcon name="i-lucide-crosshair" class="size-5" />
            </span>
          </div>

          <div class="mt-5 rounded-[1.35rem] border border-white/70 bg-white/78 px-4 py-4">
            <p class="text-[0.68rem] font-semibold tracking-[0.18em] text-text-soft uppercase">
              Estado actual
            </p>
            <p class="mt-3 text-xl font-semibold text-text">
              {{ focusValue }}
            </p>
            <p class="mt-2 text-sm leading-6 text-text-muted">
              {{ focusMeta }}
            </p>
          </div>

          <div class="mt-5 space-y-3">
            <article
              v-for="signal in signals"
              :key="signal.label"
              class="rounded-[1.2rem] border border-border/60 bg-surface-elevated/92 px-4 py-3"
            >
              <div class="flex items-start gap-3">
                <span class="home-signal-icon">
                  <UIcon :name="signal.icon" class="size-4.5" />
                </span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-3">
                    <p class="text-sm font-semibold text-text">{{ signal.label }}</p>
                    <p class="text-sm font-semibold text-sipac-800">{{ signal.value }}</p>
                  </div>
                  <p class="mt-1 text-sm leading-6 text-text-muted">
                    {{ signal.note }}
                  </p>
                </div>
              </div>
            </article>
          </div>
        </aside>
      </div>
    </div>
  </section>
</template>
