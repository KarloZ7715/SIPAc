<script setup lang="ts">
import type { DocumentAnchor } from '~~/app/types'
import { isStructuredOfficeMimeType } from '~~/app/types'
import { HIGHLIGHT_CONFIDENCE_STYLES } from '~~/app/config/ui-highlight-tokens'
/** Worker URL cargado dinámicamente dentro de renderPdfDocument — evita incluirlo en el bundle inicial. */
let pdfWorkerSrc: string | undefined

interface HighlightGroup {
  key: string
  label: string
  confidence?: number
  anchors: DocumentAnchor[]
}

interface RenderedPage {
  page: number
  width: number
  height: number
  scale: number
}

const props = defineProps<{
  previewUrl: string | null
  mimeType: string
  groups: HighlightGroup[]
  activeKey: string | null
}>()

const emit = defineEmits<{
  highlightClick: [key: string]
  previewExpand: []
}>()

const viewerContainer = ref<HTMLElement | null>(null)
const imageElement = ref<HTMLImageElement | null>(null)
const renderedPages = ref<RenderedPage[]>([])
const totalPdfPages = ref<number | null>(null)
const pdfError = ref<string | null>(null)
const renderingPdf = ref(false)
const useNativePdfEmbed = ref(false)
const isReadyToRender = ref(false)
const containerWidth = ref(0)
const canvasRefs = new Map<number, HTMLCanvasElement>()
const pageRefs = new Map<number, HTMLElement>()
const renderedPageNumbers = new Set<number>()
const renderInFlight = new Set<number>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfDocument: any | null = null
let pageObserver: IntersectionObserver | null = null
let activeRenderToken = 0
let resizeObserver: ResizeObserver | null = null
let resizeRaf = 0

function normalizeMimeType(value: string | null | undefined): string {
  if (!value) {
    return ''
  }

  return value.split(';')[0]?.trim().toLowerCase() ?? ''
}

function inferMimeTypeFromPreviewUrl(url: string | null): string {
  if (!url) {
    return ''
  }

  const lower = url.toLowerCase()

  if (lower.startsWith('data:application/pdf')) {
    return 'application/pdf'
  }

  if (lower.startsWith('data:image/')) {
    return 'image'
  }

  if (lower.endsWith('.pdf')) {
    return 'application/pdf'
  }

  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image'
  }

  return ''
}

function pdfUrlNeedsCredentials(url: string): boolean {
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return false
  }
  try {
    if (url.startsWith('/')) {
      return url.startsWith('/api/')
    }
    if (import.meta.client && typeof window !== 'undefined') {
      const parsed = new URL(url, window.location.origin)
      return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/')
    }
  } catch {
    return false
  }
  return false
}

const resolvedMimeType = computed(() => {
  const explicitMime = normalizeMimeType(props.mimeType)
  if (explicitMime) {
    return explicitMime
  }

  return inferMimeTypeFromPreviewUrl(props.previewUrl)
})

const isImage = computed(() => resolvedMimeType.value.startsWith('image'))
const isPdf = computed(() => resolvedMimeType.value === 'application/pdf')
const isStructuredOffice = computed(() => isStructuredOfficeMimeType(resolvedMimeType.value))
const canRenderPreview = computed(() => isImage.value || isPdf.value)

const hasAnyAnchors = computed(() => props.groups.some((group) => group.anchors.length > 0))

/** Incluye modo resaltados para re-render si la URL no cambia pero sí los grupos. */
const previewSourceKey = computed(
  () => `${props.previewUrl ?? ''}|${resolvedMimeType.value}|${hasAnyAnchors.value ? 'h' : 'n'}`,
)
const lastPreviewSourceKey = ref('')

/** Solo iframe como último recurso (pdf.js falló); nunca por defecto — iframe+blob falla en Firefox/Safari. */
const shouldUseNativePdfEmbed = computed(() => isPdf.value && useNativePdfEmbed.value)
const shouldShowPdfLoadingState = computed(
  () =>
    isPdf.value && !shouldUseNativePdfEmbed.value && !renderedPages.value.length && !pdfError.value,
)

const normalizedGroups = computed(() =>
  props.groups.map((group) => ({
    ...group,
    anchors: group.anchors.filter((anchor) => Number.isFinite(anchor.page) && anchor.page > 0),
  })),
)

