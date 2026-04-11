<script setup lang="ts">
import DocumentPreviewWithHighlights from '~~/app/components/dashboard/DocumentPreviewWithHighlights.vue'

export type AnalysisHighlightView = {
  id: string
  message: string
  leaving: boolean
}

defineProps<{
  previewUrl: string | null
  mimeType: string
  analysisProgress: number
  analysisHighlights: AnalysisHighlightView[]
  reducedMotion: boolean
  maxVisibleHighlights: number
}>()

const emit = defineEmits<{
  previewExpand: []
}>()
</script>

<template>
  <div
    class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-stretch xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-stretch"
  >
    <div class="panel-muted flex min-h-0 min-w-0 flex-col overflow-hidden p-0">
      <DocumentPreviewWithHighlights
        :preview-url="previewUrl"
        :mime-type="mimeType"
        :groups="[]"
        :active-key="null"
        @preview-expand="emit('previewExpand')"
      />

      <div
        class="mx-3 mb-3 mt-4 rounded-[1rem] border border-border/70 bg-white/82 px-4 py-3 sm:mx-4 sm:mb-4 lg:mx-5 lg:mb-5"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm font-semibold text-text">Vista previa</p>
          <p class="text-xs font-semibold tracking-[0.14em] text-text-soft uppercase">
            Sigue abierta
          </p>
        </div>
        <p class="mt-2 text-sm leading-6 text-text-muted">
          Mantén el documento a la vista mientras preparamos la ficha; así podrás comparar cada dato
          con calma.
        </p>
      </div>
    </div>

    <div class="flex min-h-0 min-w-0 flex-col gap-4 lg:max-w-[22rem]">
      <div
        class="rounded-[1.35rem] border border-sipac-200 bg-sipac-50/72 p-5 shadow-[0_20px_40px_-34px_rgba(17,46,29,0.2)]"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div class="flex items-start gap-3">
          <span class="loader-orbit mt-0.5" aria-hidden="true">
            <span class="loader-orbit-dot" />
          </span>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="font-semibold text-text">Preparando tu ficha…</p>
              <p class="analysis-meter text-sm font-semibold text-sipac-700">
                {{ analysisProgress }}%
              </p>
            </div>
            <p class="mt-2 text-sm leading-6 text-text-muted">
              Esto puede tardar un poco; puedes dejar la página abierta y seguir el avance aquí.
            </p>
            <div class="mt-4 analysis-pulse-track" aria-hidden="true">
              <div
                class="analysis-pulse-bar"
                :style="{ width: `${Math.max(18, analysisProgress)}%` }"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        class="analysis-highlights-shell"
        :class="{ 'analysis-highlights-shell-static': reducedMotion }"
        :style="{
          '--analysis-highlights-capacity': String(maxVisibleHighlights),
        }"
        role="region"
        aria-label="Detalles del avance"
      >
        <TransitionGroup
          v-if="!reducedMotion"
          name="analysis-highlight"
          tag="div"
          class="analysis-highlights-list"
        >
          <article
            v-for="highlight in analysisHighlights"
            :key="highlight.id"
            class="analysis-highlight-card rounded-[1.1rem] border border-border/75 bg-white/88 px-4 py-4 shadow-[0_18px_34px_-30px_rgba(17,46,29,0.14)]"
            :class="{
              'analysis-highlight-card-leaving': highlight.leaving,
            }"
          >
            <div class="flex items-start gap-3">
              <span class="analysis-step-dot" aria-hidden="true" />
              <p class="min-w-0 text-sm leading-6 text-text-muted">
                {{ highlight.message }}
              </p>
            </div>
          </article>
        </TransitionGroup>

        <div v-else class="analysis-highlights-list space-y-3">
          <article
            v-for="highlight in analysisHighlights"
            :key="highlight.id"
            class="rounded-[1.1rem] border border-border/75 bg-white/88 px-4 py-4 shadow-[0_18px_34px_-30px_rgba(17,46,29,0.14)]"
          >
            <div class="flex items-start gap-3">
              <span class="analysis-step-dot" aria-hidden="true" />
              <p class="min-w-0 text-sm leading-6 text-text-muted">
                {{ highlight.message }}
              </p>
            </div>
          </article>
          <p v-if="!analysisHighlights.length" class="text-sm leading-6 text-text-muted">
            Leyendo el archivo…
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
