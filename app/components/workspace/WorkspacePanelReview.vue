<script setup lang="ts">
import DocumentPreviewWithHighlights from '~~/app/components/dashboard/DocumentPreviewWithHighlights.vue'
import type { DocumentAnchor, ProductType } from '~~/app/types'
import type { WorkspaceStage } from '~~/app/stores/documents'
import type { MetadataFieldConfig } from '~~/app/utils/product-metadata-layout'

export type HighlightGroupView = {
  key: string
  label: string
  confidence?: number
  anchors: DocumentAnchor[]
}

const selectedProductType = defineModel<ProductType>('productType', { required: true })

const props = defineProps<{
  currentStage: WorkspaceStage
  previewUrl: string | null
  mimeType: string
  highlightGroups: HighlightGroupView[]
  activeHighlightKey: string | null
  hasActiveHighlights: boolean
  isImageDraft: boolean
  metadata: {
    title: string
    authors: { length: number }
    year: string
    doi: string
  }
  summaryRows: Array<{ label: string; value: string }>
  productTypeOptions: Array<{ label: string; value: ProductType }>
  groupedSpecificFields: Array<{ group: string; fields: MetadataFieldConfig[] }>
  getSubtypeFieldName: (field: MetadataFieldConfig) => string
  getSubtypeFieldValue: (field: MetadataFieldConfig) => string | boolean
  setSubtypeFieldValue: (field: MetadataFieldConfig, value: string | boolean) => void
  getFieldClass: (field: MetadataFieldConfig) => string
  canEditCurrentDraft: boolean
  canSave: boolean
  canSaveSnapshot: boolean
  savingSnapshot: boolean
  savingDraft: boolean
}>()

const emit = defineEmits<{
  previewExpand: []
  highlightClick: [key: string]
  fieldFocus: [key: string | null]
  saveDraftSnapshot: []
  saveWorkspaceResult: []
}>()

const mobileTab = ref<'preview' | 'ficha'>('preview')
/** Vista ancha con preview + ficha a la vez (área útil real, no solo viewport). */
const isWideReviewLayout = ref(false)

onMounted(() => {
  if (!import.meta.client) return
  const mq = matchMedia('(min-width: 1280px)')
  const apply = () => {
    isWideReviewLayout.value = mq.matches
  }
  apply()
  mq.addEventListener('change', apply)
  onBeforeUnmount(() => mq.removeEventListener('change', apply))
})

watch(
  () => props.currentStage,
  (stage) => {
    if (stage === 'review' || stage === 'ready') {
      mobileTab.value = 'ficha'
    }
  },
)
</script>

