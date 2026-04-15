<script setup lang="ts">
import type { ApiSuccessResponse, ProductType } from '~~/app/types'
import { isDuplicateRepositoryUploadError } from '~~/app/types'
import {
  type WorkspaceRouteFocusKey,
  isWorkspaceRouteFocusKey,
} from '~~/app/types/workspace-route-focus'
import DocumentPreviewWithHighlights from '~~/app/components/dashboard/DocumentPreviewWithHighlights.vue'
import { WORKSPACE_STAGE_COPY } from '~~/app/config/workspace-stage-copy'
import { WORKSPACE_MAX_VISIBLE_ANALYSIS_HIGHLIGHTS } from '~~/app/config/workspace-analysis-ui'
import { WORKSPACE_PRODUCT_TYPE_OPTIONS } from '~~/app/config/workspace-product-type-options'
import { formatFileSize } from '~~/app/utils/format-display'
import {
  buildWorkspaceHighlightGroups,
  type WorkspaceHighlightGroup,
} from '~~/app/utils/workspace-highlight-groups'
import { getWorkspaceDocumentFormatLabel } from '~~/app/utils/workspace-document-format'
import { resolveWorkspacePreviewMime } from '~~/app/utils/workspace-preview-mime'
import {
  buildWorkspaceTestingMetricsItems,
  type WorkspaceTestingMetricItem,
} from '~~/app/utils/workspace-testing-metrics'

useSeoMeta({
  title: 'Documentos de trabajo',
  description:
    'Sube un PDF, una imagen o un documento Office (.docx, .xlsx, .pptx, ODF…), revisa la ficha y confirma tu producción académica.',
})

const documentsStore = useDocumentsStore()
const { workspaceDraftProductType, pollConsecutiveFailures, activeAcademicProductId } =
  storeToRefs(documentsStore)
const toast = useToast()
const runtimeConfig = useRuntimeConfig()
const route = useRoute()

const pendingSelection = ref<File | null>(null)
const showCancelModal = ref(false)
const showExpandedPreviewModal = ref(false)
const hydratingWorkspace = ref(true)
const savingSnapshot = ref(false)
const lastShownProcessingError = ref<string | null>(null)
const activeHighlightKey = ref<string | null>(null)

const productTypeOptions = WORKSPACE_PRODUCT_TYPE_OPTIONS

const {
  prefersReducedMotion,
  analysisProgress,
  analysisHighlights,
  analysisStartedAt,
  analysisFinishedAt,
  lastAnalysisDurationMs,
  analysisAttempts,
  pushAnalysisHighlight,
  getNextHighlightMessage,
  startProcessingFeedback,
  stopProcessingFeedback,
  resetWorkspaceVisualState,
} = useWorkspaceAnalysisFeedback()

let reviewLiveClearTimeout: ReturnType<typeof setTimeout> | null = null
let stopDocumentsFocusRefresh: (() => void) | undefined

const currentStage = computed(() => documentsStore.workspaceStage)
const currentStageCopy = computed(() => WORKSPACE_STAGE_COPY[currentStage.value])

const {
  groupedSpecificFields,
  getSubtypeFieldName,
  getSubtypeFieldValue,
  setSubtypeFieldValue,
  getFieldClass,
  buildSubtypeUpdatePayload,
  hydrateSubtypeFieldsFromProduct,
} = useWorkspaceSubtypeFields({
  selectedProductType: workspaceDraftProductType,
  currentProduct: computed(() => documentsStore.draftProduct?.product ?? null),
})
const hasDraft = computed(() => documentsStore.hasWorkspaceDraft)
const hasPersistedDraft = computed(() => documentsStore.hasPersistedDraft)
const canEditCurrentDraft = computed(() => documentsStore.canEditDraft)
const canDeleteCurrentDraft = computed(() => documentsStore.canDeleteDraft)
const isReadonlyView = computed(() => hasPersistedDraft.value && !canEditCurrentDraft.value)

const reextractingNer = ref(false)

const fromInsightLowNer = computed(
  () =>
    typeof route.query.fromInsight === 'string' &&
    route.query.fromInsight.trim() === 'low-confidence-ner',
)

const nerExtractionConfidence = computed(() =>
  Number(documentsStore.draftProduct?.product.extractedEntities?.extractionConfidence),
)

/** Mismo umbral que el insight de tablero (solo UI). */
const NER_LOW_CONFIDENCE_THRESHOLD_UI = 0.7

const showReextractNerCta = computed(
  () =>
    hasPersistedDraft.value &&
    ['review', 'ready', 'confirmed'].includes(currentStage.value) &&
    Boolean(activeAcademicProductId.value) &&
    (fromInsightLowNer.value ||
      (Number.isFinite(nerExtractionConfidence.value) &&
        nerExtractionConfidence.value < NER_LOW_CONFIDENCE_THRESHOLD_UI)),
)