const groupedHighlightsByPage = computed(() => {
  const map = new Map<
    number,
    Array<{
      id: string
      key: string
      label: string
      confidence?: number
      anchor: DocumentAnchor
    }>
  >()

  normalizedGroups.value.forEach((group) => {
    group.anchors.forEach((anchor, index) => {
      const list = map.get(anchor.page) ?? []
      list.push({
        id: `${group.key}-${anchor.page}-${index}`,
        key: group.key,
        label: group.label,
        confidence: group.confidence,
        anchor,
      })
      map.set(anchor.page, list)
    })
  })

  return map
})

function getPageHighlights(page: number) {
  return groupedHighlightsByPage.value.get(page) ?? []
}

const imageHighlights = computed(() => {
  const highlights: ReturnType<typeof getPageHighlights> = []

  groupedHighlightsByPage.value.forEach((entries) => {
    highlights.push(...entries)
  })

  return highlights
})

function setCanvasRef(page: number, el: HTMLCanvasElement | null) {
  if (!el) {
    canvasRefs.delete(page)
    return
  }

  canvasRefs.set(page, el)
}

function ensurePageObserver() {
  if (typeof IntersectionObserver === 'undefined') {
    return null
  }

  if (!pageObserver) {
    pageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return
          }

          const element = entry.target as HTMLElement
          const pageAttr = element.dataset.page
          const pageNumber = pageAttr ? Number(pageAttr) : NaN

          if (Number.isFinite(pageNumber)) {
            void renderSinglePage(pageNumber)
          }
        })
      },
      {
        root: viewerContainer.value,
        threshold: 0.01,
        rootMargin: '80px 0px 120px 0px',
      },
    )
  }

  return pageObserver
}

function setPageRef(page: number, el: HTMLElement | null) {
  if (!el) {
    pageRefs.delete(page)
    return
  }

  pageRefs.set(page, el)
  const observer = ensurePageObserver()
  observer?.observe(el)
}

function focusPageForActiveKey() {
  if (!props.activeKey) {
    return
  }

  const activeGroup = normalizedGroups.value.find((group) => group.key === props.activeKey)
  const firstAnchor = activeGroup?.anchors[0]

  if (!firstAnchor) {
    return
  }

  const pageElement = pageRefs.get(firstAnchor.page)
  if (!pageElement) {
    return
  }

  pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

type HighlightConfidenceLevel = keyof typeof HIGHLIGHT_CONFIDENCE_STYLES

function resolveConfidenceLevel(confidence: number | undefined): HighlightConfidenceLevel {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
    return 'neutral'
  }

  if (confidence >= 0.8) {
    return 'high'
  }

  if (confidence >= 0.5) {
    return 'medium'
  }

  return 'low'
}

function resolveConfidenceClass(confidence: number | undefined) {
  return `highlight-${resolveConfidenceLevel(confidence)}`
}

function resolveConfidenceLabel(confidence: number | undefined) {
  const level = resolveConfidenceLevel(confidence)
  if (level === 'high') return 'confianza alta'
  if (level === 'medium') return 'confianza media'
  if (level === 'low') return 'confianza baja'
  return 'confianza no especificada'
}

function resolveHighlightColorStyle(confidence: number | undefined) {
  const level = resolveConfidenceLevel(confidence)
  const style = HIGHLIGHT_CONFIDENCE_STYLES[level]
  return {
    '--highlight-bg': style.background,
    '--highlight-border': style.border,
  }
}

function isHighlightActive(key: string) {
  return props.activeKey === key
}

function isHighlightDimmed(key: string) {
  return !!props.activeKey && props.activeKey !== key
}

function handleHighlightClick(key: string) {
  emit('highlightClick', key)
}

function requestPreviewExpand() {
  emit('previewExpand')
}

async function loadPdfWithPdfJs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfjs: any,
  url: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const withCreds = pdfUrlNeedsCredentials(url)
  try {
    return await pdfjs.getDocument({
      url,
      isEvalSupported: false,
      ...(withCreds ? { withCredentials: true } : {}),
    }).promise
  } catch (firstErr) {
    if (!import.meta.client || (!url.startsWith('blob:') && !url.startsWith('/api/'))) {
      throw firstErr
    }
    const res = await fetch(url, { credentials: withCreds ? 'include' : 'same-origin' })
    if (!res.ok) {
      throw firstErr
    }
    const data = await res.arrayBuffer()
    return pdfjs.getDocument({ data, isEvalSupported: false }).promise
  }
}

