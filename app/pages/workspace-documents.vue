<script setup lang="ts">
import type {
  ProductType,
  DocumentAnchor,
  NerAttemptTraceEntry,
  UpdateAcademicProductDTO,
} from '~~/app/types'
import type { WorkspaceStage } from '~~/app/stores/documents'
import type { MetadataFieldConfig } from '~~/app/utils/product-metadata-layout'
import DocumentPreviewWithHighlights from '~~/app/components/dashboard/DocumentPreviewWithHighlights.vue'
import { PRODUCT_METADATA_LAYOUT } from '~~/app/utils/product-metadata-layout'

const documentsStore = useDocumentsStore()
const toast = useToast()
const runtimeConfig = useRuntimeConfig()

const pendingSelection = ref<File | null>(null)
const showCancelModal = ref(false)
const showExpandedPreviewModal = ref(false)
const hydratingWorkspace = ref(true)
const analysisProgress = ref(0)
const analysisHighlights = ref<AnalysisHighlightItem[]>([])
const savingSnapshot = ref(false)
const lastShownProcessingError = ref<string | null>(null)
const analysisStartedAt = ref<number | null>(null)
const analysisFinishedAt = ref<number | null>(null)
const lastAnalysisDurationMs = ref<number | null>(null)
const analysisAttempts = ref(0)
const activeHighlightKey = ref<string | null>(null)

const productTypeOptions = [
  { label: 'Artículo científico', value: 'article' },
  { label: 'Ponencia en evento', value: 'conference_paper' },
  { label: 'Tesis o trabajo de grado', value: 'thesis' },
  { label: 'Certificado o constancia', value: 'certificate' },
  { label: 'Proyecto de investigación', value: 'research_project' },
  { label: 'Libro', value: 'book' },
  { label: 'Capítulo de libro', value: 'book_chapter' },
  { label: 'Reporte técnico', value: 'technical_report' },
  { label: 'Software', value: 'software' },
  { label: 'Patente', value: 'patent' },
] satisfies Array<{ label: string; value: ProductType }>

const stageCopy: Record<WorkspaceStage, { eyebrow: string; title: string; description: string }> = {
  empty: {
    eyebrow: 'Sin archivo',
    title: 'Trae un archivo para empezar.',
    description:
      'Cuando lo adjuntes, aquí verás su vista previa y una ficha clara para corregir lo necesario.',
  },
  draft: {
    eyebrow: 'Listo para empezar',
    title: 'El archivo ya quedó preparado.',
    description: 'Comprueba que sea el correcto y empieza la revisión cuando quieras.',
  },
  analyzing: {
    eyebrow: 'Preparando tu ficha',
    title: 'Estamos leyendo el archivo para dejarte una primera versión.',
    description:
      'Mantén esta página abierta si quieres seguir el avance. Si vuelves más tarde, retomaremos desde donde quedó.',
  },
  review: {
    eyebrow: 'Corrige con calma',
    title: 'Ya tienes una primera versión para revisar.',
    description: 'Ajusta lo que haga falta antes de dejarlo listo.',
  },
  ready: {
    eyebrow: 'Listo para guardar',
    title: 'La revisión ya puede confirmarse.',
    description: 'Haz una última comprobación y guarda el resultado cuando estés conforme.',
  },
  confirmed: {
    eyebrow: 'Guardado',
    title: 'Tu documento ya quedó registrado.',
    description: 'Puedes empezar otro archivo cuando quieras.',
  },
}

const processingMessages = [
  'Estamos leyendo la estructura principal del archivo.',
  'Ya vamos ubicando título, autores y fecha para armar la ficha.',
  'La vista previa seguirá disponible para que compares cada dato con calma.',
  'En cuanto la ficha esté lista, podrás corregirla antes de guardarla.',
  'Estamos afinando la lectura OCR para distinguir texto principal y notas visibles.',
  'Vamos separando encabezados, cuerpo y referencias para describir mejor el documento.',
  'Estamos reconociendo nombres propios, instituciones y fechas relevantes.',
  'Ya estamos contrastando autores, título y año para reducir ambigüedades.',
  'Analizamos la jerarquía del contenido para ordenar la ficha con más claridad.',
  'Vamos detectando palabras clave y trazas bibliográficas que pueden servirte al revisar.',
  'Estamos verificando si el documento trae DOI, referencia o identificadores útiles.',
  'La extracción NER sigue en curso para proponer campos editables desde la primera versión.',
  'Revisamos la consistencia entre portada, encabezado y texto interno del archivo.',
  'Estamos buscando señales del tipo de producto para dejar una clasificación inicial.',
  'Ya vamos ubicando universidad, revista o entidad responsable cuando aparecen en el archivo.',
  'Procesamos bloques de texto para reconocer metadatos sin perder el contexto visual.',
  'Estamos comparando fragmentos cercanos para diferenciar título, subtítulo y notas.',
  'La lectura del documento continúa; iremos dejando solo los avances más recientes a la vista.',
  'Estamos identificando patrones académicos para completar la ficha con mejor criterio.',
  'Ya contrastamos varias zonas del archivo para detectar datos repetidos o complementarios.',
  'Seguimos leyendo tablas, encabezados y secciones breves que puedan contener metadatos.',
  'Vamos consolidando una primera propuesta de ficha para que la revisión manual sea más rápida.',
  'Estamos priorizando los datos más útiles para que aparezcan primero en la revisión.',
  'La detección de entidades sigue activa; pronto podrás validar cada campo con calma.',
  'Estamos revisando si hay metadatos dispersos entre portada, resumen y páginas interiores.',
  'Vamos preparando una versión clara de la ficha a partir del OCR y la extracción semántica.',
]

const MAX_VISIBLE_ANALYSIS_HIGHLIGHTS = 4
const ANALYSIS_HIGHLIGHT_INTERVAL_MS = 1800
const ANALYSIS_HIGHLIGHT_EXIT_DELAY_MS = 240

type AnalysisHighlightItem = {
  id: string
  message: string
  leaving: boolean
}

type TestingMetricItem =
  | { variant: 'card'; label: string; value: string; hint: string }
  | { variant: 'wide'; label: string; body: string; hint: string; mono?: boolean }

let progressTimer: ReturnType<typeof setInterval> | null = null
let highlightTimer: ReturnType<typeof setInterval> | null = null
let highlightCursor = 0
let highlightSerial = 0
let highlightRemovalTimers: ReturnType<typeof setTimeout>[] = []

const currentStage = computed(() => documentsStore.workspaceStage)
const currentStageCopy = computed(() => stageCopy[currentStage.value])
const hasDraft = computed(() => documentsStore.hasWorkspaceDraft)
const hasPersistedDraft = computed(() => documentsStore.hasPersistedDraft)
const currentPreviewUrl = computed(() => documentsStore.workspaceDraftPreviewUrl)
const currentLocalFile = computed(() => documentsStore.workspaceDraftFile)
const currentTrackedFile = computed(
  () => documentsStore.activeTrackedDocument ?? documentsStore.draftProduct?.uploadedFile ?? null,
)
const uploadForceSingleWork = ref(false)
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
function inferMimeTypeFromFilename(filename: string): string {
  const normalized = filename.trim().toLowerCase()

  if (normalized.endsWith('.pdf')) {
    return 'application/pdf'
  }

  if (normalized.endsWith('.png')) {
    return 'image/png'
  }

  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
    return 'image/jpeg'
  }

  return ''
}