async function runReextractNer() {
  const id = activeAcademicProductId.value
  if (!id) {
    return
  }

  reextractingNer.value = true
  try {
    const response = await $fetch<ApiSuccessResponse<{ extractionConfidence: number }>>(
      `/api/products/${id}/reextract-ner`,
      { method: 'POST' },
    )
    const pct = Math.round(response.data.extractionConfidence * 100)
    toast.add({
      title: 'Extracción actualizada',
      description: `Nueva confianza de entidades: ${pct}%.`,
      icon: 'i-lucide-sparkles',
      color: 'success',
    })
    await documentsStore.loadDraftProduct(id)
  } catch (error) {
    toast.add({
      title: 'No se pudo re-extraer',
      description: error instanceof Error ? error.message : 'Intenta de nuevo en unos segundos.',
      icon: 'i-lucide-octagon-alert',
      color: 'error',
    })
  } finally {
    reextractingNer.value = false
  }
}

const currentPreviewUrl = computed(() => documentsStore.workspaceDraftPreviewUrl)
const currentLocalFile = computed(() => documentsStore.workspaceDraftFile)
const currentTrackedFile = computed(
  () => documentsStore.activeTrackedDocument ?? documentsStore.draftProduct?.uploadedFile ?? null,
)
const siblingProductIds = computed(() => {
  const fromTracked = currentTrackedFile.value?.academicProductIds
  if (fromTracked && fromTracked.length > 0) {
    return fromTracked
  }
  return documentsStore.draftProduct?.uploadedFile.academicProductIds ?? []
})
const currentFileName = computed(
  () => currentLocalFile.value?.name ?? currentTrackedFile.value?.originalFilename ?? '',
)
const currentFileSize = computed(
  () => currentLocalFile.value?.size ?? currentTrackedFile.value?.fileSizeBytes ?? 0,
)
const currentMimeType = computed(() => {
  const filename = currentFileName.value
  for (const raw of [currentTrackedFile.value?.mimeType, currentLocalFile.value?.type]) {
    if (raw != null && String(raw).trim() !== '') {
      return resolveWorkspacePreviewMime(String(raw), filename)
    }
  }
  return resolveWorkspacePreviewMime(undefined, filename)
})
const currentProcessingError = computed(
  () => documentsStore.activeTrackedDocument?.processingError ?? null,
)
const currentProcessingErrorAlertTitle = computed(() =>
  isDuplicateRepositoryUploadError(currentProcessingError.value)
    ? 'Este documento ya está en el repositorio'
    : 'No pudimos terminar con este archivo',
)
const showTestingMetrics = computed(
  () => import.meta.dev && runtimeConfig.public.enableTestingMetrics,
)
const selectedProductType = computed({
  get: () => workspaceDraftProductType.value,
  set: (value: ProductType) => documentsStore.setWorkspaceProductType(value),
})
const metadata = computed(() => documentsStore.workspaceDetectedMetadata)
const extractedEntities = computed(() => documentsStore.draftProduct?.product.extractedEntities)
const isImageDraft = computed(() => currentMimeType.value.startsWith('image/'))
const currentProductTypeLabel = computed(
  () => productTypeOptions.find((option) => option.value === selectedProductType.value)?.label,
)
const fileExtension = computed(() => {
  if (!currentFileName.value.includes('.')) {
    return isImageDraft.value ? 'IMG' : 'PDF'
  }

  return currentFileName.value.split('.').pop()?.toUpperCase() || 'DOC'
})
const stageProgressPercent = computed(
  () =>
    ({
      empty: 0,
      draft: 18,
      analyzing: Math.max(24, analysisProgress.value),
      review: 78,
      ready: 100,
      confirmed: 100,
    })[currentStage.value],
)
const canSave = computed(
  () =>
    ['review', 'ready'].includes(currentStage.value) &&
    hasPersistedDraft.value &&
    documentsStore.canConfirmDraft,
)
const canSaveSnapshot = computed(
  () =>
    ['review', 'ready'].includes(currentStage.value) &&
    hasPersistedDraft.value &&
    canEditCurrentDraft.value,
)
const metadataCompletion = computed(() => {
  const checks = [
    metadata.value.title.trim().length > 0,
    metadata.value.authors.length > 0,
    metadata.value.year.trim().length > 0,
    metadata.value.institution.trim().length > 0,
    metadata.value.doi.trim().length > 0,
    metadata.value.keywords.length > 0,
    metadata.value.notes.trim().length > 0,
  ]

  const completed = checks.filter(Boolean).length
  const total = checks.length

  return {
    completed,
    total,
    percent: Math.round((completed / total) * 100),
  }
})
const testingMetricsItems = computed((): WorkspaceTestingMetricItem[] =>
  buildWorkspaceTestingMetricsItems({
    tracked: currentTrackedFile.value,
    product: documentsStore.draftProduct?.product,
    currentStage: currentStage.value,
    currentFileName: currentFileName.value,
    currentFileSize: currentFileSize.value,
    currentMimeType: currentMimeType.value,
    activeUploadId: documentsStore.activeUploadId,
    metadataCompletion: metadataCompletion.value,
    lastAnalysisDurationMs: lastAnalysisDurationMs.value,
    analysisAttempts: analysisAttempts.value,
    analysisStartedAt: analysisStartedAt.value,
    selectedProductType: selectedProductType.value,
  }),
)
const uploadInputLocked = computed(() =>
  ['analyzing', 'review', 'ready', 'confirmed'].includes(currentStage.value),
)
const stepReviewHint = computed(() => {
  const s = currentStage.value
  if (s === 'analyzing') {
    return `Leyendo el archivo · ${analysisProgress.value}%`
  }
  if (s === 'draft') {
    return 'Cuando quieras, inicia la lectura del archivo'
  }
  if (s === 'review') {
    return 'Ajusta la ficha a tu gusto'
  }
  if (s === 'ready') {
    return 'Puedes confirmar el guardado'
  }
  if (s === 'confirmed') {
    return 'Ya quedó guardado'
  }
  return 'Lectura y revisión'
})