async function renderPdfDocument(url: string) {
  const renderToken = ++activeRenderToken
  renderingPdf.value = true
  pdfError.value = null
  renderedPages.value = []
  totalPdfPages.value = null
  useNativePdfEmbed.value = false
  renderedPageNumbers.clear()
  renderInFlight.clear()
  pdfDocument = null

  try {
    const [pdfjs, workerModule] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ])
    if (!pdfWorkerSrc) {
      pdfWorkerSrc = workerModule.default
    }
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdf: any = await loadPdfWithPdfJs(pdfjs, url)

    const pages: RenderedPage[] = []
    const maxPages = pdf.numPages
    totalPdfPages.value = pdf.numPages

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      if (renderToken !== activeRenderToken) {
        return
      }

      const page = await pdf.getPage(pageNumber)
      const initialViewport = page.getViewport({ scale: 1 })
      const availableWidth =
        containerWidth.value || viewerContainer.value?.clientWidth || initialViewport.width
      const targetWidth = Math.max(220, Math.min(availableWidth - 16, 980))
      const scale = targetWidth / Math.max(initialViewport.width, 1)
      const viewport = page.getViewport({ scale })

      pages.push({
        page: pageNumber,
        width: viewport.width,
        height: viewport.height,
        scale,
      })
    }

    renderedPages.value = pages
    pdfDocument = pdf

    if (pages.length === 0) {
      useNativePdfEmbed.value = true
    } else {
      // Pintar ya las primeras páginas: si solo confiamos en IntersectionObserver,
      // a veces no dispara (contenedor en 0px, transiciones, umbral) y el lienzo queda en blanco.
      await nextTick()
      if (renderToken !== activeRenderToken) {
        return
      }
      const eagerPageCount = Math.min(pages.length, 3)
      for (let p = 1; p <= eagerPageCount; p += 1) {
        if (renderToken !== activeRenderToken) {
          return
        }
        await renderSinglePage(p)
      }
    }
  } catch (error) {
    pdfError.value = error instanceof Error ? error.message : 'No se pudo renderizar el documento.'
    useNativePdfEmbed.value = true
  } finally {
    if (renderToken === activeRenderToken) {
      renderingPdf.value = false
    }
  }
}

async function resolveCanvasForPage(pageNumber: number): Promise<HTMLCanvasElement | null> {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    await nextTick()

    const canvas = canvasRefs.get(pageNumber)
    if (canvas) {
      return canvas
    }

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }

  return null
}

async function renderSinglePage(pageNumber: number) {
  const renderToken = activeRenderToken

  if (!pdfDocument || renderedPageNumbers.has(pageNumber)) {
    return
  }

  const pageMeta = renderedPages.value.find((entry) => entry.page === pageNumber)
  if (!pageMeta) {
    return
  }

  if (renderInFlight.has(pageNumber)) {
    return
  }

  renderInFlight.add(pageNumber)
  try {
    const page = await pdfDocument.getPage(pageNumber)
    if (renderToken !== activeRenderToken) {
      return
    }

    const viewport = page.getViewport({ scale: pageMeta.scale })

    const canvas = await resolveCanvasForPage(pageNumber)
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)

    await page.render({ canvasContext: context, viewport }).promise

    if (renderToken !== activeRenderToken) {
      return
    }

    renderedPageNumbers.add(pageNumber)
  } finally {
    renderInFlight.delete(pageNumber)
  }
}

function updateContainerWidth(width: number) {
  if (!Number.isFinite(width) || width <= 0) {
    return
  }

  const roundedWidth = Math.round(width)
  if (Math.abs(roundedWidth - containerWidth.value) < 2) {
    return
  }

  containerWidth.value = roundedWidth
}

function notifyContainerResize() {
  if (resizeRaf) {
    cancelAnimationFrame(resizeRaf)
  }

  resizeRaf = requestAnimationFrame(() => {
    const width = viewerContainer.value?.clientWidth ?? 0
    updateContainerWidth(width)
  })
}