<template>
  <div class="workspace-panel-review">
    <template v-if="currentStage === 'confirmed'">
      <div class="rounded-xl border border-sipac-200/90 bg-sipac-50/80 p-6 text-center sm:p-8">
        <span
          class="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sipac-100 text-sipac-700"
        >
          <UIcon name="i-lucide-check-circle" class="size-7" aria-hidden="true" />
        </span>
        <h2
          id="workspace-confirmed-heading"
          class="mt-4 font-display text-xl font-semibold text-text"
        >
          Documento guardado
        </h2>
        <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">
          Ya forma parte de tu registro. Puedes empezar otro archivo desde el panel izquierdo.
        </p>
      </div>
    </template>

    <template v-else>
      <!-- Vista estrecha / tablet: pestañas y ficha a ancho completo del panel -->
      <div class="xl:hidden">
        <div
          role="tablist"
          aria-label="Secciones de revisión"
          class="mb-4 flex gap-1 rounded-xl bg-surface-muted/90 p-1 ring-1 ring-border/50"
        >
          <button
            id="ws-review-tab-preview"
            type="button"
            role="tab"
            class="flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors"
            :class="
              mobileTab === 'preview'
                ? 'bg-white text-text shadow-sm ring-1 ring-border/60'
                : 'text-text-muted'
            "
            :aria-selected="mobileTab === 'preview'"
            aria-controls="ws-review-panel-preview"
            :tabindex="mobileTab === 'preview' ? 0 : -1"
            @click="mobileTab = 'preview'"
          >
            Vista previa
          </button>
          <button
            id="ws-review-tab-ficha"
            type="button"
            role="tab"
            class="flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors"
            :class="
              mobileTab === 'ficha'
                ? 'bg-white text-text shadow-sm ring-1 ring-border/60'
                : 'text-text-muted'
            "
            :aria-selected="mobileTab === 'ficha'"
            aria-controls="ws-review-panel-ficha"
            :tabindex="mobileTab === 'ficha' ? 0 : -1"
            @click="mobileTab = 'ficha'"
          >
            Ficha
          </button>
        </div>

        <div
          v-show="mobileTab === 'preview'"
          id="ws-review-panel-preview"
          role="tabpanel"
          class="space-y-4"
          aria-labelledby="ws-review-tab-preview"
        >
          <div class="panel-muted overflow-hidden p-0">
            <DocumentPreviewWithHighlights
              :preview-url="previewUrl"
              :mime-type="mimeType"
              :groups="highlightGroups"
              :active-key="activeHighlightKey"
              @highlight-click="emit('highlightClick', $event)"
              @preview-expand="emit('previewExpand')"
            />
          </div>

          <div class="divide-y divide-border/60 rounded-xl border border-border/60 bg-white/90">
            <div class="p-4">
              <p class="text-xs font-semibold tracking-[0.14em] text-text-soft uppercase">
                Resumen del documento
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <SipacBadge v-if="metadata.title" color="primary" variant="subtle"
                  >Título</SipacBadge
                >
                <SipacBadge v-if="metadata.authors.length" color="neutral" variant="outline"
                  >Autores</SipacBadge
                >
                <SipacBadge v-if="metadata.year" color="neutral" variant="outline"
                  >Fecha</SipacBadge
                >
                <SipacBadge v-if="metadata.doi" color="neutral" variant="outline"
                  >Referencia</SipacBadge
                >
              </div>
              <p v-if="!hasActiveHighlights" class="mt-3 text-xs font-medium text-text-muted">
                {{
                  isImageDraft
                    ? 'En esta imagen no hay resaltados enlazados a la ficha.'
                    : 'En este PDF no hay resaltados enlazados a la ficha.'
                }}
              </p>
              <p class="mt-2 text-sm leading-6 text-text-muted">
                {{
                  isImageDraft
                    ? 'En imágenes compara lo que ves con los campos de la ficha.'
                    : 'Los datos detectados aparecen como etiquetas; el detalle está en la tabla.'
                }}
              </p>
            </div>
            <div class="p-4">
              <dl class="space-y-3">
                <div
                  v-for="row in summaryRows"
                  :key="row.label"
                  class="flex items-start justify-between gap-3"
                >
                  <dt class="text-sm font-semibold text-text">{{ row.label }}</dt>
                  <dd class="max-w-[55%] text-right text-sm leading-6 text-text-muted">
                    {{ row.value }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div
          v-show="mobileTab === 'ficha'"
          id="ws-review-panel-ficha"
          role="tabpanel"
          class="space-y-4 pb-24"
          aria-labelledby="ws-review-tab-ficha"
        >
          <div class="rounded-xl border border-border/55 bg-white/90 p-4">
            <h2
              :id="!isWideReviewLayout ? 'workspace-review-heading' : undefined"
              tabindex="-1"
              class="font-display text-lg font-semibold text-text outline-none focus-visible:ring-2 focus-visible:ring-sipac-500/40"
            >
              {{ currentStage === 'ready' ? 'Última revisión' : 'Revisa y corrige la ficha' }}
            </h2>
            <p class="mt-2 text-sm leading-6 text-text-muted">
              {{
                currentStage === 'ready'
                  ? 'Comprueba que todo cuadre con el documento y guarda.'
                  : 'Los cambios no se registran hasta que guardes.'
              }}
            </p>
          </div>

          <div v-if="canEditCurrentDraft" class="panel-muted p-4 sm:p-5">
            <WorkspaceProductMetadataForm
              v-model:product-type="selectedProductType"
              :product-type-options="productTypeOptions"
              :grouped-specific-fields="groupedSpecificFields"
              :get-subtype-field-name="getSubtypeFieldName"
              :get-subtype-field-value="getSubtypeFieldValue"
              :set-subtype-field-value="setSubtypeFieldValue"
              :get-field-class="getFieldClass"
              @field-focus="emit('fieldFocus', $event)"
            />
          </div>
        </div>
      </div>

      <!-- Escritorio ancho: preview fija + ficha con más aire (evita columnas ~50% en paneles estrechos) -->
      <div class="hidden gap-6 xl:grid xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)] xl:items-start">
        <div class="sticky top-20 min-w-0 space-y-4 self-start xl:max-w-[420px]">
          <div class="panel-muted mt-0 overflow-hidden p-0">
            <DocumentPreviewWithHighlights
              :preview-url="previewUrl"
              :mime-type="mimeType"
              :groups="highlightGroups"
              :active-key="activeHighlightKey"
              @highlight-click="emit('highlightClick', $event)"
              @preview-expand="emit('previewExpand')"
            />
          </div>

          <div class="divide-y divide-border/60 rounded-xl border border-border/60 bg-white/90">
            <div class="p-4">
              <p class="text-xs font-semibold tracking-[0.14em] text-text-soft uppercase">
                Resumen del documento
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <SipacBadge v-if="metadata.title" color="primary" variant="subtle"
                  >Título</SipacBadge
                >
                <SipacBadge v-if="metadata.authors.length" color="neutral" variant="outline"
                  >Autores</SipacBadge
                >
                <SipacBadge v-if="metadata.year" color="neutral" variant="outline"
                  >Fecha</SipacBadge
                >
                <SipacBadge v-if="metadata.doi" color="neutral" variant="outline"
                  >Referencia</SipacBadge
                >
              </div>
              <p v-if="!hasActiveHighlights" class="mt-3 text-xs font-medium text-text-muted">
                {{
                  isImageDraft
                    ? 'En esta imagen no hay resaltados enlazados a la ficha.'
                    : 'En este PDF no hay resaltados enlazados a la ficha.'
                }}
              </p>
              <p class="mt-2 text-sm leading-6 text-text-muted">
                {{
                  isImageDraft
                    ? 'En imágenes compara lo que ves con los campos de la ficha.'
                    : 'Pulsa un resaltado en el PDF para enfocar el campo relacionado.'
                }}
              </p>
            </div>
            <div class="p-4">
              <dl class="space-y-3">
                <div
                  v-for="row in summaryRows"
                  :key="row.label"
                  class="flex items-start justify-between gap-3"
                >
                  <dt class="text-sm font-semibold text-text">{{ row.label }}</dt>
                  <dd class="max-w-[55%] text-right text-sm leading-6 text-text-muted">
                    {{ row.value }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div class="min-w-0 space-y-4">
          <div class="rounded-xl border border-border/55 bg-white/90 p-4">
            <h2
              :id="isWideReviewLayout ? 'workspace-review-heading' : undefined"
              tabindex="-1"
              class="font-display text-lg font-semibold text-text outline-none focus-visible:ring-2 focus-visible:ring-sipac-500/40"
            >
              {{ currentStage === 'ready' ? 'Última revisión' : 'Revisa y corrige la ficha' }}
            </h2>
            <p class="mt-2 text-sm leading-6 text-text-muted">
              {{
                currentStage === 'ready'
                  ? 'Comprueba que todo cuadre con el documento y guarda.'
                  : 'Los cambios no se registran hasta que guardes.'
              }}
            </p>
          </div>

          <div v-if="canEditCurrentDraft" class="panel-muted p-4 sm:p-5">
            <WorkspaceProductMetadataForm
              v-model:product-type="selectedProductType"
              :product-type-options="productTypeOptions"
              :grouped-specific-fields="groupedSpecificFields"
              :get-subtype-field-name="getSubtypeFieldName"
              :get-subtype-field-value="getSubtypeFieldValue"
              :set-subtype-field-value="setSubtypeFieldValue"
              :get-field-class="getFieldClass"
              @field-focus="emit('fieldFocus', $event)"
            />
          </div>

          <div
            v-if="canEditCurrentDraft"
            class="@container/guardar-panel flex flex-col gap-4 rounded-xl border border-sipac-200/80 bg-sipac-50/70 p-4 sm:p-5 @min-[36rem]/guardar-panel:flex-row @min-[36rem]/guardar-panel:items-center @min-[36rem]/guardar-panel:justify-between @min-[36rem]/guardar-panel:gap-6"
          >
            <div class="min-w-0 @min-[36rem]/guardar-panel:max-w-[min(100%,28rem)]">
              <p class="font-semibold text-text">Guardar</p>
              <p class="mt-1 text-sm leading-6 text-text-muted">
                {{
                  canSave
                    ? 'Puedes confirmar el resultado final.'
                    : 'Añade al menos título y un autor para guardar.'
                }}
              </p>
            </div>
            <div
              class="flex w-full min-w-0 flex-wrap gap-3 @min-[36rem]/guardar-panel:w-auto @min-[36rem]/guardar-panel:justify-end"
            >
              <SipacButton
                icon="i-lucide-save"
                size="lg"
                color="neutral"
                variant="soft"
                class="min-w-0 flex-1 @min-[36rem]/guardar-panel:flex-initial"
                :loading="savingSnapshot || savingDraft"
                :disabled="!canSaveSnapshot"
                @click="emit('saveDraftSnapshot')"
              >
                Guardar avances
              </SipacButton>
              <SipacButton
                icon="i-lucide-check"
                size="lg"
                class="min-w-0 flex-1 @min-[36rem]/guardar-panel:flex-initial"
                :loading="savingDraft"
                :disabled="!canSave"
                @click="emit('saveWorkspaceResult')"
              >
                Guardar resultado
              </SipacButton>
            </div>
          </div>
        </div>
      </div>

      <!-- Barra fija cuando la ficha no va en columna ancha -->
      <div
        v-if="canEditCurrentDraft && ['review', 'ready'].includes(currentStage)"
        class="xl:hidden"
      >
        <div
          class="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-surface/95 px-4 py-3 shadow-[0_-8px_30px_-12px_rgba(17,46,29,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-surface/88"
          style="padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px))"
        >
          <div class="mx-auto flex max-w-lg gap-2">
            <SipacButton
              icon="i-lucide-save"
              size="md"
              color="neutral"
              variant="soft"
              class="min-w-0 flex-1"
              :loading="savingSnapshot || savingDraft"
              :disabled="!canSaveSnapshot"
              @click="emit('saveDraftSnapshot')"
            >
              Avances
            </SipacButton>
            <SipacButton
              icon="i-lucide-check"
              size="md"
              class="min-w-0 flex-1"
              :loading="savingDraft"
              :disabled="!canSave"
              @click="emit('saveWorkspaceResult')"
            >
              Guardar
            </SipacButton>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
