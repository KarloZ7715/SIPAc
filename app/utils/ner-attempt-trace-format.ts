import type { NerAttemptTraceEntry } from '~~/app/types'

export function formatNerAttemptTrace(trace: NerAttemptTraceEntry[] | undefined): string {
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

export function formatNerAttemptTraceVerbose(trace: NerAttemptTraceEntry[] | undefined): string {
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

export function formatNerAttemptTraceJson(trace: NerAttemptTraceEntry[] | undefined): string {
  if (!trace?.length) {
    return ''
  }
  try {
    return JSON.stringify(trace, null, 2)
  } catch {
    return ''
  }
}