onMounted(() => {
  isReadyToRender.value = true

  if (!import.meta.client) {
    return
  }

  const viewer = viewerContainer.value
  const target = (viewer?.parentElement as HTMLElement | null) ?? viewer

  if (!viewer || !target || typeof ResizeObserver === 'undefined') {
    return
  }

  updateContainerWidth(viewer.clientWidth || target.clientWidth)

  resizeObserver = new ResizeObserver((entries) => {
    const observedWidth = entries[0]?.contentRect.width ?? target.clientWidth
    updateContainerWidth(viewer.clientWidth || observedWidth)
  })
  resizeObserver.observe(target)
  window.addEventListener('resize', notifyContainerResize)
})

onBeforeUnmount(() => {
  activeRenderToken += 1

  if (pdfDocument && typeof pdfDocument.cleanup === 'function') {
    pdfDocument.cleanup()
  }

  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  if (import.meta.client) {
    window.removeEventListener('resize', notifyContainerResize)
  }

  if (pageObserver) {
    pageObserver.disconnect()
    pageObserver = null
  }

  if (resizeRaf) {
    cancelAnimationFrame(resizeRaf)
    resizeRaf = 0
  }
})

watch(
  () =>
    [
      previewSourceKey.value,
      props.previewUrl,
      resolvedMimeType.value,
      containerWidth.value,
      isReadyToRender.value,
    ] as const,
  async ([sourceKey, previewUrl, mimeType]) => {
    const renderToken = ++activeRenderToken
    renderedPages.value = []
    pdfError.value = null
    totalPdfPages.value = null
    renderedPageNumbers.clear()
    renderInFlight.clear()
    canvasRefs.clear()
    pageRefs.clear()
    if (pageObserver) {
      pageObserver.disconnect()
      pageObserver = null
    }

    if (sourceKey !== lastPreviewSourceKey.value) {
      lastPreviewSourceKey.value = sourceKey
      useNativePdfEmbed.value = false
    }

    if (!isReadyToRender.value) {
      renderingPdf.value = false
      return
    }

    if (!previewUrl) {
      return
    }

    if (mimeType === 'application/pdf') {
      if (shouldUseNativePdfEmbed.value) {
        renderingPdf.value = false
        return
      }

      await nextTick()

      // Si mientras esperábamos el siguiente tick cambió el token,
      // cancelamos este render para evitar condiciones de carrera.
      if (renderToken !== activeRenderToken) {
        return
      }

      await renderPdfDocument(previewUrl)
      return
    }

    renderingPdf.value = false
  },
  { immediate: true },
)

watch(
  () => props.activeKey,
  async () => {
    await nextTick()
    focusPageForActiveKey()
  },
)
</script>