const stepSaveHint = computed(() => {
  const s = currentStage.value
  if (s === 'confirmed') return 'Proceso terminado'
  if (s === 'ready') return 'Puedes guardar cuando quieras'
  if (s === 'review') return 'Guarda los cambios al terminar'
  if (s === 'analyzing') return 'Disponible cuando acabe la lectura'
  if (s === 'draft') return 'Después de revisar la ficha'
  if (s === 'empty') return 'Al final confirma el resultado'
  return 'Último paso'
})

const stageSteps = computed(() => [
  {
    label: 'Adjuntar',
    hint: hasDraft.value ? 'Archivo cargado' : 'Elige PDF, imagen u Office',
    active: hasDraft.value,
    complete: ['draft', 'analyzing', 'review', 'ready', 'confirmed'].includes(currentStage.value),
  },
  {
    label: 'Revisar',
    hint: stepReviewHint.value,
    active: ['analyzing', 'review', 'ready', 'confirmed'].includes(currentStage.value),
    complete: ['review', 'ready', 'confirmed'].includes(currentStage.value),
  },
  {
    label: 'Guardar',
    hint: stepSaveHint.value,
    active: ['ready', 'confirmed'].includes(currentStage.value),
    complete: currentStage.value === 'confirmed',
  },
])

const workspaceShellClass = computed(() => {
  if (currentStage.value === 'empty') {
    return 'grid w-full gap-6 md:grid-cols-2 md:items-start lg:mx-auto lg:max-w-6xl'
  }
  return 'grid w-full gap-6 lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)]'
})

const needsMobileSavePadding = computed(
  () => !isReadonlyView.value && ['review', 'ready'].includes(currentStage.value),
)

const taskChromeVisible = computed(() => hasDraft.value)

const taskChromeFileTitle = computed(() =>
  hasDraft.value ? currentFileName.value || 'Documento' : 'Sin archivo seleccionado',
)

const taskChromeFileMeta = computed(() => {
  if (!hasDraft.value) {
    return 'Puedes usar PDF, imagen u Office; cárgalo desde el panel de la izquierda.'
  }
  return `${fileExtension.value} · ${formatFileSize(currentFileSize.value)}`
})

const taskChromeStateLabel = computed(() => {
  const s = currentStage.value
  if (s === 'draft') return 'Cuando quieras, pulsa para que leamos el archivo por ti.'
  if (s === 'analyzing') return `Estamos leyendo el archivo · ${analysisProgress.value}%`
  if (s === 'review') return 'Revisa la ficha y corrige lo que haga falta.'
  if (s === 'ready') return 'Todo listo: revisa una vez más y guarda.'
  if (s === 'confirmed') return 'Listo: el documento ya forma parte de tu registro.'
  return ''
})

const reviewLiveMessage = ref('')

const summaryRows = computed(() => [
  {
    label: 'Archivo',
    value: currentFileName.value || 'Todavía no hay ningún archivo',
  },
  {
    label: 'Formato',
    value: hasDraft.value
      ? getWorkspaceDocumentFormatLabel(currentMimeType.value, isImageDraft.value)
      : 'Pendiente',
  },
  {
    label: 'Tipo detectado',
    value: ['review', 'ready', 'confirmed'].includes(currentStage.value)
      ? currentProductTypeLabel.value || 'Lo confirmarás tú en la ficha'
      : 'Lo veremos cuando termine la lectura',
  },
])

