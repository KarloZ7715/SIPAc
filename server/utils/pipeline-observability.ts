export interface PipelineLogEvent {
  traceId?: string
  documentId?: string
  stage: string
  event: string
  provider?: string
  modelId?: string
  attempt?: number
  durationMs?: number
  errorType?: string
  errorMessage?: string
  metadata?: Record<string, unknown>
}

export function classifyPipelineError(error: unknown): {
  errorType: string
  errorMessage: string
} {
  if (error instanceof Error) {
    const normalizedName = error.name.toLowerCase()
    if (
      error.name === 'NoObjectGeneratedError' ||
      normalizedName.includes('noobjectgenerated') ||
      error.message.toLowerCase().includes('no object generated')
    ) {
      return { errorType: 'no_object_generated', errorMessage: error.message }
    }

    const normalizedMessage = error.message.toLowerCase()

    if (
      normalizedMessage.includes('401') ||
      normalizedMessage.includes('403') ||
      normalizedMessage.includes('unauthorized') ||
      normalizedMessage.includes('forbidden') ||
      normalizedMessage.includes('invalid api key') ||
      normalizedMessage.includes('authentication')
    ) {
      return { errorType: 'auth_error', errorMessage: error.message }
    }

    if (normalizedMessage.includes('timeout') || normalizedMessage.includes('timed out')) {
      return { errorType: 'timeout', errorMessage: error.message }
    }

    if (
      normalizedMessage.includes('429') ||
      normalizedMessage.includes('rate limit') ||
      normalizedMessage.includes('quota exceeded')
    ) {
      return { errorType: 'rate_limit', errorMessage: error.message }
    }

    if (
      normalizedMessage.includes('502') ||
      normalizedMessage.includes('503') ||
      normalizedMessage.includes('504') ||
      normalizedMessage.includes('bad gateway') ||
      normalizedMessage.includes('service unavailable') ||
      normalizedMessage.includes('gateway timeout') ||
      normalizedMessage.includes('overloaded')
    ) {
      return { errorType: 'provider_unavailable', errorMessage: error.message }
    }

    if (
      normalizedMessage.includes('network') ||
      normalizedMessage.includes('econnreset') ||
      normalizedMessage.includes('enotfound') ||
      normalizedMessage.includes('eai_again') ||
      normalizedMessage.includes('fetch failed')
    ) {
      return { errorType: 'network_error', errorMessage: error.message }
    }

    if (normalizedMessage.includes('schema') || normalizedMessage.includes('validation')) {
      return { errorType: 'schema_validation', errorMessage: error.message }
    }

    return { errorType: 'runtime_error', errorMessage: error.message }
  }

  return {
    errorType: 'unknown_error',
    errorMessage: String(error),
  }
}

export function logPipelineEvent(payload: PipelineLogEvent) {
  const event = {
    ...payload,
    timestamp: new Date().toISOString(),
  }

  console.info(`[pipeline] ${JSON.stringify(event)}`)
}

export async function withTimeout<T>(input: {
  label: string
  timeoutMs: number
  run: () => Promise<T>
}): Promise<T> {
  if (!Number.isFinite(input.timeoutMs) || input.timeoutMs <= 0) {
    return input.run()
  }

  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${input.label} timed out after ${input.timeoutMs}ms`))
    }, input.timeoutMs)

    input
      .run()
      .then((result) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}
