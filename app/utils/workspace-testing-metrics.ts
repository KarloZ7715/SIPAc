import type { AcademicProductPublic, NerAttemptTraceEntry, ProductType } from '~~/app/types'
import type { TrackedDocument, WorkspaceStage } from '~~/app/stores/documents'
import {
  formatConfidence,
  formatDuration,
  formatFileSize,
  toTimestamp,
} from '~~/app/utils/format-display'
import {
  formatNerAttemptTrace,
  formatNerAttemptTraceJson,
  formatNerAttemptTraceVerbose,
} from '~~/app/utils/ner-attempt-trace-format'

export type WorkspaceTestingMetricItem =
  | { variant: 'card'; label: string; value: string; hint: string }
  | { variant: 'wide'; label: string; body: string; hint: string; mono?: boolean }

export interface WorkspaceTestingMetricsContext {
  tracked: TrackedDocument | null
  product: AcademicProductPublic | undefined
  currentStage: WorkspaceStage
  currentFileName: string
  currentFileSize: number
  currentMimeType: string
  activeUploadId: string | null
  metadataCompletion: { completed: number; total: number; percent: number }
  lastAnalysisDurationMs: number | null
  analysisAttempts: number
  analysisStartedAt: number | null
  selectedProductType: ProductType
}

export function buildWorkspaceTestingMetricsItems(
  ctx: WorkspaceTestingMetricsContext,
): WorkspaceTestingMetricItem[] {
  const tracked = ctx.tracked
  const product = ctx.product
  const entities = product?.extractedEntities
  const uploadId = tracked?._id ?? ctx.activeUploadId ?? '—'
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
      : processingStartMs && ctx.currentStage === 'analyzing'
        ? Date.now() - processingStartMs
        : (ctx.lastAnalysisDurationMs ??
          (ctx.currentStage === 'analyzing' && ctx.analysisStartedAt
            ? Date.now() - ctx.analysisStartedAt
            : null))
  const ocrDurationMs =
    processingStartMs && ocrCompletedMs ? Math.max(0, ocrCompletedMs - processingStartMs) : null
  const nerDurationMs =
    nerStartedMs && processingCompletedMs ? Math.max(0, processingCompletedMs - nerStartedMs) : null

  const ocrProviderLabel =
    tracked?.ocrProvider === 'pdfjs_native'
      ? 'PDF.js nativo'
      : tracked?.ocrProvider === 'office_native'
        ? 'Extracción Office (sin OCR)'
        : tracked?.ocrProvider === 'gemini_vision'
          ? 'Gemini Vision'
          : tracked?.ocrProvider === 'mistral_ocr_3'
            ? 'Mistral OCR 3 (fuera de MVP)'
            : 'No disponible'

  const ocrModelLabel =
    tracked?.ocrProvider === 'pdfjs_native'
      ? 'No aplica (pdfjs nativo)'
      : tracked?.ocrProvider === 'office_native'
        ? 'No aplica (mammoth / SheetJS / ZIP)'
        : (tracked?.ocrModel ?? 'No disponible')

  const nerModelLabel =
    tracked?.nerModel && tracked?.nerProvider
      ? `${tracked.nerModel} (${tracked.nerProvider})`
      : (tracked?.nerModel ?? 'No disponible')

  const rawLen = tracked?.rawExtractedText?.length
  const classificationSourceLabel = tracked?.documentClassificationSource ?? '—'
  const classificationLabel = tracked?.documentClassification ?? '—'

  const items: WorkspaceTestingMetricItem[] = [
    {
      variant: 'card',
      label: 'Estado del análisis (servidor)',
      value: tracked?.processingStatus ?? 'sin tracked',
      hint: 'processingStatus en UploadedFile; compáralo con el stage de la UI.',
    },
    {
      variant: 'card',
      label: 'Stage UI (cliente)',
      value: ctx.currentStage,
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
      value: `${ctx.currentFileName || '—'}\n${formatFileSize(ctx.currentFileSize)} · ${ctx.currentMimeType || '—'}`,
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
      value: formatDuration(ctx.lastAnalysisDurationMs),
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
      value: String(ctx.analysisAttempts),
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
      value: product?.productType ?? ctx.selectedProductType,
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
      value: formatNerAttemptTrace(tracked?.nerAttemptTrace as NerAttemptTraceEntry[] | undefined),
      hint: 'Una línea; abajo tienes multilínea y JSON.',
    },
    {
      variant: 'card',
      label: 'Completitud ficha editable',
      value: `${ctx.metadataCompletion.completed}/${ctx.metadataCompletion.total} (${ctx.metadataCompletion.percent}%)`,
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

  const verboseTrace = formatNerAttemptTraceVerbose(
    tracked?.nerAttemptTrace as NerAttemptTraceEntry[] | undefined,
  )
  if (verboseTrace) {
    items.push({
      variant: 'wide',
      label: 'Traza intentos NER (multilínea)',
      body: verboseTrace,
      hint: 'Una línea por intento; error hasta ~500 caracteres.',
      mono: true,
    })
  }

  const traceJson = formatNerAttemptTraceJson(
    tracked?.nerAttemptTrace as NerAttemptTraceEntry[] | undefined,
  )
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
}