const highlightGroups = computed<WorkspaceHighlightGroup[]>(() =>
  buildWorkspaceHighlightGroups(extractedEntities.value),
)

const hasActiveHighlights = computed(() =>
  highlightGroups.value.some((group) => group.anchors.length > 0),
)

async function clearLocalDraft() {
  if (currentStage.value === 'confirmed') {
    resetWorkspaceVisualState()
    activeHighlightKey.value = null
    documentsStore.clearWorkspaceDraft()

    if (route.query.productId) {
      await navigateTo('/workspace-documents')
    }

    return
  }

  if (hasPersistedDraft.value || documentsStore.activeUploadId) {
    try {
      await documentsStore.cancelDraft()
      resetWorkspaceVisualState()
      activeHighlightKey.value = null

      toast.add({
        title: 'Archivo quitado',
        description: 'Eliminamos el archivo y lo que tenías pendiente con él.',
        icon: 'i-lucide-trash-2',
        color: 'success',
      })
    } catch (error) {
      toast.add({
        title: 'No pudimos quitar el archivo',
        description:
          error instanceof Error
            ? error.message
            : 'Algo falló al quitarlo. Espera un momento e inténtalo otra vez.',
        icon: 'i-lucide-octagon-alert',
        color: 'error',
      })
    }

    return
  }

  resetWorkspaceVisualState()
  activeHighlightKey.value = null
  documentsStore.clearWorkspaceDraft()
}

function setActiveHighlight(key: string | null) {
  activeHighlightKey.value = key
}

