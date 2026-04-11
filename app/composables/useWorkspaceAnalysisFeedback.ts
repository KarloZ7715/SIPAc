import {
  WORKSPACE_ANALYSIS_HIGHLIGHT_EXIT_DELAY_MS,
  WORKSPACE_ANALYSIS_HIGHLIGHT_INTERVAL_MS,
  WORKSPACE_ANALYSIS_PROCESSING_MESSAGES,
  WORKSPACE_MAX_VISIBLE_ANALYSIS_HIGHLIGHTS,
} from '~~/app/config/workspace-analysis-ui'

export type WorkspaceAnalysisHighlightItem = {
  id: string
  message: string
  leaving: boolean
}

/**
 * Feedback visual durante la fase “analyzing”: barra de progreso simulada y mensajes rotativos.
 * No refleja el pipeline real del servidor; solo reduce la percepción de espera.
 */
export function useWorkspaceAnalysisFeedback() {
  const prefersReducedMotion = ref(false)
  const analysisProgress = ref(0)
  const analysisHighlights = ref<WorkspaceAnalysisHighlightItem[]>([])
  const analysisStartedAt = ref<number | null>(null)
  const analysisFinishedAt = ref<number | null>(null)
  const lastAnalysisDurationMs = ref<number | null>(null)
  const analysisAttempts = ref(0)

  let progressTimer: ReturnType<typeof setInterval> | null = null
  let highlightTimer: ReturnType<typeof setInterval> | null = null
  let highlightCursor = 0
  let highlightSerial = 0
  let highlightRemovalTimers: ReturnType<typeof setTimeout>[] = []
  let removeReducedMotionListener: (() => void) | undefined

  const processingMessages = WORKSPACE_ANALYSIS_PROCESSING_MESSAGES

  function scheduleHighlightRemoval(id: string) {
    const timer = setTimeout(() => {
      analysisHighlights.value = analysisHighlights.value.filter((highlight) => highlight.id !== id)
      highlightRemovalTimers = highlightRemovalTimers.filter((entry) => entry !== timer)
    }, WORKSPACE_ANALYSIS_HIGHLIGHT_EXIT_DELAY_MS)
    highlightRemovalTimers.push(timer)
  }

  function trimAnalysisHighlights() {
    const visibleHighlights = analysisHighlights.value.filter((highlight) => !highlight.leaving)
    if (visibleHighlights.length <= WORKSPACE_MAX_VISIBLE_ANALYSIS_HIGHLIGHTS) {
      return
    }
    const overflowHighlights = visibleHighlights.slice(WORKSPACE_MAX_VISIBLE_ANALYSIS_HIGHLIGHTS)
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
    const nextHighlight: WorkspaceAnalysisHighlightItem = {
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
    if (!prefersReducedMotion.value) {
      highlightTimer = setInterval(() => {
        pushAnalysisHighlight(getNextHighlightMessage())
      }, WORKSPACE_ANALYSIS_HIGHLIGHT_INTERVAL_MS)
    }
  }

  function resetWorkspaceVisualState() {
    stopProcessingFeedback()
    analysisProgress.value = 0
    analysisHighlights.value = []
    highlightCursor = 0
    highlightSerial = 0
  }

  onMounted(() => {
    if (!import.meta.client) {
      return
    }
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    prefersReducedMotion.value = mq.matches
    const onMotionPreferenceChange = () => {
      prefersReducedMotion.value = mq.matches
    }
    mq.addEventListener('change', onMotionPreferenceChange)
    removeReducedMotionListener = () => mq.removeEventListener('change', onMotionPreferenceChange)
  })

  onBeforeUnmount(() => {
    removeReducedMotionListener?.()
    stopProcessingFeedback()
  })

  return {
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
  }
}
