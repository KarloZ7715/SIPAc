<script setup lang="ts">
import type { ProductType } from '~~/app/types'

const documentsStore = useDocumentsStore()
const toast = useToast()

const selectedProductType = ref<ProductType>('article')
const selectedFile = ref<File | null>(null)

const productTypeOptions = [
  { label: 'Artículo científico', value: 'article' },
  { label: 'Ponencia en evento', value: 'conference_paper' },
  { label: 'Tesis o trabajo de grado', value: 'thesis' },
  { label: 'Certificado o constancia', value: 'certificate' },
  { label: 'Proyecto de investigación', value: 'research_project' },
]

const statusMeta = {
  pending: {
    label: 'En cola',
    color: 'warning' as const,
  },
  processing: {
    label: 'Procesando',
    color: 'primary' as const,
  },
  completed: {
    label: 'Completado',
    color: 'success' as const,
  },
  error: {
    label: 'Con error',
    color: 'error' as const,
  },
}

const currentFile = computed(() => selectedFile.value ?? undefined)

const activeCount = computed(() => documentsStore.activeDocuments.length)

function resolveApiErrorMessage(error: unknown, fallback: string) {
  const candidate = error as {
    data?: {
      data?: {
        error?: {
          message?: string
        }
      }
    }
  }

  return candidate.data?.data?.error?.message || fallback
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function previewText(value?: string) {
  if (!value) return 'El OCR y la extracción de entidades aún están en curso.'
  return value.length > 260 ? `${value.slice(0, 260)}...` : value
}

async function onUpload() {
  if (!currentFile.value) {
    toast.add({
      title: 'Selecciona un archivo',
      description: 'Carga un PDF o una imagen antes de enviar al pipeline.',
      icon: 'i-lucide-file-warning',
      color: 'warning',
    })
    return
  }

  try {
    await documentsStore.uploadDocument(currentFile.value, selectedProductType.value)
    selectedFile.value = null
    toast.add({
      title: 'Documento enviado',
      description: 'La carga fue aceptada y el procesamiento quedó en segundo plano.',
      icon: 'i-lucide-check-circle',
      color: 'success',
    })
  } catch (error: unknown) {
    const message = resolveApiErrorMessage(error, 'No fue posible cargar el documento')
    toast.add({
      title: 'Error al cargar',
      description: message,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    })
  }
}

async function onDelete(documentId: string) {
  try {
    await documentsStore.deleteDocument(documentId)
    toast.add({
      title: 'Documento eliminado',
      description: 'El archivo y su rastro de trabajo visible fueron retirados de la vista.',
      icon: 'i-lucide-trash-2',
      color: 'success',
    })
  } catch (error: unknown) {
    const message = resolveApiErrorMessage(error, 'No fue posible eliminar el documento')
    toast.add({
      title: 'Error al eliminar',
      description: message,
      icon: 'i-lucide-circle-alert',
      color: 'error',
    })
  }
}

onMounted(() => {
  documentsStore.startPolling()
})

onBeforeUnmount(() => {
  documentsStore.stopPolling()
})
</script>

<template>
  <div class="panel-surface fade-up stagger-2 space-y-5 p-6 sm:p-7">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="section-chip">Carga documental</p>
        <h2 class="mt-3 font-display text-3xl font-semibold text-text">
          Pipeline real para OCR, NER y notificaciones
        </h2>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-text-muted">
          Sube un documento, clasifícalo por tipo y sigue el estado del procesamiento sin salir
          del workspace.
        </p>
      </div>

      <SipacBadge :color="activeCount ? 'primary' : 'neutral'" variant="outline">
        {{ activeCount ? `${activeCount} activo${activeCount === 1 ? '' : 's'}` : 'Sin cola activa' }}
      </SipacBadge>
    </div>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div class="panel-muted space-y-4 p-4 sm:p-5">
        <UFormField label="Tipo de producto" name="productType" required>
          <USelect
            v-model="selectedProductType"
            color="neutral"
            variant="outline"
            :items="productTypeOptions"
            class="w-full"
          />
        </UFormField>

        <UFileUpload
          v-model="selectedFile"
          accept="application/pdf,image/png,image/jpeg"
          color="neutral"
          size="xl"
          variant="area"
          layout="list"
          label="Arrastra un PDF o imagen"
          description="Hasta 20 MB por archivo. El sistema valida el formato real antes de procesar."
          class="w-full"
        />

        <div class="flex flex-wrap items-center gap-3">
          <SipacButton
            icon="i-lucide-file-up"
            :loading="documentsStore.uploading"
            @click="onUpload"
          >
            Enviar al pipeline
          </SipacButton>
          <span class="text-sm text-text-muted">
            El resultado se guarda, se procesa en segundo plano y dispara notificación al finalizar.
          </span>
        </div>
      </div>

      <div class="panel-muted space-y-4 p-4 sm:p-5">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
              Estado reciente
            </p>
            <p class="mt-1 text-sm text-text-muted">
              Los documentos pendientes se actualizan automáticamente mientras permanezcas en la vista.
            </p>
          </div>

          <SipacButton
            icon="i-lucide-refresh-cw"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="documentsStore.pollActiveStatuses()"
          >
            Actualizar
          </SipacButton>
        </div>

        <div v-if="documentsStore.documents.length" class="space-y-3">
          <article
            v-for="document in documentsStore.documents"
            :key="document._id"
            class="rounded-[1.4rem] border border-border/70 bg-white/85 p-4 shadow-[0_18px_36px_-30px_rgba(26,44,36,0.35)]"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-semibold text-text">{{ document.originalFilename }}</p>
                <p class="mt-1 text-xs tracking-[0.12em] text-text-soft uppercase">
                  {{ formatDate(document.createdAt) }} · {{ formatFileSize(document.fileSizeBytes) }}
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <SipacBadge
                  :color="statusMeta[document.processingStatus].color"
                  variant="subtle"
                >
                  {{ statusMeta[document.processingStatus].label }}
                </SipacBadge>
                <SipacBadge color="neutral" variant="outline">
                  {{ productTypeOptions.find((option) => option.value === document.productType)?.label }}
                </SipacBadge>
              </div>
            </div>

            <p class="mt-3 text-sm leading-6 text-text-muted">
              <template v-if="document.processingStatus === 'error'">
                {{ document.processingError }}
              </template>
              <template v-else>
                {{ previewText(document.rawExtractedText) }}
              </template>
            </p>

            <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div class="flex flex-wrap items-center gap-2 text-xs text-text-soft uppercase">
                <span v-if="document.ocrProvider">OCR: {{ document.ocrProvider }}</span>
                <span v-if="document.academicProductId">Repositorio sincronizado</span>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <SipacButton
                  v-if="['pending', 'processing'].includes(document.processingStatus)"
                  icon="i-lucide-loader-circle"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="documentsStore.refreshDocumentStatus(document._id)"
                >
                  Consultar estado
                </SipacButton>
                <SipacButton
                  icon="i-lucide-trash-2"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="onDelete(document._id)"
                >
                  Eliminar
                </SipacButton>
              </div>
            </div>
          </article>
        </div>

        <UEmpty
          v-else
          icon="i-lucide-folder-search"
          title="Aún no has enviado documentos en esta sesión"
          description="Cuando cargues un archivo verás aquí el seguimiento del OCR, la extracción y el resultado final."
        />
      </div>
    </div>
  </div>
</template>