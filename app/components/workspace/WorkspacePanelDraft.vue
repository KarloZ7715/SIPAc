<script setup lang="ts">
import DocumentPreviewWithHighlights from '~~/app/components/dashboard/DocumentPreviewWithHighlights.vue'

defineProps<{
  previewUrl: string | null
  mimeType: string
  summaryRows: Array<{ label: string; value: string }>
}>()

const emit = defineEmits<{
  previewExpand: []
}>()
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div class="panel-muted min-w-0 overflow-hidden p-0">
      <DocumentPreviewWithHighlights
        :preview-url="previewUrl"
        :mime-type="mimeType"
        :groups="[]"
        :active-key="null"
        @preview-expand="emit('previewExpand')"
      />
    </div>

    <div class="space-y-3">
      <div
        class="rounded-lg border border-border/75 bg-white/88 p-4 shadow-[0_18px_34px_-30px_rgba(17,46,29,0.14)]"
      >
        <p class="font-semibold text-text">Listo para empezar</p>
        <p class="mt-2 text-sm leading-6 text-text-muted">
          Revisa el archivo y pulsa «Empezar revisión» en la columna de la izquierda cuando quieras
          que preparemos la ficha.
        </p>
      </div>

      <div
        class="rounded-lg border border-border/75 bg-white/88 p-4 shadow-[0_18px_34px_-30px_rgba(17,46,29,0.14)]"
      >
        <div class="space-y-3">
          <div
            v-for="row in summaryRows"
            :key="row.label"
            class="flex items-start justify-between gap-3 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
          >
            <p class="text-sm font-semibold text-text">{{ row.label }}</p>
            <p class="max-w-44 text-right text-sm leading-6 text-text-muted">
              {{ row.value }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
