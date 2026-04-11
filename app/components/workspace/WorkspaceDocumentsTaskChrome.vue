<script setup lang="ts">
import type { WorkspaceStage } from '~~/app/stores/documents'

defineProps<{
  stage: WorkspaceStage
  /** Título corto del archivo o mensaje sin archivo */
  fileTitle: string
  /** Segunda línea: formato, tamaño, etc. */
  fileMeta: string
  /** Etiqueta de estado legible */
  stateLabel: string
  /** Ocultar en vacío puro (opcional, para no duplicar mensajes) */
  visible: boolean
}>()
</script>

<template>
  <div
    v-show="visible"
    class="workspace-task-chrome border-b border-border/50 bg-surface-muted/40 px-4 py-3 sm:px-5"
    role="region"
    aria-label="Estado del documento y acciones rápidas"
  >
    <div
      class="mx-auto flex max-w-[96rem] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:px-10"
    >
      <div class="min-w-0 flex items-start gap-3">
        <span
          class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-sipac-700 shadow-sm ring-1 ring-border/60"
          aria-hidden="true"
        >
          <UIcon name="i-lucide-file-stack" class="size-4" />
        </span>
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-text">
            {{ fileTitle }}
          </p>
          <p class="mt-0.5 text-xs text-text-muted">
            {{ fileMeta }}
          </p>
          <p class="mt-1 text-xs font-medium text-sipac-800">
            {{ stateLabel }}
          </p>
        </div>
      </div>

      <div class="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
