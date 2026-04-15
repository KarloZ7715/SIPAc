<script setup lang="ts">
export interface WorkspaceStageStepView {
  label: string
  hint: string
  active: boolean
  complete: boolean
}

const props = defineProps<{
  eyebrow: string
  title: string
  description: string
  stageProgressPercent: number
  steps: WorkspaceStageStepView[]
}>()

const activeIdx = computed(() => {
  const idx = props.steps.findIndex((s) => s.active)
  return idx >= 0 ? idx : 0
})
</script>

<template>
  <section class="top-20 z-20" aria-labelledby="workspace-stage-title">
    <div
      class="border-b border-border/55 bg-gradient-to-b from-white/92 via-surface/90 to-surface-muted/88 px-4 py-3 shadow-[0_12px_32px_-26px_rgb(20_20_19/0.1)] backdrop-blur-md sm:px-5"
    >
      <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div class="min-w-0">
          <p class="text-[0.72rem] font-semibold tracking-[0.18em] text-text-soft uppercase">
            {{ eyebrow }}
          </p>
          <h1
            id="workspace-stage-title"
            class="mt-1 font-display text-lg font-medium leading-[1.2] text-text sm:text-xl sm:leading-[1.2]"
          >
            {{ title }}
          </h1>
          <p class="mt-1 line-clamp-2 text-sm leading-[1.6] text-text-muted">
            {{ description }}
          </p>
        </div>

        <div class="flex flex-col gap-3 xl:min-w-152 xl:max-w-2xl xl:flex-1">
          <div
            class="stage-progress-rail"
            role="progressbar"
            :aria-valuenow="stageProgressPercent"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`Avance del proceso: ${stageProgressPercent} por ciento`"
          >
            <div class="stage-progress-bar" :style="{ width: `${stageProgressPercent}%` }" />
          </div>

          <ol class="m-0 grid list-none gap-2 p-0 sm:grid-cols-3" aria-label="Pasos del proceso">
            <li
              v-for="(step, index) in steps"
              :key="step.label"
              class="stage-pill"
              :class="{
                'stage-pill-active': step.active,
                'stage-pill-complete': step.complete,
              }"
              :aria-current="step.active ? 'step' : undefined"
            >
              <span
                class="signal-dot"
                :class="{
                  'signal-dot-active': step.active,
                  'signal-dot-complete': step.complete,
                }"
                :aria-hidden="true"
              >
                {{ index + 1 }}
              </span>
              <div class="min-w-0">
                <p class="truncate text-xs font-medium tracking-[0.12em] text-text uppercase">
                  {{ step.label }}
                </p>
                <p class="mt-1 line-clamp-2 text-sm text-text-muted">{{ step.hint }}</p>
              </div>
            </li>
          </ol>

          <p class="sr-only">
            Paso actual: {{ steps[activeIdx]?.label ?? '' }}.
            {{ steps[activeIdx]?.hint ?? '' }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
