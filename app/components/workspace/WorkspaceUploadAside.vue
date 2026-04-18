<script setup lang="ts">
import { computed } from 'vue'
import type { WorkspaceStage } from '~~/app/stores/documents'
import { WORKSPACE_UPLOAD_ACCEPT } from '~~/app/config/workspace-upload-accept'
import { formatFileSize } from '~~/app/utils/format-display'

const pendingSelection = defineModel<File | null>('pendingSelection', { default: null })

const props = withDefaults(
  defineProps<{
    uploadInputLocked: boolean
    currentStage: WorkspaceStage
    currentLocalFile: File | null
    hasPersistedDraft: boolean
    currentProcessingError: string | null
    /** Título del UAlert cuando hay error de procesamiento (p. ej. duplicado en repositorio). */
    processingErrorTitle?: string | null
    hasDraft: boolean
    isImageDraft: boolean
    currentFileName: string
    currentFileSize: number
    fileExtension: string
    stageEyebrow: string
    siblingProductIds: string[]
    sourceWorkCount: number
    activeProductId: string | null
    uploading: boolean
    cancelingDraft: boolean
    savingDraft: boolean
    savingSnapshot: boolean
    canEditCurrentDraft: boolean
    canDeleteCurrentDraft: boolean
    isReadonlyView: boolean
  }>(),
  {
    processingErrorTitle: null,
  },
)

const processingErrorAlertTitle = computed(
  () => props.processingErrorTitle ?? 'No pudimos terminar con este archivo',
)

const emit = defineEmits<{
  startAnalysis: []
  saveDraftSnapshot: []
  clearLocalDraft: []
  requestCancelFlow: []
  openSiblingDraft: [productId: string]
}>()
</script>

<template>
  <aside
    class="workspace-upload-aside panel-surface space-y-4 p-5 sm:p-6 lg:top-28 lg:self-start xl:top-40 xl:self-start"
    aria-label="Cargar archivo y acciones del documento"
    data-testid="workspace-upload-aside"
  >
    <div class="space-y-2">
      <p class="section-chip">Subir archivo</p>
      <p class="text-xl font-semibold text-text">Tu documento</p>
      <p class="text-sm leading-6 text-text-muted">
        Adjunta un PDF, una imagen o un Office (.docx, .xlsx, .pptx, ODF…); en esta misma página lo
        revisas y lo guardas cuando quieras.
      </p>
    </div>

    <UFileUpload
      v-model="pendingSelection"
      :accept="WORKSPACE_UPLOAD_ACCEPT"
      color="neutral"
      :multiple="false"
      variant="area"
      size="lg"
      layout="list"
      label="Arrastra tu documento (PDF, imagen u Office)"
      description="También puedes hacer clic para elegirlo. Puedes cambiarlo mientras no hay una revisión en curso."
      :disabled="uploadInputLocked"
      class="w-full"
    />

    <UAlert
      v-if="hasPersistedDraft && !currentLocalFile"
      color="primary"
      variant="subtle"
      icon="i-lucide-history"
      title="Retomamos tu revisión"
      description="Este archivo quedó pendiente; puedes seguir sin volver a subirlo."
    />

    <UAlert
      v-if="currentProcessingError"
      color="error"
      variant="subtle"
      icon="i-lucide-octagon-alert"
      :title="processingErrorAlertTitle"
      :description="currentProcessingError"
    />

    <div
      v-if="hasDraft"
      data-testid="workspace-draft-card"
      class="rounded-lg border border-border/75 bg-white/88 p-4 shadow-[0_18px_34px_-30px_rgb(20_20_19/0.16)]"
    >
      <div class="flex items-start gap-3">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sipac-50 text-sipac-700"
        >
          <UIcon
            :name="isImageDraft ? 'i-lucide-image' : 'i-lucide-file-text'"
            class="size-5"
            aria-hidden="true"
          />
        </span>

        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold text-text">{{ currentFileName }}</p>
          <p class="mt-1 text-xs tracking-[0.14em] text-text-soft uppercase">
            {{ fileExtension }} · {{ formatFileSize(currentFileSize) }}
          </p>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <SipacBadge color="neutral" variant="outline">
          {{ isImageDraft ? 'Imagen' : 'Documento' }}
        </SipacBadge>
        <SipacBadge color="primary" variant="subtle">{{ stageEyebrow }}</SipacBadge>
        <SipacBadge v-if="sourceWorkCount > 1" color="warning" variant="subtle">
          Compendio · {{ sourceWorkCount }} obras
        </SipacBadge>
      </div>

      <div
        v-if="siblingProductIds.length > 1"
        class="mt-4 rounded-lg border border-dashed border-amber-200/90 bg-amber-50/50 p-3"
      >
        <p class="text-xs font-semibold text-text">Varias obras en este archivo</p>
        <p class="mt-1 text-xs text-text-muted">
          Cada botón abre la ficha de una obra (título y autores propios).
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <SipacButton
            v-for="(pid, idx) in siblingProductIds"
            :key="pid"
            size="xs"
            variant="soft"
            :color="activeProductId === pid ? 'primary' : 'neutral'"
            @click="emit('openSiblingDraft', pid)"
          >
            Obra {{ idx + 1 }}
          </SipacButton>
        </div>
      </div>

      <WorkspaceDocumentActions
        class="mt-4"
        :stage="currentStage"
        :is-readonly-view="isReadonlyView"
        :uploading="uploading"
        :saving-snapshot="savingSnapshot"
        :saving-draft="savingDraft"
        :canceling-draft="cancelingDraft"
        :can-edit-current-draft="canEditCurrentDraft"
        :can-delete-current-draft="canDeleteCurrentDraft"
        wrapper-class="flex flex-wrap gap-3"
        @start-analysis="emit('startAnalysis')"
        @save-draft-snapshot="emit('saveDraftSnapshot')"
        @clear-local-draft="emit('clearLocalDraft')"
        @request-cancel-flow="emit('requestCancelFlow')"
      />
    </div>

    <div v-else class="rounded-lg border border-dashed border-sipac-200 bg-sipac-50/55 p-4">
      <p class="font-semibold text-text">Aún no hay archivo</p>
      <p class="mt-2 text-sm leading-6 text-text-muted">
        Cuando lo adjuntes, verás aquí el nombre y las acciones para seguir.
      </p>
    </div>
  </aside>
</template>