function focusFieldFromHighlight(key: string) {
  const fieldNameByKey: Record<string, string> = {
    title: 'title',
    authors: 'authors',
    year: 'year',
    institution: 'institution',
    doi: 'doi',
    keywords: 'keywords',
    repositoryUrl: 'repositoryUrl',
    softwareRepositoryUrl: 'softwareRepositoryUrl',
  }

  const fieldName = fieldNameByKey[key]
  if (!fieldName || !import.meta.client) {
    return
  }

  setActiveHighlight(key)
  const target = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[name="${fieldName}"]`,
  )
  target?.focus()
}

function resolveRouteFocusKey(rawValue: unknown): WorkspaceRouteFocusKey | null {
  if (typeof rawValue !== 'string') {
    return null
  }

  const normalized = rawValue.trim()
  return isWorkspaceRouteFocusKey(normalized) ? normalized : null
}

async function applyRouteFocusIfNeeded() {
  const focusKey = resolveRouteFocusKey(route.query.focus)

  if (!focusKey) {
    return
  }

  if (!['review', 'ready', 'confirmed'].includes(currentStage.value)) {
    return
  }

  await nextTick()
  requestAnimationFrame(() => focusFieldFromHighlight(focusKey))
}

function openExpandedPreview() {
  if (!currentPreviewUrl.value) {
    return
  }

  showExpandedPreviewModal.value = true
}

function handleFileSelection(selection: File | File[] | null) {
  if (!selection) {
    return
  }

  const file = Array.isArray(selection) ? (selection[0] ?? null) : selection
  if (!file) return

  if (uploadInputLocked.value) {
    toast.add({
      title: 'Tienes un archivo en curso',
      description: 'Para subir otro, primero guarda o cancela el que estás trabajando.',
      icon: 'i-lucide-file-warning',
      color: 'warning',
    })
    pendingSelection.value = null
    return
  }

  documentsStore.prepareWorkspaceDraft(file)
  pendingSelection.value = null
  resetWorkspaceVisualState()
}

async function loadPersistedDraft() {
  hydratingWorkspace.value = true

  try {
    const requestedProductId =
      typeof route.query.productId === 'string' ? route.query.productId.trim() : ''
    const draft = requestedProductId
      ? await documentsStore.loadDraftProduct(requestedProductId)
      : await documentsStore.loadCurrentDraft()

    if (draft) {
      analysisProgress.value = 100
      pushAnalysisHighlight(
        requestedProductId
          ? 'Aquí tienes el documento que pediste ver.'
          : 'Recuperamos tu borrador para que sigas donde lo dejaste.',
      )

      await applyRouteFocusIfNeeded()
    }
  } finally {
    hydratingWorkspace.value = false
  }
}

async function openSiblingDraft(productId: string) {
  if (!productId || productId === documentsStore.activeAcademicProductId) {
    return
  }

  try {
    const draft = await documentsStore.loadDraftProduct(productId)
    if (!draft) {
      return
    }
    toast.add({
      title: 'Otra obra del mismo archivo',
      description: 'Ya puedes revisar la ficha de esta parte del documento.',
      icon: 'i-lucide-files',
      color: 'neutral',
    })
  } catch (error) {
    toast.add({
      title: 'No pudimos abrir esa ficha',
      description: error instanceof Error ? error.message : 'Prueba de nuevo en unos segundos.',
      icon: 'i-lucide-octagon-alert',
      color: 'error',
    })
  }
}

async function startAnalysis() {
  if (!currentLocalFile.value) {
    return
  }

  resetWorkspaceVisualState()
  analysisAttempts.value += 1
  analysisStartedAt.value = Date.now()
  analysisFinishedAt.value = null
  lastAnalysisDurationMs.value = null
  documentsStore.resetWorkspaceMetadata()
  documentsStore.setWorkspaceStage('analyzing')
  analysisProgress.value = 12
  pushAnalysisHighlight(getNextHighlightMessage())

  try {
    await documentsStore.uploadDocument(currentLocalFile.value)
  } catch (error) {
    if (analysisStartedAt.value) {
      analysisFinishedAt.value = Date.now()
      lastAnalysisDurationMs.value = analysisFinishedAt.value - analysisStartedAt.value
    }

    documentsStore.setWorkspaceStage('draft')
    stopProcessingFeedback()

    toast.add({
      title: 'No pudimos leer este archivo',
      description:
        error instanceof Error
          ? error.message
          : 'Ha ocurrido un problema al procesarlo. Espera un momento, prueba otra vez o sube otro archivo.',
      icon: 'i-lucide-octagon-alert',
      color: 'error',
    })
  }
}

async function saveDraftSnapshot() {
  if (!canSaveSnapshot.value) {
    return
  }

  savingSnapshot.value = true

  try {
    await documentsStore.saveDraftChanges(buildSubtypeUpdatePayload())
    toast.add({
      title: 'Cambios guardados',
      description: 'Tus ajustes quedaron guardados; puedes seguir más tarde sin perderlos.',
      icon: 'i-lucide-save',
      color: 'success',
    })
  } catch (error) {
    toast.add({
      title: 'No se guardaron los cambios',
      description:
        error instanceof Error ? error.message : 'No pudimos guardar ahora. Inténtalo otra vez.',
      icon: 'i-lucide-octagon-alert',
      color: 'error',
    })
  } finally {
    savingSnapshot.value = false
  }
}

async function saveWorkspaceResult() {
  if (!canSave.value) {
    return
  }

  try {
    await documentsStore.confirmDraft(buildSubtypeUpdatePayload())
    toast.add({
      title: 'Documento registrado',
      description: 'Tu revisión quedó confirmada y ya está en tu historial.',
      icon: 'i-lucide-check-circle',
      color: 'success',
    })
  } catch (error) {
    toast.add({
      title: 'No pudimos completar el guardado',
      description:
        error instanceof Error ? error.message : 'Algo salió mal. Prueba de nuevo en un rato.',
      icon: 'i-lucide-octagon-alert',
      color: 'error',
    })
  }
}

function requestCancelFlow() {
  if (!canDeleteCurrentDraft.value) {
    return
  }

  showCancelModal.value = true
}

async function confirmCancelFlow() {
  showCancelModal.value = false

  try {
    await documentsStore.cancelDraft()
    resetWorkspaceVisualState()
    toast.add({
      title: 'Cancelado',
      description: 'Quitamos el archivo y lo que tenías pendiente con él.',
      icon: 'i-lucide-trash-2',
      color: 'success',
    })
  } catch (error) {
    toast.add({
      title: 'No pudimos cancelar',
      description:
        error instanceof Error ? error.message : 'No se pudo cancelar ahora. Inténtalo otra vez.',
      icon: 'i-lucide-octagon-alert',
      color: 'error',
    })
  }
}

watch(pendingSelection, handleFileSelection)

watch(
  () => route.query.productId,
  async (productId, previousProductId) => {
    if (productId === previousProductId) {
      return
    }

    if (typeof productId === 'string' && productId.trim().length > 0) {
      hydratingWorkspace.value = true
      try {
        await documentsStore.loadDraftProduct(productId)
        await applyRouteFocusIfNeeded()
      } finally {
        hydratingWorkspace.value = false
      }
      return
    }

    await loadPersistedDraft()
  },
)

watch(
  () => route.query.focus,
  async () => {
    await applyRouteFocusIfNeeded()
  },
)

watch(
  currentStage,
  (stage, prev) => {
    if (!['review', 'ready', 'confirmed'].includes(stage)) {
      activeHighlightKey.value = null
    }

    if (stage === 'review' && prev === 'analyzing') {
      if (reviewLiveClearTimeout != null) {
        clearTimeout(reviewLiveClearTimeout)
        reviewLiveClearTimeout = null
      }
      reviewLiveMessage.value = 'La ficha ya está lista. Revísala y ajusta lo que necesites.'
      const focusReviewHeading = () => {
        const narrow = document.getElementById(
          'workspace-review-heading-narrow',
        ) as HTMLElement | null
        const wide = document.getElementById('workspace-review-heading-wide') as HTMLElement | null
        if (narrow && narrow.offsetParent !== null) {
          narrow.focus()
        } else {
          wide?.focus()
        }
      }
      nextTick(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(focusReviewHeading)
        })
        setTimeout(focusReviewHeading, 420)
      })
      reviewLiveClearTimeout = setTimeout(() => {
        reviewLiveMessage.value = ''
        reviewLiveClearTimeout = null
      }, 8000)
    }

    if (stage === 'analyzing') {
      startProcessingFeedback()
      return
    }

    stopProcessingFeedback()

    if (
      ['review', 'ready', 'confirmed'].includes(stage) &&
      analysisStartedAt.value &&
      !analysisFinishedAt.value
    ) {
      analysisFinishedAt.value = Date.now()
      lastAnalysisDurationMs.value = analysisFinishedAt.value - analysisStartedAt.value
    }

    if (['review', 'ready', 'confirmed'].includes(stage)) {
      analysisProgress.value = 100
    }
  },
  { immediate: true },
)

watch(currentProcessingError, (error) => {
  if (!error || error === lastShownProcessingError.value) {
    return
  }

  lastShownProcessingError.value = error
  documentsStore.setWorkspaceStage('draft')
  stopProcessingFeedback()

  const duplicate = isDuplicateRepositoryUploadError(error)
  toast.add({
    title: duplicate
      ? 'Este documento ya está en el repositorio'
      : 'No pudimos terminar con este archivo',
    description: error,
    icon: duplicate ? 'i-lucide-copy' : 'i-lucide-octagon-alert',
    color: 'error',
  })
})

watch(
  () => documentsStore.draftProduct?.product,
  () => {
    if (['review', 'ready', 'confirmed'].includes(currentStage.value)) {
      hydrateSubtypeFieldsFromProduct()
    }
  },
  { immediate: true },
)

watch(pollConsecutiveFailures, (failures) => {
  if (failures === 3) {
    toast.add({
      title: 'Conexión inestable',
      description:
        'Llevamos un rato sin poder actualizar el estado del archivo. Revisa tu internet o recarga la página.',
      icon: 'i-lucide-wifi-off',
      color: 'warning',
    })
  }
})

onMounted(async () => {
  stopDocumentsFocusRefresh = documentsStore.refreshOnFocus()
  await loadPersistedDraft()
})

onBeforeUnmount(() => {
  if (reviewLiveClearTimeout != null) {
    clearTimeout(reviewLiveClearTimeout)
    reviewLiveClearTimeout = null
  }
  stopDocumentsFocusRefresh?.()
})
</script>

<template>
  <div class="workspace-documents-page space-y-5 sm:space-y-6">
    <UAlert
      v-if="isReadonlyView"
      color="neutral"
      variant="soft"
      icon="i-lucide-eye"
      title="Modo solo lectura"
      description="Este documento ya quedó registrado. Puedes verlo aquí, pero no cambiarlo."
      class="fade-up stagger-1 max-w-3xl"
    />

    <WorkspaceStageHeader
      :eyebrow="currentStageCopy.eyebrow"
      :title="currentStageCopy.title"
      :description="currentStageCopy.description"
      :stage-progress-percent="stageProgressPercent"
      :steps="stageSteps"
    />

    <div
      v-if="showReextractNerCta"
      class="fade-up stagger-2 flex max-w-3xl flex-col gap-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p class="text-sm leading-relaxed text-text-muted">
        La confianza de extracción automática es baja. Puedes corregir la ficha a mano o volver a
        ejecutar el NER sobre el texto ya leído del archivo.
      </p>
      <UButton
        size="sm"
        color="primary"
        variant="soft"
        icon="i-lucide-refresh-ccw"
        :loading="reextractingNer"
        class="shrink-0 self-start sm:self-center"
        @click="runReextractNer"
      >
        Re-ejecutar extracción
      </UButton>
    </div>

    <p v-if="reviewLiveMessage" class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{ reviewLiveMessage }}
    </p>

    <WorkspaceDocumentsTaskChrome
      :stage="currentStage"
      :file-title="taskChromeFileTitle"
      :file-meta="taskChromeFileMeta"
      :state-label="taskChromeStateLabel"
      :visible="taskChromeVisible"
    >
      <template v-if="!isReadonlyView" #actions>
        <WorkspaceDocumentActions
          :stage="currentStage"
          :is-readonly-view="isReadonlyView"
          :uploading="documentsStore.uploading"
          :saving-snapshot="savingSnapshot"
          :saving-draft="documentsStore.savingDraft"
          :canceling-draft="documentsStore.cancelingDraft"
          :can-edit-current-draft="canEditCurrentDraft"
          :can-delete-current-draft="canDeleteCurrentDraft"
          @start-analysis="startAnalysis"
          @save-draft-snapshot="saveDraftSnapshot"
          @clear-local-draft="clearLocalDraft"
          @request-cancel-flow="requestCancelFlow"
        />
      </template>
    </WorkspaceDocumentsTaskChrome>

    <div :class="workspaceShellClass">
      <WorkspaceUploadAside
        v-model:pending-selection="pendingSelection"
        :processing-error-title="currentProcessingErrorAlertTitle"
        :upload-input-locked="uploadInputLocked"
        :current-stage="currentStage"
        :current-local-file="currentLocalFile"
        :has-persisted-draft="hasPersistedDraft"
        :current-processing-error="currentProcessingError"
        :has-draft="hasDraft"
        :is-image-draft="isImageDraft"
        :current-file-name="currentFileName"
        :current-file-size="currentFileSize"
        :file-extension="fileExtension"
        :stage-eyebrow="currentStageCopy.eyebrow"
        :sibling-product-ids="siblingProductIds"
        :source-work-count="currentTrackedFile?.sourceWorkCount ?? siblingProductIds.length"
        :active-product-id="documentsStore.activeAcademicProductId"
        :uploading="documentsStore.uploading"
        :canceling-draft="documentsStore.cancelingDraft"
        :saving-draft="documentsStore.savingDraft"
        :saving-snapshot="savingSnapshot"
        :can-edit-current-draft="canEditCurrentDraft"
        :can-delete-current-draft="canDeleteCurrentDraft"
        :is-readonly-view="isReadonlyView"
        @start-analysis="startAnalysis"
        @save-draft-snapshot="saveDraftSnapshot"
        @clear-local-draft="clearLocalDraft"
        @request-cancel-flow="requestCancelFlow"
        @open-sibling-draft="openSiblingDraft"
      />

      <div
        class="workspace-documents-main min-w-0"
        :class="{ 'pb-24 xl:pb-0': needsMobileSavePadding }"
      >
        <section
          class="panel-surface fade-up stagger-3 overflow-hidden p-5 sm:p-6 lg:p-5"
          :aria-busy="currentStage === 'analyzing' ? 'true' : undefined"
        >
          <Transition name="workspace-phase" mode="out-in">
            <WorkspacePanelEmpty
              v-if="currentStage === 'empty'"
              key="ws-empty"
              :hydrating-workspace="hydratingWorkspace"
            />
            <WorkspacePanelDraft
              v-else-if="currentStage === 'draft'"
              key="ws-draft"
              :preview-url="currentPreviewUrl"
              :mime-type="currentMimeType"
              :summary-rows="summaryRows"
              @preview-expand="openExpandedPreview"
            />
            <WorkspacePanelAnalyzing
              v-else-if="currentStage === 'analyzing'"
              key="ws-analyzing"
              :preview-url="currentPreviewUrl"
              :mime-type="currentMimeType"
              :analysis-progress="analysisProgress"
              :analysis-highlights="analysisHighlights"
              :reduced-motion="prefersReducedMotion"
              :max-visible-highlights="WORKSPACE_MAX_VISIBLE_ANALYSIS_HIGHLIGHTS"
              @preview-expand="openExpandedPreview"
            />
            <WorkspacePanelReview
              v-else
              :key="`ws-${currentStage}`"
              v-model:product-type="selectedProductType"
              :current-stage="currentStage"
              :preview-url="currentPreviewUrl"
              :mime-type="currentMimeType"
              :highlight-groups="highlightGroups"
              :active-highlight-key="activeHighlightKey"
              :has-active-highlights="hasActiveHighlights"
              :is-image-draft="isImageDraft"
              :metadata="metadata"
              :summary-rows="summaryRows"
              :product-type-options="productTypeOptions"
              :grouped-specific-fields="groupedSpecificFields"
              :get-subtype-field-name="getSubtypeFieldName"
              :get-subtype-field-value="getSubtypeFieldValue"
              :set-subtype-field-value="setSubtypeFieldValue"
              :get-field-class="getFieldClass"
              :can-edit-current-draft="canEditCurrentDraft"
              :can-save="canSave"
              :can-save-snapshot="canSaveSnapshot"
              :saving-snapshot="savingSnapshot"
              :saving-draft="documentsStore.savingDraft"
              @preview-expand="openExpandedPreview"
              @highlight-click="focusFieldFromHighlight"
              @field-focus="setActiveHighlight"
              @save-draft-snapshot="saveDraftSnapshot"
              @save-workspace-result="saveWorkspaceResult"
            />
          </Transition>
        </section>
      </div>
    </div>

    <section
      v-if="showTestingMetrics"
      class="panel-surface fade-up border border-amber-200/80 bg-amber-50/80 px-5 py-5 sm:px-6"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-[0.72rem] font-semibold tracking-[0.16em] text-amber-700 uppercase">
            Métricas de prueba
          </p>
          <h2 class="mt-1 font-display text-lg font-medium leading-snug text-text">
            Seguimiento técnico (solo testing)
          </h2>
          <p class="mt-1 max-w-2xl text-sm leading-[1.6] text-text-muted">
            Estas métricas son de soporte para pruebas del flujo actual y se muestran únicamente en
            desarrollo.
          </p>
        </div>

        <SipacBadge color="warning" variant="outline">No visible en producción</SipacBadge>
      </div>

      <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <template
          v-for="(item, idx) in testingMetricsItems"
          :key="`${item.variant}-${idx}-${item.label}`"
        >
          <article
            v-if="item.variant === 'card'"
            class="rounded-[1rem] border border-amber-200/80 bg-white/85 p-4"
          >
            <p class="text-xs font-semibold tracking-[0.12em] text-text-soft uppercase">
              {{ item.label }}
            </p>
            <p class="mt-2 whitespace-pre-wrap text-base font-semibold text-text">
              {{ item.value }}
            </p>
            <p class="mt-1 text-sm leading-6 text-text-muted">{{ item.hint }}</p>
          </article>
          <article
            v-else
            class="rounded-[1rem] border border-amber-200/80 bg-white/85 p-4 md:col-span-2 xl:col-span-3"
          >
            <p class="text-xs font-semibold tracking-[0.12em] text-text-soft uppercase">
              {{ item.label }}
            </p>
            <pre
              v-if="item.mono !== false"
              class="mt-2 max-h-72 overflow-x-auto overflow-y-auto rounded-lg border border-amber-100 bg-amber-50/50 p-3 font-mono text-[0.72rem] leading-relaxed text-text"
              >{{ item.body }}</pre
            >
            <p
              v-else
              class="mt-2 whitespace-pre-wrap rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-sm leading-relaxed text-text"
            >
              {{ item.body }}
            </p>
            <p class="mt-1 text-sm leading-6 text-text-muted">{{ item.hint }}</p>
          </article>
        </template>
      </div>
    </section>

    <UModal v-model:open="showCancelModal" title="¿Cancelar este archivo?">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm leading-6 text-text-muted">
            Si sigues, quitaremos el archivo y todo lo que aún no hayas guardado con él. Esto no se
            puede deshacer.
          </p>

          <div class="flex justify-end gap-2">
            <SipacButton variant="ghost" color="neutral" @click="showCancelModal = false"
              >Volver</SipacButton
            >
            <SipacButton
              color="error"
              :loading="documentsStore.cancelingDraft"
              @click="confirmCancelFlow"
            >
              Sí, cancelar
            </SipacButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="showExpandedPreviewModal"
      title="Documento en grande"
      :ui="{ content: 'max-w-[94vw]' }"
    >
      <template #body>
        <div
          class="rounded-2xl border border-border/75 bg-surface/90 px-3 pb-3 pt-0 sm:px-4 sm:pb-4 sm:pt-0"
        >
          <DocumentPreviewWithHighlights
            :preview-url="currentPreviewUrl"
            :mime-type="currentMimeType"
            :groups="['review', 'ready', 'confirmed'].includes(currentStage) ? highlightGroups : []"
            :active-key="
              ['review', 'ready', 'confirmed'].includes(currentStage) ? activeHighlightKey : null
            "
            @highlight-click="focusFieldFromHighlight"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.workspace-phase-enter-active,
.workspace-phase-leave-active {
  transition:
    opacity 0.32s var(--ease-sipac, cubic-bezier(0.22, 1, 0.36, 1)),
    transform 0.32s var(--ease-sipac, cubic-bezier(0.22, 1, 0.36, 1));
}

.workspace-phase-enter-from,
.workspace-phase-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (prefers-reduced-motion: reduce) {
  .workspace-phase-enter-active,
  .workspace-phase-leave-active {
    transition: none;
  }

  .workspace-phase-enter-from,
  .workspace-phase-leave-to {
    transform: none;
  }
}
</style>