const currentMimeType = computed(
  () =>
    currentTrackedFile.value?.mimeType ??
    (currentLocalFile.value?.type || inferMimeTypeFromFilename(currentFileName.value)),
)
const currentProcessingError = computed(
  () => documentsStore.activeTrackedDocument?.processingError ?? null,
)
const showTestingMetrics = computed(
  () => import.meta.dev && runtimeConfig.public.enableTestingMetrics,
)
const selectedProductType = computed({
  get: () => documentsStore.workspaceDraftProductType,
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
  () => ['review', 'ready'].includes(currentStage.value) && hasPersistedDraft.value,
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
const testingMetricsItems = computed((): TestingMetricItem[] => {
  const tracked = currentTrackedFile.value
  const product = documentsStore.draftProduct?.product
  const entities = product?.extractedEntities
  const uploadId = tracked?._id ?? documentsStore.activeUploadId ?? '—'
  const productId = tracked?.academicProductId ?? '—'

  const ocrConfidence = tracked?.ocrConfidence
  const classificationConfidence = tracked?.classificationConfidence
  const processingStartMs = toTimestamp(tracked?.processingStartedAt)
  const ocrCompletedMs = toTimestamp(tracked?.ocrCompletedAt)
  const nerStartedMs = toTimestamp(tracked?.nerStartedAt)
  const processingCompletedMs = toTimestamp(tracked?.processingCompletedAt)
  const processingAttempt = tracked?.processingAttempt ?? 0
  const durationMs =
    processingStartMs && processingCompletedMs
      ? processingCompletedMs - processingStartMs
      : processingStartMs && currentStage.value === 'analyzing'
        ? Date.now() - processingStartMs
        : (lastAnalysisDurationMs.value ??
          (currentStage.value === 'analyzing' && analysisStartedAt.value
            ? Date.now() - analysisStartedAt.value
            : null))
  const ocrDurationMs =
    processingStartMs && ocrCompletedMs ? Math.max(0, ocrCompletedMs - processingStartMs) : null
  const nerDurationMs =
    nerStartedMs && processingCompletedMs ? Math.max(0, processingCompletedMs - nerStartedMs) : null

  const ocrProviderLabel =
    tracked?.ocrProvider === 'pdfjs_native'
      ? 'PDF.js nativo'
      : tracked?.ocrProvider === 'gemini_vision'
        ? 'Gemini Vision'
        : tracked?.ocrProvider === 'mistral_ocr_3'
          ? 'Mistral OCR 3 (fuera de MVP)'
          : 'No disponible'

  const ocrModelLabel =
    tracked?.ocrProvider === 'pdfjs_native'
      ? 'No aplica (pdfjs nativo)'
      : (tracked?.ocrModel ?? 'No disponible')

  const nerModelLabel =
    tracked?.nerModel && tracked?.nerProvider
      ? `${tracked.nerModel} (${tracked.nerProvider})`
      : (tracked?.nerModel ?? 'No disponible')

  const rawLen = tracked?.rawExtractedText?.length
  const classificationSourceLabel = tracked?.documentClassificationSource ?? '—'
  const classificationLabel = tracked?.documentClassification ?? '—'

  const items: TestingMetricItem[] = [
    {
      variant: 'card',
      label: 'Estado del análisis (servidor)',
      value: tracked?.processingStatus ?? 'sin tracked',
      hint: 'processingStatus en UploadedFile; compáralo con el stage de la UI.',
    },
    {
      variant: 'card',
      label: 'Stage UI (cliente)',
      value: currentStage.value,
      hint: 'Estado del flujo en el workspace (puede adelantarse o retrasarse vs servidor).',
    },
    {
      variant: 'card',
      label: 'IDs',
      value: `upload: ${uploadId}\nproduct: ${productId}`,
      hint: 'Correlación con logs [pipeline] y MongoDB.',
    },
    {
      variant: 'card',
      label: 'Archivo',
      value: `${currentFileName.value || '—'}\n${formatFileSize(currentFileSize.value)} · ${currentMimeType.value || '—'}`,
      hint: 'Nombre, tamaño y MIME vistos en el cliente.',
    },
    {
      variant: 'card',
      label: 'Duración del procesamiento (servidor)',
      value: formatDuration(durationMs),
      hint: 'processingStartedAt → processingCompletedAt (o reloj en curso si aún analyzing).',
    },
    {
      variant: 'card',
      label: 'Duración último análisis (cliente)',
      value: formatDuration(lastAnalysisDurationMs.value),
      hint: 'Cronómetro local de la sesión desde que pulsaste analizar hasta fin/estado estable.',
    },
    {
      variant: 'card',
      label: 'Intentos procesamiento (servidor)',
      value: String(processingAttempt),
      hint: 'processingAttempt en BD (reintentos/colas).',
    },
    {
      variant: 'card',
      label: 'Ciclos análisis (cliente)',
      value: String(analysisAttempts.value),
      hint: 'Veces que esta pestaña entró en flujo de análisis en la sesión.',
    },
    {
      variant: 'card',
      label: 'Proveedor OCR',
      value: ocrProviderLabel,
      hint: 'Fuente usada para extracción de texto.',
    },
    {
      variant: 'card',
      label: 'Modelo LLM OCR',
      value: ocrModelLabel,
      hint: 'Modelo Gemini (u otro) si la ruta fue visión; pdfjs nativo no usa LLM.',
    },
    {
      variant: 'card',
      label: 'Confianza OCR',
      value: formatConfidence(ocrConfidence),
      hint: 'Heurística interna post-OCR.',
    },
    {
      variant: 'card',
      label: 'Longitud texto OCR',
      value: typeof rawLen === 'number' ? `${rawLen.toLocaleString()} caracteres` : 'No disponible',
      hint: 'rawExtractedText; útil para ver si el OCR devolvió vacío o truncado.',
    },
    {
      variant: 'card',
      label: 'Duración fase OCR (aprox.)',
      value: formatDuration(ocrDurationMs),
      hint: 'processingStartedAt → ocrCompletedAt.',
    },
    {
      variant: 'card',
      label: 'Duración NER + cierre (aprox.)',
      value: formatDuration(nerDurationMs),
      hint: 'nerStartedAt → processingCompletedAt.',
    },
    {
      variant: 'card',
      label: 'Clasificación documento',
      value: `${classificationLabel} · fuente: ${classificationSourceLabel}`,
      hint: 'academic / non_academic / uncertain y si vino de heurística, LLM o híbrido.',
    },
    {
      variant: 'card',
      label: 'Confianza clasificación',
      value: formatConfidence(classificationConfidence),
      hint: 'classificationConfidence en el archivo.',
    },
    {
      variant: 'card',
      label: 'Tipo de producto (ficha)',
      value: product?.productType ?? selectedProductType.value,
      hint: 'Tipo en el borrador académico (puede coincidir o no con heurística inicial).',
    },
    {
      variant: 'card',
      label: 'Modelo NER (ganador)',
      value: nerModelLabel,
      hint: 'Último modelo que completó extracción estructurada en servidor.',
    },
    {
      variant: 'card',
      label: 'Confianza extracción (entidades)',
      value: formatConfidence(entities?.extractionConfidence),
      hint: 'extractedEntities.extractionConfidence (promedio calibrado de campos).',
    },
    {
      variant: 'card',
      label: 'Origen texto para NER',
      value: entities?.extractionSource ? String(entities.extractionSource) : 'No disponible',
      hint: 'extractionSource en entidades: qué pipeline OCR alimentó el NER.',
    },
    {
      variant: 'card',
      label: 'Extracción registrada (ISO)',
      value: entities?.extractedAt ?? 'No disponible',
      hint: 'extractedAt del bloque de entidades.',
    },
    {
      variant: 'card',
      label: 'Traza NER (compacta)',
      value: formatNerAttemptTrace(tracked?.nerAttemptTrace),
      hint: 'Una línea; abajo tienes multilínea y JSON.',
    },
    {
      variant: 'card',
      label: 'Completitud ficha editable',
      value: `${metadataCompletion.value.completed}/${metadataCompletion.value.total} (${metadataCompletion.value.percent}%)`,
      hint: 'Campos del formulario manual llenos.',
    },
  ]

  const rationale = tracked?.classificationRationale?.trim()
  if (rationale) {
    items.push({
      variant: 'wide',
      label: 'Razonamiento clasificación (completo)',
      body: rationale,
      hint: 'Texto devuelto por el clasificador (o híbrido); suele cortarse en UI normal.',
      mono: false,
    })
  }

  const procErr = tracked?.processingError?.trim()
  if (procErr) {
    items.push({
      variant: 'wide',
      label: 'Error de procesamiento (completo)',
      body: procErr,
      hint: 'Mensaje guardado en uploadedFile.processingError.',
      mono: true,
    })
  }

  const tsBlock = [
    tracked?.processingStartedAt && `processingStartedAt: ${tracked.processingStartedAt}`,
    tracked?.ocrCompletedAt && `ocrCompletedAt: ${tracked.ocrCompletedAt}`,
    tracked?.nerStartedAt && `nerStartedAt: ${tracked.nerStartedAt}`,
    tracked?.processingCompletedAt && `processingCompletedAt: ${tracked.processingCompletedAt}`,
  ]
    .filter(Boolean)
    .join('\n')

  if (tsBlock) {
    items.push({
      variant: 'wide',
      label: 'Marcas de tiempo (ISO del servidor)',
      body: tsBlock,
      hint: 'Copiar a logs o comparar latencias entre fases.',
      mono: true,
    })
  }

  const verboseTrace = formatNerAttemptTraceVerbose(tracked?.nerAttemptTrace)
  if (verboseTrace) {
    items.push({
      variant: 'wide',
      label: 'Traza intentos NER (multilínea)',
      body: verboseTrace,
      hint: 'Una línea por intento; error hasta ~500 caracteres.',
      mono: true,
    })
  }

  const traceJson = formatNerAttemptTraceJson(tracked?.nerAttemptTrace)
  if (traceJson) {
    items.push({
      variant: 'wide',
      label: 'Traza NER (JSON)',
      body: traceJson,
      hint: 'Para pegar en issues o comparar con logs del servidor.',
      mono: true,
    })
  }

  return items
})
const uploadInputLocked = computed(() =>
  ['analyzing', 'review', 'ready', 'confirmed'].includes(currentStage.value),
)
const stageSteps = computed(() => [
  {
    label: 'Adjuntar',
    hint: hasDraft.value ? 'Archivo listo' : 'Añade un archivo',
    active: hasDraft.value,
    complete: ['draft', 'analyzing', 'review', 'ready', 'confirmed'].includes(currentStage.value),
  },
  {
    label: 'Revisar',
    hint:
      currentStage.value === 'analyzing'
        ? `${analysisProgress.value}% visible`
        : 'Lectura y corrección',
    active: ['analyzing', 'review', 'ready', 'confirmed'].includes(currentStage.value),
    complete: ['review', 'ready', 'confirmed'].includes(currentStage.value),
  },
  {
    label: 'Guardar',
    hint:
      currentStage.value === 'confirmed'
        ? 'Completado'
        : currentStage.value === 'ready'
          ? 'Disponible ahora'
          : 'Al final del flujo',
    active: ['ready', 'confirmed'].includes(currentStage.value),
    complete: currentStage.value === 'confirmed',
  },
])
const summaryRows = computed(() => [
  {
    label: 'Archivo',
    value: currentFileName.value || 'Aún no has cargado uno',
  },
  {
    label: 'Formato',
    value: hasDraft.value ? (isImageDraft.value ? 'Imagen' : 'Documento') : 'Pendiente',
  },
  {
    label: 'Tipo detectado',
    value: ['review', 'ready', 'confirmed'].includes(currentStage.value)
      ? currentProductTypeLabel.value || 'Por confirmar'
      : 'Se mostrará cuando la ficha esté lista',
  },
])

type HighlightGroup = {
  key: string
  label: string
  confidence?: number
  anchors: DocumentAnchor[]
}

function uniqueAnchors(anchors: DocumentAnchor[]) {
  const seen = new Set<string>()
  return anchors.filter((anchor) => {
    const id = `${anchor.page}-${anchor.x}-${anchor.y}-${anchor.width}-${anchor.height}`
    if (seen.has(id)) {
      return false
    }

    seen.add(id)
    return true
  })
}

const highlightGroups = computed<HighlightGroup[]>(() => {
  const entities = extractedEntities.value
  if (!entities) {
    return []
  }

  const authorAnchors = uniqueAnchors(entities.authors.flatMap((author) => author.anchors ?? []))
  const keywordAnchors = uniqueAnchors(
    entities.keywords.flatMap((keyword) => keyword.anchors ?? []),
  )

  return [
    {
      key: 'title',
      label: 'Título',
      confidence: entities.title?.confidence,
      anchors: entities.title?.anchors ?? [],
    },
    {
      key: 'authors',
      label: 'Autores',
      confidence: entities.authors[0]?.confidence,
      anchors: authorAnchors,
    },
    {
      key: 'year',
      label: 'Fecha',
      confidence: entities.date?.confidence,
      anchors: entities.date?.anchors ?? [],
    },
    {
      key: 'institution',
      label: 'Institución',
      confidence: entities.institution?.confidence,
      anchors: entities.institution?.anchors ?? [],
    },
    {
      key: 'doi',
      label: 'DOI',
      confidence: entities.doi?.confidence,
      anchors: entities.doi?.anchors ?? [],
    },
    {
      key: 'keywords',
      label: 'Palabras clave',
      confidence: entities.keywords[0]?.confidence,
      anchors: keywordAnchors,
    },
  ]
})

const hasActiveHighlights = computed(() =>
  highlightGroups.value.some((group) => group.anchors.length > 0),
)

const titleInput = computed({
  get: () => metadata.value.title,
  set: (value: string) => documentsStore.updateDetectedMetadata({ title: value }),
})

const authorsInput = computed({
  get: () => metadata.value.authors.join(', '),
  set: (value: string) => {
    documentsStore.updateDetectedMetadata({
      authors: value
        .split(/,|\n/)
        .map((author) => author.trim())
        .filter(Boolean),
    })
  },
})

const yearInput = computed({
  get: () => metadata.value.year,
  set: (value: string) => documentsStore.updateDetectedMetadata({ year: value }),
})

const institutionInput = computed({
  get: () => metadata.value.institution,
  set: (value: string) => documentsStore.updateDetectedMetadata({ institution: value }),
})

const doiInput = computed({
  get: () => metadata.value.doi,
  set: (value: string) => documentsStore.updateDetectedMetadata({ doi: value }),
})

const keywordsInput = computed({
  get: () => metadata.value.keywords.join(', '),
  set: (value: string) => {
    documentsStore.updateDetectedMetadata({
      keywords: value
        .split(/,|\n/)
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    })
  },
})

const notesInput = computed({
  get: () => metadata.value.notes,
  set: (value: string) => documentsStore.updateDetectedMetadata({ notes: value }),
})

const currentProduct = computed(() => documentsStore.draftProduct?.product)

type SupportedSubtypeProductType =
  | 'article'
  | 'thesis'
  | 'conference_paper'
  | 'certificate'
  | 'research_project'
  | 'book'
  | 'book_chapter'
  | 'technical_report'
  | 'software'
  | 'patent'

const articleFields = reactive({
  journalName: '',
  volume: '',
  issue: '',
  pages: '',
  issn: '',
  indexing: '',
  articleType: '' as '' | 'original' | 'revision' | 'corto' | 'carta' | 'otro',
  journalCountry: '',
  journalAbbreviation: '',
  publisher: '',
  areaOfKnowledge: '',
  language: '',
  license: '',
  openAccess: false,
})

const thesisFields = reactive({
  thesisLevel: '' as '' | 'pregrado' | 'maestria' | 'especializacion' | 'doctorado',
  program: '',
  director: '',
  jurors: '',
  university: '',
  faculty: '',
  degreeGrantor: '',
  degreeName: '',
  areaOfKnowledge: '',
  modality: '' as '' | 'investigacion' | 'monografia' | 'proyecto_aplicado' | 'otro',
  language: '',
  pages: '',
  projectCode: '',
  approvalDate: '',
  repositoryUrl: '',
})

const conferencePaperFields = reactive({
  eventName: '',
  eventCity: '',
  eventCountry: '',
  eventDate: '',
  presentationType: '' as '' | 'oral' | 'poster' | 'workshop' | 'keynote',
  isbn: '',
  conferenceAcronym: '',
  conferenceNumber: '',
  proceedingsTitle: '',
  publisher: '',
  pages: '',
  eventSponsor: '',
  areaOfKnowledge: '',
  language: '',
})

const certificateFields = reactive({
  issuingEntity: '',
  certificateType: '' as '' | 'participacion' | 'ponente' | 'asistencia' | 'instructor' | 'otro',
  relatedEvent: '',
  issueDate: '',
  expirationDate: '',
  hours: '',
  location: '',
  modality: '' as '' | 'presencial' | 'virtual' | 'hibrida',
  areaOfKnowledge: '',
  projectCode: '',
})

const researchProjectFields = reactive({
  projectCode: '',
  fundingSource: '',
  startDate: '',
  endDate: '',
  projectStatus: '' as '' | 'active' | 'completed' | 'suspended',
  coResearchers: '',
  principalInvestigatorName: '',
  institution: '',
  programOrCall: '',
  areaOfKnowledge: '',
  keywords: '',
  budget: '',
})

const bookFields = reactive({
  bookPublisher: '',
  bookIsbn: '',
  bookEdition: '',
  bookCity: '',
  bookCollection: '',
  bookTotalPages: '',
  bookLanguage: '',
  bookPublicationDate: '',
})

const bookChapterFields = reactive({
  chapterBookTitle: '',
  chapterNumber: '',
  chapterPages: '',
  chapterEditors: '',
  chapterPublisher: '',
  chapterIsbn: '',
  chapterEdition: '',
  chapterLanguage: '',
  chapterPublicationDate: '',
})

const technicalReportFields = reactive({
  reportNumber: '',
  reportInstitution: '',
  reportType: '' as '' | 'final' | 'interim' | 'white_paper' | 'manual' | 'other',
  reportSponsor: '',
  reportPublicationDate: '',
  reportRevision: '',
  reportPages: '',
  reportRepositoryUrl: '',
  reportAreaOfKnowledge: '',
  reportLanguage: '',
})

const softwareFields = reactive({
  softwareVersion: '',
  softwareReleaseDate: '',
  softwareRepositoryUrl: '',
  softwareLicense: '',
  softwareProgrammingLanguage: '',
  softwarePlatform: '',
  softwareType: '' as '' | 'desktop' | 'web' | 'mobile' | 'library' | 'other',
  softwareRegistrationNumber: '',
})

const patentFields = reactive({
  patentOffice: '',
  patentApplicationNumber: '',
  patentPublicationNumber: '',
  patentApplicationDate: '',
  patentPublicationDate: '',
  patentGrantDate: '',
  patentStatus: '' as '' | 'submitted' | 'published' | 'granted' | 'expired',
  patentAssignee: '',
  patentInventors: '',
  patentCountry: '',
  patentClassification: '',
})

const subtypeFieldsByProductType = {
  article: articleFields,
  thesis: thesisFields,
  conference_paper: conferencePaperFields,
  certificate: certificateFields,
  research_project: researchProjectFields,
  book: bookFields,
  book_chapter: bookChapterFields,
  technical_report: technicalReportFields,
  software: softwareFields,
  patent: patentFields,
} as const

const specificFieldsByProductType = computed(() =>
  PRODUCT_METADATA_LAYOUT[selectedProductType.value].filter(
    (field) => field.group !== 'Campos generales',
  ),
)

const groupedSpecificFields = computed(() => {
  const grouped = new Map<string, MetadataFieldConfig[]>()

  specificFieldsByProductType.value.forEach((field) => {
    const current = grouped.get(field.group) ?? []
    current.push(field)
    grouped.set(field.group, current)
  })

  return Array.from(grouped.entries()).map(([group, fields]) => ({ group, fields }))
})

function toSupportedSubtypeProductType(value: ProductType): SupportedSubtypeProductType {
  return value as SupportedSubtypeProductType
}

function getSubtypeFieldName(field: MetadataFieldConfig) {
  return `${selectedProductType.value}-${field.id}`
}

function getSubtypeFieldValue(field: MetadataFieldConfig): string | boolean {
  const productType = toSupportedSubtypeProductType(selectedProductType.value)
  const subtypeFields = subtypeFieldsByProductType[productType] as Record<string, unknown>
  const currentValue = subtypeFields[field.id]

  if (field.control === 'switch') {
    return Boolean(currentValue)
  }

  return typeof currentValue === 'string' ? currentValue : ''
}

function setSubtypeFieldValue(field: MetadataFieldConfig, value: string | boolean) {
  const productType = toSupportedSubtypeProductType(selectedProductType.value)
  const subtypeFields = subtypeFieldsByProductType[productType] as Record<string, unknown>

  subtypeFields[field.id] = field.control === 'switch' ? Boolean(value) : String(value ?? '')
}

function getFieldClass(field: MetadataFieldConfig) {
  return field.control === 'textarea' ? 'sm:col-span-2' : ''
}

function splitMultivalue(value: string): string[] | undefined {
  if (value.trim().length === 0) {
    return undefined
  }

  return value
    .split(/,|\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function toIsoDate(value: string): string | undefined {
  if (!value) {
    return undefined
  }

  return new Date(value).toISOString()
}

function toNumberValue(value: string): number | undefined {
  if (!value) {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function buildSubtypeUpdatePayload(): Partial<UpdateAcademicProductDTO> {
  if (selectedProductType.value === 'article') {
    return {
      article: {
        journalName: articleFields.journalName || undefined,
        volume: articleFields.volume || undefined,
        issue: articleFields.issue || undefined,
        pages: articleFields.pages || undefined,
        issn: articleFields.issn || undefined,
        indexing: splitMultivalue(articleFields.indexing),
        openAccess: articleFields.openAccess,
        articleType: articleFields.articleType || undefined,
        journalCountry: articleFields.journalCountry || undefined,
        journalAbbreviation: articleFields.journalAbbreviation || undefined,
        publisher: articleFields.publisher || undefined,
        areaOfKnowledge: articleFields.areaOfKnowledge || undefined,
        language: articleFields.language || undefined,
        license: articleFields.license || undefined,
      },
    }
  }

  if (selectedProductType.value === 'thesis') {
    return {
      thesis: {
        thesisLevel: thesisFields.thesisLevel || undefined,
        director: thesisFields.director || undefined,
        university: thesisFields.university || undefined,
        faculty: thesisFields.faculty || undefined,
        approvalDate: toIsoDate(thesisFields.approvalDate),
        repositoryUrl: thesisFields.repositoryUrl || undefined,
        program: thesisFields.program || undefined,
        jurors: splitMultivalue(thesisFields.jurors),
        degreeGrantor: thesisFields.degreeGrantor || undefined,
        degreeName: thesisFields.degreeName || undefined,
        areaOfKnowledge: thesisFields.areaOfKnowledge || undefined,
        modality: thesisFields.modality || undefined,
        language: thesisFields.language || undefined,
        pages: toNumberValue(thesisFields.pages),
        projectCode: thesisFields.projectCode || undefined,
      },
    }
  }

  if (selectedProductType.value === 'conference_paper') {
    return {
      conferencePaper: {
        eventName: conferencePaperFields.eventName || undefined,
        eventCity: conferencePaperFields.eventCity || undefined,
        eventCountry: conferencePaperFields.eventCountry || undefined,
        eventDate: toIsoDate(conferencePaperFields.eventDate),
        presentationType: conferencePaperFields.presentationType || undefined,
        isbn: conferencePaperFields.isbn || undefined,
        conferenceAcronym: conferencePaperFields.conferenceAcronym || undefined,
        conferenceNumber: conferencePaperFields.conferenceNumber || undefined,
        proceedingsTitle: conferencePaperFields.proceedingsTitle || undefined,
        publisher: conferencePaperFields.publisher || undefined,
        pages: conferencePaperFields.pages || undefined,
        eventSponsor: conferencePaperFields.eventSponsor || undefined,
        areaOfKnowledge: conferencePaperFields.areaOfKnowledge || undefined,
        language: conferencePaperFields.language || undefined,
      },
    }
  }

  if (selectedProductType.value === 'certificate') {
    return {
      certificate: {
        issuingEntity: certificateFields.issuingEntity || undefined,
        certificateType: certificateFields.certificateType || undefined,
        relatedEvent: certificateFields.relatedEvent || undefined,
        issueDate: toIsoDate(certificateFields.issueDate),
        expirationDate: toIsoDate(certificateFields.expirationDate),
        hours: toNumberValue(certificateFields.hours),
        location: certificateFields.location || undefined,
        modality: certificateFields.modality || undefined,
        areaOfKnowledge: certificateFields.areaOfKnowledge || undefined,
        projectCode: certificateFields.projectCode || undefined,
      },
    }
  }

  if (selectedProductType.value === 'research_project') {
    return {
      researchProject: {
        projectCode: researchProjectFields.projectCode || undefined,
        fundingSource: researchProjectFields.fundingSource || undefined,
        startDate: toIsoDate(researchProjectFields.startDate),
        endDate: toIsoDate(researchProjectFields.endDate),
        projectStatus: researchProjectFields.projectStatus || undefined,
        coResearchers: splitMultivalue(researchProjectFields.coResearchers),
        principalInvestigatorName: researchProjectFields.principalInvestigatorName || undefined,
        institution: researchProjectFields.institution || undefined,
        programOrCall: researchProjectFields.programOrCall || undefined,
        areaOfKnowledge: researchProjectFields.areaOfKnowledge || undefined,
        keywords: splitMultivalue(researchProjectFields.keywords),
        budget: toNumberValue(researchProjectFields.budget),
      },
    }
  }

  if (selectedProductType.value === 'book') {
    return {
      book: {
        bookPublisher: bookFields.bookPublisher || undefined,
        bookIsbn: bookFields.bookIsbn || undefined,
        bookEdition: bookFields.bookEdition || undefined,
        bookCity: bookFields.bookCity || undefined,
        bookCollection: bookFields.bookCollection || undefined,
        bookTotalPages: toNumberValue(bookFields.bookTotalPages),
        bookLanguage: bookFields.bookLanguage || undefined,
        bookPublicationDate: toIsoDate(bookFields.bookPublicationDate),
      },
    }
  }

  if (selectedProductType.value === 'book_chapter') {
    return {
      bookChapter: {
        chapterBookTitle: bookChapterFields.chapterBookTitle || undefined,
        chapterNumber: bookChapterFields.chapterNumber || undefined,
        chapterPages: bookChapterFields.chapterPages || undefined,
        chapterEditors: splitMultivalue(bookChapterFields.chapterEditors),
        chapterPublisher: bookChapterFields.chapterPublisher || undefined,
        chapterIsbn: bookChapterFields.chapterIsbn || undefined,
        chapterEdition: bookChapterFields.chapterEdition || undefined,
        chapterLanguage: bookChapterFields.chapterLanguage || undefined,
        chapterPublicationDate: toIsoDate(bookChapterFields.chapterPublicationDate),
      },
    }
  }

  if (selectedProductType.value === 'technical_report') {
    return {
      technicalReport: {
        reportNumber: technicalReportFields.reportNumber || undefined,
        reportInstitution: technicalReportFields.reportInstitution || undefined,
        reportType: technicalReportFields.reportType || undefined,
        reportSponsor: technicalReportFields.reportSponsor || undefined,
        reportPublicationDate: toIsoDate(technicalReportFields.reportPublicationDate),
        reportRevision: technicalReportFields.reportRevision || undefined,
        reportPages: toNumberValue(technicalReportFields.reportPages),
        reportRepositoryUrl: technicalReportFields.reportRepositoryUrl || undefined,
        reportAreaOfKnowledge: technicalReportFields.reportAreaOfKnowledge || undefined,
        reportLanguage: technicalReportFields.reportLanguage || undefined,
      },
    }
  }

  if (selectedProductType.value === 'software') {
    return {
      software: {
        softwareVersion: softwareFields.softwareVersion || undefined,
        softwareReleaseDate: toIsoDate(softwareFields.softwareReleaseDate),
        softwareRepositoryUrl: softwareFields.softwareRepositoryUrl || undefined,
        softwareLicense: softwareFields.softwareLicense || undefined,
        softwareProgrammingLanguage: softwareFields.softwareProgrammingLanguage || undefined,
        softwarePlatform: softwareFields.softwarePlatform || undefined,
        softwareType: softwareFields.softwareType || undefined,
        softwareRegistrationNumber: softwareFields.softwareRegistrationNumber || undefined,
      },
    }
  }

  return {
    patent: {
      patentOffice: patentFields.patentOffice || undefined,
      patentApplicationNumber: patentFields.patentApplicationNumber || undefined,
      patentPublicationNumber: patentFields.patentPublicationNumber || undefined,
      patentApplicationDate: toIsoDate(patentFields.patentApplicationDate),
      patentPublicationDate: toIsoDate(patentFields.patentPublicationDate),
      patentGrantDate: toIsoDate(patentFields.patentGrantDate),
      patentStatus: patentFields.patentStatus || undefined,
      patentAssignee: patentFields.patentAssignee || undefined,
      patentInventors: splitMultivalue(patentFields.patentInventors),
      patentCountry: patentFields.patentCountry || undefined,
      patentClassification: patentFields.patentClassification || undefined,
    },
  }
}

function hydrateSubtypeFieldsFromProduct() {
  const product = currentProduct.value
  if (!product) {
    return
  }

  if (product.productType === 'article') {
    articleFields.journalName = product.journalName ?? ''
    articleFields.volume = product.volume ?? ''
    articleFields.issue = product.issue ?? ''
    articleFields.pages = product.pages ?? ''
    articleFields.issn = product.issn ?? ''
    articleFields.indexing = (product.indexing ?? []).join(', ')
    articleFields.articleType = (product.articleType as typeof articleFields.articleType) ?? ''
    articleFields.journalCountry = product.journalCountry ?? ''
    articleFields.journalAbbreviation = product.journalAbbreviation ?? ''
    articleFields.publisher = product.publisher ?? ''
    articleFields.areaOfKnowledge = product.areaOfKnowledge ?? ''
    articleFields.language = product.language ?? ''
    articleFields.license = product.license ?? ''
    articleFields.openAccess = product.openAccess ?? false
  }

  if (product.productType === 'thesis') {
    thesisFields.thesisLevel = (product.thesisLevel as typeof thesisFields.thesisLevel) ?? ''
    thesisFields.program = product.program ?? ''
    thesisFields.director = product.director ?? ''
    thesisFields.jurors = (product.jurors ?? []).join(', ')
    thesisFields.university = product.university ?? ''
    thesisFields.faculty = product.faculty ?? ''
    thesisFields.degreeGrantor = product.degreeGrantor ?? ''
    thesisFields.degreeName = product.degreeName ?? ''
    thesisFields.areaOfKnowledge = product.thesisAreaOfKnowledge ?? product.areaOfKnowledge ?? ''
    thesisFields.modality = (product.thesisModality ?? '') as typeof thesisFields.modality
    thesisFields.language = product.thesisLanguage ?? product.language ?? ''
    thesisFields.pages = product.thesisPages ?? product.pages ?? ''
    thesisFields.projectCode = product.projectCode ?? ''
    thesisFields.approvalDate = product.approvalDate ? product.approvalDate.slice(0, 10) : ''
    thesisFields.repositoryUrl = product.repositoryUrl ?? ''
  }

  if (product.productType === 'conference_paper') {
    conferencePaperFields.eventName = product.eventName ?? ''
    conferencePaperFields.eventCity = product.eventCity ?? ''
    conferencePaperFields.eventCountry = product.eventCountry ?? ''
    conferencePaperFields.eventDate = product.eventDate ? product.eventDate.slice(0, 10) : ''
    conferencePaperFields.presentationType =
      (product.presentationType as typeof conferencePaperFields.presentationType) ?? ''
    conferencePaperFields.isbn = product.isbn ?? ''
    conferencePaperFields.conferenceAcronym = product.conferenceAcronym ?? ''
    conferencePaperFields.conferenceNumber = product.conferenceNumber ?? ''
    conferencePaperFields.proceedingsTitle = product.proceedingsTitle ?? ''
    conferencePaperFields.publisher = product.publisher ?? ''
    conferencePaperFields.pages = product.conferencePages ?? product.pages ?? ''
    conferencePaperFields.eventSponsor = product.eventSponsor ?? ''
    conferencePaperFields.areaOfKnowledge =
      product.conferenceAreaOfKnowledge ?? product.areaOfKnowledge ?? ''
    conferencePaperFields.language = product.conferenceLanguage ?? product.language ?? ''
  }

  if (product.productType === 'certificate') {
    certificateFields.issuingEntity = product.issuingEntity ?? ''
    certificateFields.certificateType =
      (product.certificateType as typeof certificateFields.certificateType) ?? ''
    certificateFields.relatedEvent = product.relatedEvent ?? ''
    certificateFields.issueDate = product.issueDate ? product.issueDate.slice(0, 10) : ''
    certificateFields.expirationDate = product.expirationDate
      ? product.expirationDate.slice(0, 10)
      : ''
    certificateFields.hours =
      typeof product.hours === 'number' && Number.isFinite(product.hours)
        ? String(product.hours)
        : ''
    certificateFields.location = product.location ?? ''
    certificateFields.modality =
      (product.certificateModality as typeof certificateFields.modality) ?? ''
    certificateFields.areaOfKnowledge = product.certificateAreaOfKnowledge ?? ''
    certificateFields.projectCode = product.projectCode ?? ''
  }

  if (product.productType === 'research_project') {
    researchProjectFields.projectCode = product.projectCode ?? ''
    researchProjectFields.fundingSource = product.fundingSource ?? ''
    researchProjectFields.startDate = product.startDate ? product.startDate.slice(0, 10) : ''
    researchProjectFields.endDate = product.endDate ? product.endDate.slice(0, 10) : ''
    researchProjectFields.projectStatus =
      (product.projectStatus as typeof researchProjectFields.projectStatus) ?? ''
    researchProjectFields.coResearchers = (product.coResearchers ?? []).join(', ')
    researchProjectFields.principalInvestigatorName = product.principalInvestigatorName ?? ''
    researchProjectFields.institution = product.researchProjectInstitution ?? ''
    researchProjectFields.programOrCall = product.programOrCall ?? ''
    researchProjectFields.areaOfKnowledge = product.researchProjectAreaOfKnowledge ?? ''
    researchProjectFields.keywords = (product.researchProjectKeywords ?? []).join(', ')
    researchProjectFields.budget =
      typeof product.budget === 'number' && Number.isFinite(product.budget)
        ? String(product.budget)
        : ''
  }

  if (product.productType === 'book') {
    bookFields.bookPublisher = product.bookPublisher ?? ''
    bookFields.bookIsbn = product.bookIsbn ?? ''
    bookFields.bookEdition = product.bookEdition ?? ''
    bookFields.bookCity = product.bookCity ?? ''
    bookFields.bookCollection = product.bookCollection ?? ''
    bookFields.bookTotalPages =
      typeof product.bookTotalPages === 'number' && Number.isFinite(product.bookTotalPages)
        ? String(product.bookTotalPages)
        : ''
    bookFields.bookLanguage = product.bookLanguage ?? ''
    bookFields.bookPublicationDate = product.bookPublicationDate
      ? product.bookPublicationDate.slice(0, 10)
      : ''
  }

  if (product.productType === 'book_chapter') {
    bookChapterFields.chapterBookTitle = product.chapterBookTitle ?? ''
    bookChapterFields.chapterNumber = product.chapterNumber ?? ''
    bookChapterFields.chapterPages = product.chapterPages ?? ''
    bookChapterFields.chapterEditors = (product.chapterEditors ?? []).join(', ')
    bookChapterFields.chapterPublisher = product.chapterPublisher ?? ''
    bookChapterFields.chapterIsbn = product.chapterIsbn ?? ''
    bookChapterFields.chapterEdition = product.chapterEdition ?? ''
    bookChapterFields.chapterLanguage = product.chapterLanguage ?? ''
    bookChapterFields.chapterPublicationDate = product.chapterPublicationDate
      ? product.chapterPublicationDate.slice(0, 10)
      : ''
  }

  if (product.productType === 'technical_report') {
    technicalReportFields.reportNumber = product.reportNumber ?? ''
    technicalReportFields.reportInstitution = product.reportInstitution ?? ''
    technicalReportFields.reportType =
      (product.reportType as typeof technicalReportFields.reportType) ?? ''
    technicalReportFields.reportSponsor = product.reportSponsor ?? ''
    technicalReportFields.reportPublicationDate = product.reportPublicationDate
      ? product.reportPublicationDate.slice(0, 10)
      : ''
    technicalReportFields.reportRevision = product.reportRevision ?? ''
    technicalReportFields.reportPages =
      typeof product.reportPages === 'number' && Number.isFinite(product.reportPages)
        ? String(product.reportPages)
        : ''
    technicalReportFields.reportRepositoryUrl = product.reportRepositoryUrl ?? ''
    technicalReportFields.reportAreaOfKnowledge = product.reportAreaOfKnowledge ?? ''
    technicalReportFields.reportLanguage = product.reportLanguage ?? ''
  }

  if (product.productType === 'software') {
    softwareFields.softwareVersion = product.softwareVersion ?? ''
    softwareFields.softwareReleaseDate = product.softwareReleaseDate
      ? product.softwareReleaseDate.slice(0, 10)
      : ''
    softwareFields.softwareRepositoryUrl = product.softwareRepositoryUrl ?? ''
    softwareFields.softwareLicense = product.softwareLicense ?? ''
    softwareFields.softwareProgrammingLanguage = product.softwareProgrammingLanguage ?? ''
    softwareFields.softwarePlatform = product.softwarePlatform ?? ''
    softwareFields.softwareType = (product.softwareType as typeof softwareFields.softwareType) ?? ''
    softwareFields.softwareRegistrationNumber = product.softwareRegistrationNumber ?? ''
  }

  if (product.productType === 'patent') {
    patentFields.patentOffice = product.patentOffice ?? ''
    patentFields.patentApplicationNumber = product.patentApplicationNumber ?? ''
    patentFields.patentPublicationNumber = product.patentPublicationNumber ?? ''
    patentFields.patentApplicationDate = product.patentApplicationDate
      ? product.patentApplicationDate.slice(0, 10)
      : ''
    patentFields.patentPublicationDate = product.patentPublicationDate
      ? product.patentPublicationDate.slice(0, 10)
      : ''
    patentFields.patentGrantDate = product.patentGrantDate
      ? product.patentGrantDate.slice(0, 10)
      : ''
    patentFields.patentStatus = (product.patentStatus as typeof patentFields.patentStatus) ?? ''
    patentFields.patentAssignee = product.patentAssignee ?? ''
    patentFields.patentInventors = (product.patentInventors ?? []).join(', ')
    patentFields.patentCountry = product.patentCountry ?? ''
    patentFields.patentClassification = product.patentClassification ?? ''
  }
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatConfidence(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'No disponible'
  }

  return `${Math.round(value * 100)}%`
}

function formatDuration(durationMs: number | null) {
  if (!durationMs || durationMs < 0) {
    return 'No disponible'
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`
  }

  const seconds = durationMs / 1000

  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return `${minutes} min ${remainingSeconds}s`
}

function formatNerAttemptTrace(trace: NerAttemptTraceEntry[] | undefined) {
  if (!trace?.length) {
    return 'No disponible'
  }

  return trace
    .map((entry) => {
      const passLabel = entry.scope === 'extraction_second_pass' ? 'pass2' : 'pass1'
      const statusLabel =
        entry.status === 'succeeded' ? 'ok' : `fallo${entry.errorType ? `:${entry.errorType}` : ''}`
      const compactErrorMessage = entry.errorMessage
        ? entry.errorMessage.replace(/\s+/g, ' ').slice(0, 120)
        : ''

      return `${passLabel}#${entry.attempt} ${entry.modelId} (${entry.provider}) ${statusLabel}${compactErrorMessage ? ` msg:${compactErrorMessage}` : ''}`
    })
    .join(' | ')
}

function formatNerAttemptTraceVerbose(trace: NerAttemptTraceEntry[] | undefined) {
  if (!trace?.length) {
    return ''
  }

  return trace
    .map((entry) => {
      const passLabel = entry.scope === 'extraction_second_pass' ? 'pass2' : 'pass1'
      const head = `[${passLabel}] #${entry.attempt} ${entry.provider} · ${entry.modelId} · ${entry.status} · ${entry.durationMs}ms`
      const errType = entry.errorType ? `\n  errorType: ${entry.errorType}` : ''
      const errMsg = entry.errorMessage
        ? `\n  errorMessage: ${entry.errorMessage.replace(/\s+/g, ' ').slice(0, 500)}`
        : ''
      return `${head}${errType}${errMsg}`
    })
    .join('\n\n')
}

function formatNerAttemptTraceJson(trace: NerAttemptTraceEntry[] | undefined) {
  if (!trace?.length) {
    return ''
  }

  try {
    return JSON.stringify(trace, null, 2)
  } catch {
    return ''
  }
}

function toTimestamp(value?: string) {
  if (!value) {
    return null
  }

  const resolved = new Date(value).getTime()
  return Number.isNaN(resolved) ? null : resolved
}

function scheduleHighlightRemoval(id: string) {
  const timer = setTimeout(() => {
    analysisHighlights.value = analysisHighlights.value.filter((highlight) => highlight.id !== id)
    highlightRemovalTimers = highlightRemovalTimers.filter((entry) => entry !== timer)
  }, ANALYSIS_HIGHLIGHT_EXIT_DELAY_MS)

  highlightRemovalTimers.push(timer)
}

function trimAnalysisHighlights() {
  const visibleHighlights = analysisHighlights.value.filter((highlight) => !highlight.leaving)

  if (visibleHighlights.length <= MAX_VISIBLE_ANALYSIS_HIGHLIGHTS) {
    return
  }

  const overflowHighlights = visibleHighlights.slice(MAX_VISIBLE_ANALYSIS_HIGHLIGHTS)

  if (!overflowHighlights.length) {
    return
  }

  const overflowIds = new Set(overflowHighlights.map((highlight) => highlight.id))

  analysisHighlights.value = analysisHighlights.value.map((highlight) =>
    overflowIds.has(highlight.id) ? { ...highlight, leaving: true } : highlight,
  )

  overflowHighlights.forEach((highlight) => {
    scheduleHighlightRemoval(highlight.id)
  })
}

function pushAnalysisHighlight(message: string) {
  const nextHighlight: AnalysisHighlightItem = {
    id: `analysis-highlight-${highlightSerial++}`,
    message,
    leaving: false,
  }

  analysisHighlights.value = [nextHighlight, ...analysisHighlights.value]
  trimAnalysisHighlights()
}

function getProcessingMessage(index: number) {
  return processingMessages[index] ?? processingMessages[0] ?? 'Estamos preparando tu archivo.'
}

function getNextHighlightMessage(): string {
  const fallbackMessage = processingMessages[0] ?? 'Estamos preparando tu archivo.'

  if (processingMessages.length <= 1) {
    return fallbackMessage
  }

  const recentMessages = analysisHighlights.value
    .filter((highlight) => !highlight.leaving)
    .map((highlight) => highlight.message)

  const availableMessages = processingMessages.filter(
    (message) => !recentMessages.includes(message),
  )

  if (!availableMessages.length) {
    return getProcessingMessage(highlightCursor)
  }

  const randomIndex = Math.floor(Math.random() * availableMessages.length)
  const nextMessage = availableMessages[randomIndex] ?? fallbackMessage
  const resolvedIndex = processingMessages.indexOf(nextMessage)

  if (resolvedIndex >= 0) {
    highlightCursor = resolvedIndex
  }

  return nextMessage
}

function stopProcessingFeedback() {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }

  if (highlightTimer) {
    clearInterval(highlightTimer)
    highlightTimer = null
  }

  highlightRemovalTimers.forEach((timer) => clearTimeout(timer))
  highlightRemovalTimers = []

  analysisHighlights.value = analysisHighlights.value.map((highlight) => ({
    ...highlight,
    leaving: false,
  }))
}

function startProcessingFeedback() {
  if (progressTimer || highlightTimer) {
    return
  }

  if (!analysisHighlights.value.length) {
    pushAnalysisHighlight(getNextHighlightMessage())
  }

  analysisProgress.value = Math.max(12, analysisProgress.value)

  progressTimer = setInterval(() => {
    analysisProgress.value = Math.min(
      92,
      analysisProgress.value + (analysisProgress.value < 48 ? 8 : 4),
    )
  }, 950)

  highlightTimer = setInterval(() => {
    pushAnalysisHighlight(getNextHighlightMessage())
  }, ANALYSIS_HIGHLIGHT_INTERVAL_MS)
}

function resetWorkspaceVisualState() {
  stopProcessingFeedback()
  analysisProgress.value = 0
  analysisHighlights.value = []
  highlightCursor = 0
  highlightSerial = 0
}

async function clearLocalDraft() {
  if (hasPersistedDraft.value || documentsStore.activeUploadId) {
    try {
      await documentsStore.cancelDraft()
      resetWorkspaceVisualState()
      activeHighlightKey.value = null

      toast.add({
        title: 'Archivo eliminado',
        description: 'Se eliminó el archivo pendiente.',
        icon: 'i-lucide-trash-2',
        color: 'success',
      })
    } catch (error) {
      toast.add({
        title: 'No pudimos quitar este archivo',
        description:
          error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
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
      title: 'Primero termina este archivo',
      description: 'Para cargar otro, guarda o cancela el que ya tienes en revisión.',
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
    const draft = await documentsStore.loadCurrentDraft()

    if (draft) {
      analysisProgress.value = 100
      pushAnalysisHighlight('Retomamos tu revisión para que continúes donde la dejaste.')
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
    await documentsStore.loadDraftProduct(productId)
    toast.add({
      title: 'Borrador cargado',
      description: 'Puedes revisar los metadatos de esta obra del mismo archivo.',
      icon: 'i-lucide-files',
      color: 'neutral',
    })
  } catch (error) {
    toast.add({
      title: 'No pudimos abrir ese borrador',
      description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
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
    await documentsStore.uploadDocument(currentLocalFile.value, {
      nerForceSingleDocument: uploadForceSingleWork.value,
    })
  } catch (error) {
    if (analysisStartedAt.value) {
      analysisFinishedAt.value = Date.now()
      lastAnalysisDurationMs.value = analysisFinishedAt.value - analysisStartedAt.value
    }

    documentsStore.setWorkspaceStage('draft')
    stopProcessingFeedback()

    toast.add({
      title: 'No pudimos preparar el archivo',
      description:
        error instanceof Error
          ? error.message
          : 'Inténtalo de nuevo en unos segundos o carga otro archivo.',
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
      title: 'Avances guardados',
      description: 'La revisión quedó actualizada para que puedas retomarla después.',
      icon: 'i-lucide-save',
      color: 'success',
    })
  } catch (error) {
    toast.add({
      title: 'No pudimos guardar tus cambios',
      description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
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
      title: 'Documento guardado',
      description: 'La revisión quedó confirmada y ya forma parte de tu información.',
      icon: 'i-lucide-check-circle',
      color: 'success',
    })
  } catch (error) {
    toast.add({
      title: 'No pudimos guardar el resultado',
      description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
      icon: 'i-lucide-octagon-alert',
      color: 'error',
    })
  }
}

function requestCancelFlow() {
  showCancelModal.value = true
}

async function confirmCancelFlow() {
  showCancelModal.value = false

  try {
    await documentsStore.cancelDraft()
    resetWorkspaceVisualState()
    toast.add({
      title: 'Proceso cancelado',
      description: 'El archivo y la revisión pendiente se eliminaron correctamente.',
      icon: 'i-lucide-trash-2',
      color: 'success',
    })
  } catch (error) {
    toast.add({
      title: 'No pudimos cancelar este archivo',
      description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
      icon: 'i-lucide-octagon-alert',
      color: 'error',
    })
  }
}

watch(pendingSelection, handleFileSelection)

watch(
  currentStage,
  (stage) => {
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

  toast.add({
    title: 'No pudimos preparar este archivo',
    description: error,
    icon: 'i-lucide-octagon-alert',
    color: 'error',
  })
})

watch(currentStage, (stage) => {
  if (!['review', 'ready', 'confirmed'].includes(stage)) {
    activeHighlightKey.value = null
  }
})

watch(
  currentProduct,
  () => {
    if (['review', 'ready', 'confirmed'].includes(currentStage.value)) {
      hydrateSubtypeFieldsFromProduct()
    }
  },
  { immediate: true },
)

onMounted(async () => {
  await loadPersistedDraft()
})

onBeforeUnmount(() => {
  stopProcessingFeedback()
})
</script>

<template>
  <div class="space-y-5">
    <section class="panel-surface fade-up px-6 py-6 sm:px-7">
      <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div class="space-y-3">
          <p class="section-chip">Documentos</p>
          <h1 class="max-w-3xl font-display text-3xl font-semibold text-text sm:text-[2.6rem]">
            Revisa tu archivo antes de guardarlo.
          </h1>
          <p class="max-w-2xl text-sm leading-6 text-text-muted sm:text-base">
            Sube un PDF o una imagen, revisa lo que se detectó y corrige lo necesario sin salir de
            esta misma vista.
          </p>
        </div>

        <div class="flex flex-wrap gap-3">
          <SipacButton to="/" icon="i-lucide-arrow-left" color="neutral" variant="soft">
            Volver al inicio
          </SipacButton>
        </div>
      </div>
    </section>

    <section class="top-20 z-20 fade-up stagger-1">
      <div class="panel-surface border-border/70 bg-white/88 px-4 py-3 backdrop-blur-md sm:px-5">
        <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div class="min-w-0">
            <p class="text-[0.72rem] font-semibold tracking-[0.18em] text-text-soft uppercase">
              {{ currentStageCopy.eyebrow }}
            </p>
            <p class="mt-1 text-sm font-semibold text-text sm:text-base">
              {{ currentStageCopy.title }}
            </p>
            <p class="mt-1 text-sm leading-6 text-text-muted">
              {{ currentStageCopy.description }}
            </p>
          </div>

          <div class="flex flex-col gap-3 xl:min-w-152 xl:max-w-2xl xl:flex-1">
            <div class="stage-progress-rail hidden xl:block">
              <div class="stage-progress-bar" :style="{ width: `${stageProgressPercent}%` }" />
            </div>

            <div class="grid gap-2 sm:grid-cols-3">
              <div
                v-for="(step, index) in stageSteps"
                :key="step.label"
                class="stage-pill"
                :class="{
                  'stage-pill-active': step.active,
                  'stage-pill-complete': step.complete,
                }"
              >
                <span
                  class="signal-dot"
                  :class="{
                    'signal-dot-active': step.active,
                    'signal-dot-complete': step.complete,
                  }"
                >
                  {{ index + 1 }}
                </span>
                <div class="min-w-0">
                  <p class="truncate text-xs font-semibold tracking-[0.12em] text-text uppercase">
                    {{ step.label }}
                  </p>
                  <p class="mt-1 truncate text-sm text-text-muted">{{ step.hint }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section
      class="grid gap-6 lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)]"
    >
      <aside
        class="panel-surface fade-up stagger-2 space-y-4 p-5 sm:p-6 lg:top-28 lg:self-start xl:top-40 xl:self-start"
      >
        <div class="space-y-2">
          <p class="section-chip">Subir archivo</p>
          <h2 class="text-xl font-semibold text-text">Trae tu documento</h2>
          <p class="text-sm leading-6 text-text-muted">
            Si lo adjuntas aquí, lo dejamos listo para revisarlo en esta misma página.
          </p>
        </div>

        <UFileUpload
          v-model="pendingSelection"
          accept="application/pdf,image/png,image/jpeg"
          color="neutral"
          :multiple="false"
          variant="area"
          size="lg"
          layout="list"
          label="Arrastra un PDF o una imagen"
          description="Puedes reemplazar el archivo en cualquier momento."
          :disabled="uploadInputLocked"
          class="w-full"
        />

        <UCheckbox
          v-if="currentStage === 'draft' && currentLocalFile"
          v-model="uploadForceSingleWork"
          label="Tratar como un solo trabajo (no dividir posibles compendios)"
          description="Útil si el PDF mezcla varias ponencias pero solo quieres un borrador."
          class="text-sm"
        />

        <UAlert
          v-if="hasPersistedDraft && !currentLocalFile"
          color="primary"
          variant="subtle"
          icon="i-lucide-history"
          title="Retomamos tu revisión"
          description="Este archivo quedó pendiente y puedes continuar desde aquí sin volver a subirlo."
        />

        <UAlert
          v-if="currentProcessingError"
          color="error"
          variant="subtle"
          icon="i-lucide-octagon-alert"
          title="No pudimos preparar este archivo"
          :description="currentProcessingError"
        />

        <div
          v-if="hasDraft"
          class="rounded-lg border border-border/75 bg-white/88 p-4 shadow-[0_18px_34px_-30px_rgba(17,46,29,0.16)]"
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
            <SipacBadge color="primary" variant="subtle">{{ currentStageCopy.eyebrow }}</SipacBadge>
            <SipacBadge
              v-if="(currentTrackedFile?.sourceWorkCount ?? siblingProductIds.length) > 1"
              color="warning"
              variant="subtle"
            >
              Compendio ·
              {{ currentTrackedFile?.sourceWorkCount ?? siblingProductIds.length }} obras
            </SipacBadge>
          </div>

          <div
            v-if="siblingProductIds.length > 1"
            class="mt-4 rounded-lg border border-dashed border-amber-200/90 bg-amber-50/50 p-3"
          >
            <p class="text-xs font-semibold text-text">Varias obras desde este archivo</p>
            <p class="mt-1 text-xs text-text-muted">
              Cada botón abre el borrador de una obra (título y autores propios).
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
              <SipacButton
                v-for="(pid, idx) in siblingProductIds"
                :key="pid"
                size="xs"
                variant="soft"
                :color="documentsStore.activeAcademicProductId === pid ? 'primary' : 'neutral'"
                @click="openSiblingDraft(pid)"
              >
                Obra {{ idx + 1 }}
              </SipacButton>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-3">
            <SipacButton
              v-if="currentStage === 'draft'"
              icon="i-lucide-play"
              size="sm"
              :loading="documentsStore.uploading"
              @click="startAnalysis"
            >
              Empezar revisión
            </SipacButton>
            <SipacButton
              v-else-if="['review', 'ready'].includes(currentStage)"
              icon="i-lucide-save"
              size="sm"
              color="neutral"
              variant="soft"
              :loading="savingSnapshot || documentsStore.savingDraft"
              @click="saveDraftSnapshot"
            >
              Guardar avances
            </SipacButton>
            <SipacButton
              v-if="currentStage === 'draft'"
              icon="i-lucide-trash-2"
              size="sm"
              color="neutral"
              variant="ghost"
              :loading="documentsStore.cancelingDraft"
              @click="clearLocalDraft"
            >
              Quitar archivo
            </SipacButton>
            <SipacButton
              v-else-if="['review', 'ready'].includes(currentStage)"
              icon="i-lucide-x"
              size="sm"
              color="neutral"
              variant="ghost"
              :loading="documentsStore.cancelingDraft"
              @click="requestCancelFlow"
            >
              Cancelar proceso
            </SipacButton>
            <SipacButton
              v-else-if="currentStage === 'confirmed'"
              icon="i-lucide-plus"
              size="sm"
              color="neutral"
              variant="ghost"
              @click="clearLocalDraft"
            >
              Empezar otro archivo
            </SipacButton>
          </div>
        </div>

        <div v-else class="rounded-lg border border-dashed border-sipac-200 bg-sipac-50/55 p-4">
          <p class="font-semibold text-text">Aún no hay un archivo listo.</p>
          <p class="mt-2 text-sm leading-6 text-text-muted">
            En cuanto adjuntes uno, aparecerá aquí y podrás empezar la revisión.
          </p>
        </div>
      </aside>

      <section class="panel-surface fade-up stagger-3 p-5 sm:p-6 lg:p-7">
        <template v-if="currentStage === 'empty'">
          <div class="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_20rem]">
            <div
              class="panel-muted flex min-h-96 flex-col items-center justify-center px-6 py-8 text-center"
            >
              <span
                class="flex size-16 items-center justify-center rounded-3xl bg-sipac-50 text-sipac-700"
              >
                <UIcon name="i-lucide-folder-search" class="size-7" aria-hidden="true" />
              </span>
              <h2 class="mt-5 font-display text-3xl font-semibold text-text">
                {{
                  hydratingWorkspace
                    ? 'Estamos buscando si dejaste algo pendiente.'
                    : 'Aquí aparecerá tu revisión.'
                }}
              </h2>
              <p class="mt-3 max-w-xl text-sm leading-7 text-text-muted sm:text-base">
                {{
                  hydratingWorkspace
                    ? 'Si ya tenías un archivo listo para revisar, lo cargaremos aquí automáticamente.'
                    : 'Verás la vista previa del archivo, los datos encontrados y la ficha editable en el mismo lugar.'
                }}
              </p>
            </div>

            <div
              class="rounded-lg border border-border/75 bg-white/88 p-4 shadow-[0_18px_34px_-30px_rgba(17,46,29,0.14)]"
            >
              <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
                Qué verás aquí
              </p>
              <div class="mt-4 space-y-3">
                <div class="rounded-[1rem] border border-border/70 bg-surface-muted/80 p-3">
                  <p class="font-semibold text-text">Vista previa</p>
                  <p class="mt-1 text-sm leading-6 text-text-muted">
                    Para confirmar que el archivo correcto es el que quedó cargado.
                  </p>
                </div>
                <div class="rounded-[1rem] border border-border/70 bg-surface-muted/80 p-3">
                  <p class="font-semibold text-text">Datos detectados</p>
                  <p class="mt-1 text-sm leading-6 text-text-muted">
                    Iremos viendo título, fecha, autores o referencias a medida que aparezcan.
                  </p>
                </div>
                <div class="rounded-[1rem] border border-border/70 bg-surface-muted/80 p-3">
                  <p class="font-semibold text-text">Corrección final</p>
                  <p class="mt-1 text-sm leading-6 text-text-muted">
                    Podrás editar antes de dejar todo listo para guardar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="currentStage === 'draft'">
          <div
            class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_22rem]"
          >
            <div class="panel-muted p-3 sm:p-4">
              <DocumentPreviewWithHighlights
                :preview-url="currentPreviewUrl"
                :mime-type="currentMimeType"
                :groups="[]"
                :active-key="null"
                @preview-expand="openExpandedPreview"
              />
            </div>

            <div class="space-y-3">
              <div
                class="rounded-lg border border-border/75 bg-white/88 p-4 shadow-[0_18px_34px_-30px_rgba(17,46,29,0.14)]"
              >
                <p class="font-semibold text-text">Todo listo para empezar.</p>
                <p class="mt-2 text-sm leading-6 text-text-muted">
                  Comprueba el archivo y pulsa el botón de revisión cuando quieras ver la primera
                  ficha.
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

        <template v-else-if="currentStage === 'analyzing'">
          <div
            class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_25rem] xl:items-start"
          >
            <div class="panel-muted p-3 sm:p-4 lg:p-5">
              <DocumentPreviewWithHighlights
                :preview-url="currentPreviewUrl"
                :mime-type="currentMimeType"
                :groups="[]"
                :active-key="null"
                @preview-expand="openExpandedPreview"
              />

              <div class="mt-4 rounded-[1rem] border border-border/70 bg-white/82 px-4 py-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="text-sm font-semibold text-text">Vista previa activa</p>
                  <p class="text-xs font-semibold tracking-[0.14em] text-text-soft uppercase">
                    Revisión guiada
                  </p>
                </div>
                <p class="mt-2 text-sm leading-6 text-text-muted">
                  Mantén el archivo a la vista mientras preparamos una ficha clara para revisar sin
                  perder el contexto.
                </p>
              </div>
            </div>

            <div class="space-y-5" aria-live="polite">
              <div
                class="rounded-[1.35rem] border border-sipac-200 bg-sipac-50/72 p-5 shadow-[0_20px_40px_-34px_rgba(17,46,29,0.2)]"
              >
                <div class="flex items-start gap-3">
                  <span class="loader-orbit mt-0.5" aria-hidden="true">
                    <span class="loader-orbit-dot" />
                  </span>

                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <p class="font-semibold text-text">Preparando tu ficha…</p>
                      <p class="analysis-meter text-sm font-semibold text-sipac-700">
                        {{ analysisProgress }}%
                      </p>
                    </div>
                    <p class="mt-2 text-sm leading-6 text-text-muted">
                      Mantenemos la vista previa disponible mientras terminamos la primera versión
                      para corregir.
                    </p>
                    <div class="mt-4 analysis-pulse-track" aria-hidden="true">
                      <div
                        class="analysis-pulse-bar"
                        :style="{ width: `${Math.max(18, analysisProgress)}%` }"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div
                class="analysis-highlights-shell"
                :style="{
                  '--analysis-highlights-capacity': String(MAX_VISIBLE_ANALYSIS_HIGHLIGHTS),
                }"
              >
                <TransitionGroup
                  name="analysis-highlight"
                  tag="div"
                  class="analysis-highlights-list"
                >
                  <article
                    v-for="highlight in analysisHighlights"
                    :key="highlight.id"
                    class="analysis-highlight-card rounded-[1.1rem] border border-border/75 bg-white/88 px-4 py-4 shadow-[0_18px_34px_-30px_rgba(17,46,29,0.14)]"
                    :class="{
                      'analysis-highlight-card-leaving': highlight.leaving,
                    }"
                  >
                    <div class="flex items-start gap-3">
                      <span class="analysis-step-dot" aria-hidden="true" />
                      <p class="min-w-0 text-sm leading-6 text-text-muted">
                        {{ highlight.message }}
                      </p>
                    </div>
                  </article>
                </TransitionGroup>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <div
            class="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]"
          >
            <div class="space-y-4">
              <div class="panel-muted p-3 sm:p-4">
                <DocumentPreviewWithHighlights
                  :preview-url="currentPreviewUrl"
                  :mime-type="currentMimeType"
                  :groups="highlightGroups"
                  :active-key="activeHighlightKey"
                  @highlight-click="focusFieldFromHighlight"
                  @preview-expand="openExpandedPreview"
                />
              </div>

              <div
                class="rounded-lg border border-border/75 bg-white/88 p-4 shadow-[0_18px_34px_-30px_rgba(17,46,29,0.14)]"
              >
                <p class="font-semibold text-text">Lo que ya encontramos</p>
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
                <p
                  v-if="!hasActiveHighlights"
                  class="mt-3 text-xs font-semibold text-text-soft uppercase"
                >
                  Sin coordenadas disponibles en este documento
                </p>
                <p class="mt-3 text-sm leading-6 text-text-muted">
                  {{
                    isImageDraft
                      ? 'Como se trata de una imagen, dejamos la revisión resumida para que confirmes todo más rápido.'
                      : 'La vista previa se mantiene cerca de la ficha para que compares el contenido mientras corriges.'
                  }}
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

            <div class="space-y-4">
              <div
                class="rounded-lg border border-border/75 bg-white/88 p-4 shadow-[0_18px_34px_-30px_rgba(17,46,29,0.14)]"
              >
                <p class="font-semibold text-text">
                  {{
                    currentStage === 'ready'
                      ? 'Haz una última comprobación.'
                      : currentStage === 'confirmed'
                        ? 'Todo quedó guardado.'
                        : 'Corrige lo que haga falta.'
                  }}
                </p>
                <p class="mt-2 text-sm leading-6 text-text-muted">
                  {{
                    currentStage === 'confirmed'
                      ? 'Si quieres seguir con otro archivo, puedes hacerlo desde aquí mismo.'
                      : currentStage === 'ready'
                        ? 'La información ya quedó lo bastante clara para guardarse.'
                        : 'Todavía podrían aparecer detalles menores, pero ya puedes editar la ficha con tranquilidad.'
                  }}
                </p>
              </div>

              <div v-if="currentStage !== 'confirmed'" class="panel-muted p-4 sm:p-5">
                <div class="grid gap-4 sm:grid-cols-2">
                  <UFormField label="Tipo de producto" name="productTypeEditable">
                    <USelect
                      v-model="selectedProductType"
                      :items="productTypeOptions"
                      color="neutral"
                      variant="outline"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField label="Año" name="year">
                    <UInput
                      v-model="yearInput"
                      color="neutral"
                      variant="outline"
                      name="year"
                      inputmode="numeric"
                      placeholder="2026…"
                      class="w-full"
                      @focus="setActiveHighlight('year')"
                    />
                  </UFormField>

                  <UFormField label="Título" name="title" class="sm:col-span-2">
                    <UInput
                      v-model="titleInput"
                      color="neutral"
                      variant="outline"
                      name="title"
                      autocomplete="off"
                      placeholder="Título del documento…"
                      class="w-full"
                      @focus="setActiveHighlight('title')"
                    />
                  </UFormField>

                  <UFormField label="Autores" name="authors" class="sm:col-span-2">
                    <UTextarea
                      v-model="authorsInput"
                      color="neutral"
                      variant="outline"
                      name="authors"
                      autocomplete="off"
                      :rows="3"
                      placeholder="Separa cada autor con coma o salto de línea…"
                      class="w-full"
                      @focus="setActiveHighlight('authors')"
                    />
                  </UFormField>

                  <UFormField label="Institución" name="institution">
                    <UInput
                      v-model="institutionInput"
                      color="neutral"
                      variant="outline"
                      name="institution"
                      autocomplete="organization"
                      placeholder="Universidad de Córdoba…"
                      class="w-full"
                      @focus="setActiveHighlight('institution')"
                    />
                  </UFormField>

                  <UFormField label="DOI o referencia" name="doi">
                    <UInput
                      v-model="doiInput"
                      color="neutral"
                      variant="outline"
                      name="doi"
                      autocomplete="off"
                      inputmode="url"
                      placeholder="10.123/ejemplo.2025.001…"
                      class="w-full"
                      @focus="setActiveHighlight('doi')"
                    />
                  </UFormField>

                  <UFormField label="Palabras clave" name="keywords" class="sm:col-span-2">
                    <UTextarea
                      v-model="keywordsInput"
                      color="neutral"
                      variant="outline"
                      name="keywords"
                      autocomplete="off"
                      :rows="2"
                      placeholder="innovación educativa, investigación, universidad…"
                      class="w-full"
                      @focus="setActiveHighlight('keywords')"
                    />
                  </UFormField>

                  <UFormField label="Notas" name="notes" class="sm:col-span-2">
                    <UTextarea
                      v-model="notesInput"
                      color="neutral"
                      variant="outline"
                      name="notes"
                      autocomplete="off"
                      :rows="3"
                      placeholder="Añade una aclaración útil para la revisión final…"
                      class="w-full"
                      @focus="setActiveHighlight(null)"
                    />
                  </UFormField>

                  <template v-if="groupedSpecificFields.length">
                    <div class="sm:col-span-2 h-px bg-border/80" />

                    <template v-for="group in groupedSpecificFields" :key="group.group">
                      <div class="sm:col-span-2 mt-1">
                        <p class="text-xs font-semibold tracking-[0.12em] text-text-soft uppercase">
                          {{ group.group }}
                        </p>
                      </div>

                      <UFormField
                        v-for="field in group.fields"
                        :key="field.id"
                        :label="field.label"
                        :name="getSubtypeFieldName(field)"
                        :class="getFieldClass(field)"
                      >
                        <UTextarea
                          v-if="field.control === 'textarea'"
                          :model-value="String(getSubtypeFieldValue(field))"
                          color="neutral"
                          variant="outline"
                          :name="getSubtypeFieldName(field)"
                          autocomplete="off"
                          :rows="field.rows ?? 2"
                          :placeholder="field.placeholder"
                          class="w-full"
                          @update:model-value="setSubtypeFieldValue(field, $event)"
                        />

                        <USelect
                          v-else-if="field.control === 'select'"
                          :model-value="String(getSubtypeFieldValue(field))"
                          :items="field.options ?? []"
                          color="neutral"
                          variant="outline"
                          class="w-full"
                          @update:model-value="setSubtypeFieldValue(field, $event)"
                        />

                        <USwitch
                          v-else-if="field.control === 'switch'"
                          :model-value="Boolean(getSubtypeFieldValue(field))"
                          color="primary"
                          :name="getSubtypeFieldName(field)"
                          @update:model-value="setSubtypeFieldValue(field, $event)"
                        />

                        <UInput
                          v-else
                          :model-value="String(getSubtypeFieldValue(field))"
                          color="neutral"
                          variant="outline"
                          :name="getSubtypeFieldName(field)"
                          :type="
                            field.control === 'date'
                              ? 'date'
                              : field.control === 'number'
                                ? 'number'
                                : 'text'
                          "
                          :inputmode="field.control === 'number' ? 'numeric' : undefined"
                          :placeholder="field.placeholder"
                          class="w-full"
                          @update:model-value="setSubtypeFieldValue(field, $event)"
                        />
                      </UFormField>
                    </template>
                  </template>
                </div>
              </div>

              <div
                v-else
                class="rounded-lg border border-sipac-200 bg-sipac-50/85 p-4 shadow-[0_18px_34px_-30px_rgba(17,46,29,0.14)]"
              >
                <div class="flex items-start gap-3">
                  <span
                    class="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sipac-100 text-sipac-700"
                  >
                    <UIcon name="i-lucide-check-circle" class="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p class="font-semibold text-text">La revisión quedó confirmada.</p>
                    <p class="mt-1 text-sm leading-6 text-text-muted">
                      Tu documento ya está guardado. Puedes empezar otro archivo cuando quieras.
                    </p>
                  </div>
                </div>
              </div>

              <div
                v-if="currentStage !== 'confirmed'"
                class="rounded-lg border border-sipac-200 bg-sipac-50/85 p-4 shadow-[0_18px_34px_-30px_rgba(17,46,29,0.14)]"
              >
                <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p class="font-semibold text-text">Guardar resultado</p>
                    <p class="mt-1 text-sm leading-6 text-text-muted">
                      {{
                        canSave
                          ? 'La ficha ya tiene lo necesario para pasar al guardado final.'
                          : 'Completa al menos el título y un autor para habilitar este paso.'
                      }}
                    </p>
                  </div>

                  <div class="flex flex-wrap gap-3">
                    <SipacButton
                      icon="i-lucide-save"
                      size="lg"
                      color="neutral"
                      variant="soft"
                      :loading="savingSnapshot || documentsStore.savingDraft"
                      :disabled="!canSaveSnapshot"
                      @click="saveDraftSnapshot"
                    >
                      Guardar avances
                    </SipacButton>
                    <SipacButton
                      icon="i-lucide-check"
                      size="lg"
                      :loading="documentsStore.savingDraft"
                      :disabled="!canSave"
                      @click="saveWorkspaceResult"
                    >
                      Guardar resultado
                    </SipacButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </section>
    </section>

    <section
      v-if="showTestingMetrics"
      class="panel-surface fade-up border border-amber-200/80 bg-amber-50/80 px-5 py-5 sm:px-6"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-[0.72rem] font-semibold tracking-[0.16em] text-amber-700 uppercase">
            Métricas de prueba
          </p>
          <h2 class="mt-1 text-lg font-semibold text-text">Seguimiento OCR/NER (solo testing)</h2>
          <p class="mt-1 max-w-2xl text-sm leading-6 text-text-muted">
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

    <UModal v-model:open="showCancelModal" title="Cancelar este archivo">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm leading-6 text-text-muted">
            Si cancelas ahora, se eliminarán el archivo y la revisión pendiente asociada. Esta
            acción no se puede deshacer.
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
      title="Vista previa ampliada"
      :ui="{ content: 'max-w-[94vw]' }"
    >
      <template #body>
        <div class="rounded-2xl border border-border/75 bg-surface/90 p-3 sm:p-4">
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
