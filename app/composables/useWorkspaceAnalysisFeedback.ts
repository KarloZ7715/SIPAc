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

let globalProgressTimer: NodeJS.Timeout | null = null
let globalHighlightTimer: NodeJS.Timeout | null = null

export function useWorkspaceAnalysisFeedback() {
  const prefersReducedMotion = useState('workspace-analysis-prefersReducedMotion', () => false)
  const analysisProgress = useState('workspace-analysis-progress', () => 0)
  const analysisHighlights = useState<WorkspaceAnalysisHighlightItem[]>(
    'workspace-analysis-highlights',
    () => [],
  )
  const analysisStartedAt = useState<number | null>('workspace-analysis-startedAt', () => null)
  const analysisFinishedAt = useState<number | null>('workspace-analysis-finishedAt', () => null)
  const lastAnalysisDurationMs = useState<number | null>(
    'workspace-analysis-lastDurationMs',
    () => null,
  )
  const analysisAttempts = useState('workspace-analysis-attempts', () => 0)

  const highlightCursor = useState('workspace-analysis-cursor', () => 0)
  const highlightSerial = useState('workspace-analysis-serial', () => 0)
  const highlightRemovalTimers = useState<ReturnType<typeof setTimeout>[]>(
    'workspace-analysis-removalTimers',
    () => [],
  )

  let localRemoveReducedMotionListener: (() => void) | undefined

  const processingMessages = WORKSPACE_ANALYSIS_PROCESSING_MESSAGES

  function scheduleHighlightRemoval(id: string) {
    const timer = setTimeout(() => {
      analysisHighlights.value = analysisHighlights.value.filter((highlight) => highlight.id !== id)
      highlightRemovalTimers.value = highlightRemovalTimers.value.filter((entry) => entry !== timer)
    }, WORKSPACE_ANALYSIS_HIGHLIGHT_EXIT_DELAY_MS)
    highlightRemovalTimers.value.push(timer)
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
      id: `analysis-highlight-${highlightSerial.value++}`,
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
      return getProcessingMessage(highlightCursor.value)
    }
    const randomIndex = Math.floor(Math.random() * availableMessages.length)
    const nextMessage = availableMessages[randomIndex] ?? fallbackMessage
    const resolvedIndex = processingMessages.indexOf(nextMessage)
    if (resolvedIndex >= 0) {
      highlightCursor.value = resolvedIndex
    }
    return nextMessage
  }

  function stopProcessingFeedback() {
    if (globalProgressTimer) {
      clearInterval(globalProgressTimer!)
      globalProgressTimer = null
    }
    if (globalHighlightTimer) {
      clearInterval(globalHighlightTimer!)
      globalHighlightTimer = null
    }
    highlightRemovalTimers.value.forEach((timer) => clearTimeout(timer))
    highlightRemovalTimers.value = []
    analysisHighlights.value = analysisHighlights.value.map((highlight) => ({
      ...highlight,
      leaving: false,
    }))
  }

  function startProcessingFeedback() {
    if (globalProgressTimer || globalHighlightTimer) {
      return
    }
    if (!analysisHighlights.value.length) {
      pushAnalysisHighlight(getNextHighlightMessage())
    }
    analysisProgress.value = Math.max(12, analysisProgress.value)
    globalProgressTimer = setInterval(() => {
      analysisProgress.value = Math.min(
        92,
        analysisProgress.value + (analysisProgress.value < 48 ? 8 : 4),
      )
    }, 950)
    if (!prefersReducedMotion.value) {
      globalHighlightTimer = setInterval(() => {
        pushAnalysisHighlight(getNextHighlightMessage())
      }, WORKSPACE_ANALYSIS_HIGHLIGHT_INTERVAL_MS)
    }
  }

  function resetWorkspaceVisualState() {
    stopProcessingFeedback()
    analysisProgress.value = 0
    analysisHighlights.value = []
    highlightCursor.value = 0
    highlightSerial.value = 0
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
    localRemoveReducedMotionListener = () =>
      mq.removeEventListener('change', onMotionPreferenceChange)
  })

  onBeforeUnmount(() => {
    localRemoveReducedMotionListener?.()
    // Not stopping processing feedback so it persists across page navigations
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