<template>
  <div ref="viewerContainer" class="document-viewer-shell" data-testid="document-preview-shell">
    <div v-if="!previewUrl" class="document-viewer-empty">
      <UIcon name="i-lucide-file-search" class="size-8 text-sipac-700" />
      <p class="font-semibold text-text">Sube un archivo para visualizarlo aquí.</p>
    </div>

    <div v-else-if="isImage" class="image-preview-shell">
      <img
        ref="imageElement"
        :src="previewUrl"
        alt="Vista previa"
        class="image-preview"
        loading="lazy"
        @click="requestPreviewExpand"
      />

      <div v-if="hasAnyAnchors" class="overlay-layer" role="list">
        <button
          v-for="item in imageHighlights"
          :key="item.id"
          type="button"
          class="highlight-box"
          :class="[
            resolveConfidenceClass(item.confidence),
            {
              'highlight-active': isHighlightActive(item.key),
              'highlight-dimmed': isHighlightDimmed(item.key),
            },
          ]"
          :style="{
            top: `${item.anchor.y * 100}%`,
            left: `${item.anchor.x * 100}%`,
            width: `${item.anchor.width * 100}%`,
            height: `${item.anchor.height * 100}%`,
            ...resolveHighlightColorStyle(item.confidence),
          }"
          :data-confidence-level="resolveConfidenceLevel(item.confidence)"
          :aria-label="`${item.label} (${resolveConfidenceLabel(item.confidence)})`"
          :title="item.label"
          @click.stop="handleHighlightClick(item.key)"
        />
      </div>
    </div>

    <div v-else class="pdf-preview-shell">
      <div v-if="!canRenderPreview" class="document-viewer-empty">
        <UIcon
          :name="isStructuredOffice ? 'i-lucide-file-text' : 'i-lucide-file-warning'"
          class="size-8"
          :class="isStructuredOffice ? 'text-sipac-700' : 'text-amber-600'"
        />
        <template v-if="isStructuredOffice">
          <p class="font-semibold text-text">Vista previa no disponible para este Office</p>
          <p class="text-sm text-text-muted">
            Extraemos el texto para la ficha y el análisis; aquí no renderizamos Word, Excel ni
            PowerPoint.
          </p>
        </template>
        <template v-else>
          <p class="font-semibold text-text">No pudimos identificar el tipo del archivo.</p>
          <p class="text-sm text-text-muted">Vuelve a cargarlo para mostrar la vista previa.</p>
        </template>
      </div>

      <div v-else-if="shouldUseNativePdfEmbed" class="pdf-embed-fallback">
        <iframe :src="previewUrl" title="Vista previa PDF" class="pdf-embed-frame" />
      </div>

      <div v-else-if="renderedPages.length" class="pdf-pages-stack">
        <article
          v-for="page in renderedPages"
          :key="`pdf-page-${page.page}`"
          :ref="(el) => setPageRef(page.page, el as HTMLElement | null)"
          class="pdf-page-shell"
          :data-page="page.page"
          @click="requestPreviewExpand"
        >
          <canvas
            :ref="(el) => setCanvasRef(page.page, el as HTMLCanvasElement | null)"
            class="pdf-page-canvas"
          />

          <div v-if="hasAnyAnchors" class="overlay-layer" role="list">
            <button
              v-for="item in getPageHighlights(page.page)"
              :key="item.id"
              type="button"
              class="highlight-box"
              :class="[
                resolveConfidenceClass(item.confidence),
                {
                  'highlight-active': isHighlightActive(item.key),
                  'highlight-dimmed': isHighlightDimmed(item.key),
                },
              ]"
              :style="{
                top: `${item.anchor.y * 100}%`,
                left: `${item.anchor.x * 100}%`,
                width: `${item.anchor.width * 100}%`,
                height: `${item.anchor.height * 100}%`,
                ...resolveHighlightColorStyle(item.confidence),
              }"
              :data-confidence-level="resolveConfidenceLevel(item.confidence)"
              :aria-label="`${item.label} (${resolveConfidenceLabel(item.confidence)})`"
              :title="item.label"
              @click.stop="handleHighlightClick(item.key)"
            />
          </div>
        </article>

        <p
          v-if="totalPdfPages !== null && totalPdfPages > renderedPages.length"
          class="mt-1 text-center text-xs text-text-muted"
        >
          Mostramos solo las primeras {{ renderedPages.length }} de {{ totalPdfPages }} páginas para
          mantener la vista previa ligera.
        </p>
      </div>

      <div v-else-if="shouldShowPdfLoadingState" class="document-viewer-empty">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-sipac-700" />
        <p class="font-semibold text-text">
          {{
            isReadyToRender ? 'Renderizando vista previa del PDF…' : 'Preparando la vista previa…'
          }}
        </p>
      </div>

      <div v-else-if="pdfError" class="document-viewer-empty">
        <UIcon name="i-lucide-triangle-alert" class="size-8 text-amber-600" />
        <p class="font-semibold text-text">No se pudo mostrar el PDF.</p>
        <p class="text-sm text-text-muted">{{ pdfError }}</p>
      </div>

      <div v-else class="document-viewer-empty">
        <UIcon name="i-lucide-file-search" class="size-8 text-sipac-700" />
        <p class="font-semibold text-text">Aun no pudimos pintar el PDF.</p>
        <p class="text-sm text-text-muted">
          Intenta recargar la vista o volver a subir el archivo.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.document-viewer-shell {
  position: relative;
  overflow: auto;
  scrollbar-gutter: stable both-edges;
  max-height: min(70vh, 44rem);
  border: 1px solid rgb(240 238 230 / 0.95);
  border-radius: 1.35rem;
  background:
    radial-gradient(circle at top, rgb(201 100 66 / 0.04), transparent 42%),
    linear-gradient(180deg, rgb(250 249 245 / 0.98), rgb(245 244 237 / 0.94));
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.72),
    0 18px 44px -34px rgb(20 20 19 / 0.12);
  /* Sin padding superior: el panel exterior ya alinea con la ficha; evita "doble aire" encima del PDF/imagen */
  padding: 0.75rem 0.75rem 0.85rem;
  scrollbar-width: thin;
  scrollbar-color: rgb(209 207 197 / 0.55) transparent;
}

