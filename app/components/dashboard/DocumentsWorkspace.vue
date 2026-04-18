<script setup lang="ts">
import { WORKSPACE_UPLOAD_ACCEPT } from '~~/app/config/workspace-upload-accept'

const documentsStore = useDocumentsStore()
const selectedFile = ref<File | null>(null)

watch(selectedFile, async (file) => {
  if (!file) {
    return
  }

  documentsStore.prepareWorkspaceDraft(file)
  selectedFile.value = null
  await navigateTo('/workspace-documents')
})
</script>

<template>
  <div class="page-stage-primary panel-surface space-y-5 p-6 sm:p-7">
    <div class="space-y-3">
      <p class="section-chip">Documentos</p>
      <h2 class="max-w-2xl font-display text-3xl font-medium leading-[1.15] text-text">
        De un archivo suelto a una revisión clara y confiable.
      </h2>
      <p class="max-w-2xl text-sm leading-6 text-text-muted">
        Adjunta tu documento y continúa en un espacio pensado para revisar con calma, confirmar cada
        dato y dejarlo listo con seguridad.
      </p>
    </div>

    <div>
      <UFileUpload
        v-model="selectedFile"
        :accept="WORKSPACE_UPLOAD_ACCEPT"
        color="neutral"
        size="xl"
        variant="area"
        layout="list"
        label="Arrastra PDF, imagen u Office"
        description="PDF, JPG, PNG, .docx, .xlsx, .pptx, ODF… Máx 20MB."
        class="w-full"
      />
    </div>
  </div>
</template>
