<script setup lang="ts">
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
  <div class="panel-surface fade-up stagger-2 space-y-5 p-6 sm:p-7">
    <div class="space-y-3">
      <p class="section-chip">Documentos</p>
      <h2 class="max-w-2xl font-display text-3xl font-semibold text-text">
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
        accept="application/pdf,image/png,image/jpeg"
        color="neutral"
        size="xl"
        variant="area"
        layout="list"
        label="Arrastra un PDF o una imagen"
        description="PDF, JPG o PNG. Máx 20MB."
        class="w-full"
      />
    </div>
  </div>
</template>
