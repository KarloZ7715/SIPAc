<script setup lang="ts">
import { computed, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    loading?: boolean
  }>(),
  {
    loading: false,
  },
)

const documentsStore = useDocumentsStore()
const { workspaceStage, activeTrackedDocument, activeDocuments, uploading } =
  storeToRefs(documentsStore)

const {
  analysisProgress,
  analysisHighlights,
  analysisStartedAt,
  analysisFinishedAt,
  lastAnalysisDurationMs,
  startProcessingFeedback,
  stopProcessingFeedback,
} = useWorkspaceAnalysisFeedback()

const pipelineStatus = computed(() => activeTrackedDocument.value?.processingStatus)

const isAnalyzing = computed(() => {
  if (uploading.value) {
    return true
  }

  if (workspaceStage.value === 'analyzing') {
    return true
  }

  if (activeDocuments.value.length > 0) {
    return true
  }

  return ['pending', 'processing'].includes(pipelineStatus.value ?? '')
})

watch(
  isAnalyzing,
  (active) => {
    if (active) {
      startProcessingFeedback()
      return
    }

    stopProcessingFeedback()
  },
  { immediate: true },
)

const latestHighlights = computed(() =>
  isAnalyzing.value ? analysisHighlights.value.slice(0, 3).reverse() : [],
)

const lastRunLabel = computed(() => {
  if (!analysisFinishedAt.value || lastAnalysisDurationMs.value == null) {
    return null
  }

  if (lastAnalysisDurationMs.value < 1000) {
    return `${lastAnalysisDurationMs.value} ms`
  }

  return `${(lastAnalysisDurationMs.value / 1000).toFixed(1)} s`
})

const statusLabel = computed(() => {
  if (isAnalyzing.value) {
    return 'Procesando'
  }

  if (['review', 'ready', 'confirmed'].includes(workspaceStage.value)) {
    return 'Completado'
  }

  if (props.loading) {
    return 'Sincronizando'
  }

  return 'En reposo'
})

const statusColor = computed(() => {
  if (isAnalyzing.value) {
    return 'primary'
  }

  if (['review', 'ready', 'confirmed'].includes(workspaceStage.value)) {
    return 'success'
  }

  if (props.loading) {
    return 'warning'
  }

  return 'success'
})
</script>

<template>
  <div
    class="relative overflow-hidden rounded-2xl bg-surface border border-border/80 shadow-sm p-5 flex flex-col gap-4"
  >
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-primary/10 text-primary-600 rounded-lg">
          <UIcon
            :name="isAnalyzing ? 'i-lucide-loader' : 'i-lucide-activity'"
            :class="['size-5', { 'animate-spin': isAnalyzing }]"
          />
        </div>
        <div>
          <h3 class="font-display text-sm font-medium leading-snug text-text">
            Telemetría de análisis
          </h3>
          <p class="mt-0.5 text-xs leading-[1.43] text-text-muted">
            Estado de actividad del pipeline
          </p>
        </div>
      </div>
      <UBadge
        :color="statusColor"
        variant="subtle"
        size="sm"
        class="transition-colors rounded-full"
      >
        {{ statusLabel }}
      </UBadge>
    </div>

    <div
      class="rounded-xl border border-border/70 bg-surface-muted/60 p-4 font-mono text-xs flex flex-col gap-2 min-h-[126px]"
    >
      <div class="flex justify-between text-text-soft mb-1 border-b border-border/60 pb-2">
        <span>SIPAc Core</span>
        <span v-if="isAnalyzing && analysisStartedAt">RUNNING</span>
        <span v-else-if="['review', 'ready', 'confirmed'].includes(workspaceStage)">COMPLETED</span>
        <span v-else>IDLE</span>
      </div>

      <div class="flex-1 flex flex-col justify-end gap-1">
        <template v-if="!isAnalyzing && !latestHighlights.length">
          <div class="text-text-soft/80">Sin actividad de análisis en este momento.</div>
        </template>
        <template v-else>
          <div
            v-for="(highlight, idx) in latestHighlights"
            :key="highlight.id"
            :class="[
              'transition-opacity duration-300 flex gap-2',
              idx === latestHighlights.length - 1
                ? 'text-primary-700 opacity-100 font-semibold'
                : 'text-text-soft/80 opacity-85',
            ]"
          >
            <span class="text-text-soft/70">></span>
            <span>{{ highlight.message }}</span>
          </div>
        </template>
      </div>

      <div v-if="isAnalyzing" class="mt-3 flex items-center gap-3">
        <div class="text-primary-600 w-10 text-right">{{ Math.round(analysisProgress) }}%</div>
        <div class="h-1.5 flex-1 bg-surface-muted rounded-full overflow-hidden">
          <div
            class="h-full bg-primary transition-all duration-300 ease-out"
            :style="{ width: `${analysisProgress}%` }"
          ></div>
        </div>
      </div>

      <p v-else-if="lastRunLabel" class="text-[11px] text-text-soft border-t border-border/60 pt-2">
        Última ejecución completada en {{ lastRunLabel }}.
      </p>
    </div>
  </div>
</template>