.document-viewer-shell::before {
  content: '';
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  display: block;
  height: 14px;
  margin: 0 -0.75rem 0.25rem;
  background: linear-gradient(180deg, rgb(245 244 237 / 0.96), transparent);
  pointer-events: none;
  z-index: 1;
}

.document-viewer-empty {
  min-height: 18rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  text-align: center;
}

.image-preview-shell,
.pdf-page-shell {
  position: relative;
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
}

.image-preview {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
  border-radius: 0.95rem;
  border: 1px solid rgb(235 232 222 / 0.9);
  background: #ffffff;
  box-shadow:
    0 1px 0 rgb(255 255 255 / 0.9) inset,
    0 14px 32px -24px rgb(28 25 23 / 0.22),
    0 2px 4px -2px rgb(28 25 23 / 0.08);
}

.pdf-preview-shell {
  display: block;
}

.pdf-pages-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: stretch;
}

.pdf-embed-fallback {
  width: 100%;
  min-height: 26rem;
}

.pdf-embed-frame {
  width: 100%;
  min-height: 26rem;
  border: 1px solid rgb(235 232 222 / 0.9);
  border-radius: 0.95rem;
  background: #ffffff;
}

.pdf-page-canvas {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 0.95rem;
  border: 1px solid rgb(235 232 222 / 0.9);
  background: #ffffff;
  box-shadow:
    0 1px 0 rgb(255 255 255 / 0.9) inset,
    0 14px 32px -24px rgb(28 25 23 / 0.22),
    0 2px 4px -2px rgb(28 25 23 / 0.08);
}

.overlay-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.highlight-box {
  position: absolute;
  --highlight-bg: rgb(201 100 66 / 0.16);
  --highlight-border: rgb(201 100 66 / 0.6);
  background: var(--highlight-bg);
  border-color: var(--highlight-border);
  border-width: 2px;
  border-style: solid;
  border-radius: 0.45rem;
  pointer-events: auto;
  transition:
    opacity 180ms ease,
    transform 180ms ease,
    box-shadow 180ms ease;
}

.highlight-box:hover {
  transform: scale(1.01);
}

.highlight-neutral {
  border-style: solid;
}

.highlight-high {
  border-style: solid;
}

.highlight-medium {
  border-style: dashed;
}

.highlight-low {
  border-style: dotted;
}

.highlight-box[data-confidence-level='medium'],
.highlight-box[data-confidence-level='low'] {
  background-image: repeating-linear-gradient(
    135deg,
    rgb(255 255 255 / 0.2) 0,
    rgb(255 255 255 / 0.2) 4px,
    transparent 4px,
    transparent 8px
  );
}

.highlight-active {
  opacity: 1;
  box-shadow: 0 0 0 4px rgb(201 100 66 / 0.22);
}

.highlight-dimmed {
  opacity: 0.32;
}

@media (max-width: 640px) {
  .document-viewer-shell {
    padding: 0.6rem 0.6rem 0.7rem;
    max-height: 62vh;
  }
}

.document-viewer-shell::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.document-viewer-shell::-webkit-scrollbar-track {
  background: transparent;
}

.document-viewer-shell::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background-color: rgb(209 213 219 / 0.4);
}

.document-viewer-shell:hover::-webkit-scrollbar-thumb,
.document-viewer-shell:focus-within::-webkit-scrollbar-thumb {
  background-color: rgb(148 163 184 / 0.75);
}

.document-viewer-shell::-webkit-scrollbar-thumb:active {
  background-color: rgb(100 116 139 / 0.9);
}
</style>
