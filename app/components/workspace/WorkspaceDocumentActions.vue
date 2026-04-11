<script setup lang="ts">
import type { WorkspaceStage } from '~~/app/stores/documents'

withDefaults(
  defineProps<{
    stage: WorkspaceStage
    isReadonlyView: boolean
    uploading: boolean
    savingSnapshot: boolean
    savingDraft: boolean
    cancelingDraft: boolean
    canEditCurrentDraft: boolean
    canDeleteCurrentDraft: boolean
    /** Clases del contenedor (p. ej. gap distinto en barra superior vs panel lateral). */
    wrapperClass?: string
  }>(),
  {
    wrapperClass: 'flex flex-wrap items-center gap-2',
  },
)

const emit = defineEmits<{
  startAnalysis: []
  saveDraftSnapshot: []
  clearLocalDraft: []
  requestCancelFlow: []
}>()
</script>

<template>
  <div :class="wrapperClass">
    <SipacButton
      v-if="stage === 'draft'"
      data-testid="workspace-action-start-review"
      icon="i-lucide-play"
      size="sm"
      :loading="uploading"
      @click="emit('startAnalysis')"
    >
      Empezar revisión
    </SipacButton>
    <SipacButton
      v-else-if="['review', 'ready'].includes(stage)"
      data-testid="workspace-action-save-snapshot"
      icon="i-lucide-save"
      size="sm"
      color="neutral"
      variant="soft"
      :loading="savingSnapshot || savingDraft"
      :disabled="!canEditCurrentDraft"
      @click="emit('saveDraftSnapshot')"
    >
      Guardar avances
    </SipacButton>
    <SipacButton
      v-if="stage === 'draft'"
      data-testid="workspace-action-remove-file"
      icon="i-lucide-trash-2"
      size="sm"
      color="neutral"
      variant="ghost"
      :loading="cancelingDraft"
      @click="emit('clearLocalDraft')"
    >
      Quitar archivo
    </SipacButton>
    <SipacButton
      v-else-if="['review', 'ready'].includes(stage)"
      data-testid="workspace-action-cancel-process"
      icon="i-lucide-x"
      size="sm"
      color="neutral"
      variant="ghost"
      :loading="cancelingDraft"
      :disabled="!canDeleteCurrentDraft"
      @click="emit('requestCancelFlow')"
    >
      Cancelar proceso
    </SipacButton>
    <SipacButton
      v-else-if="stage === 'confirmed' && isReadonlyView"
      data-testid="workspace-action-confirmed-followup"
      icon="i-lucide-plus"
      size="sm"
      color="neutral"
      variant="ghost"
      to="/repository"
    >
      Volver al repositorio
    </SipacButton>
    <SipacButton
      v-else-if="stage === 'confirmed'"
      data-testid="workspace-action-confirmed-followup"
      icon="i-lucide-plus"
      size="sm"
      color="neutral"
      variant="ghost"
      @click="emit('clearLocalDraft')"
    >
      Empezar otro archivo
    </SipacButton>
  </div>
</template>
