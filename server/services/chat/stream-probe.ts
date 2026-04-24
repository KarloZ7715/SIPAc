import type { InferUIMessageChunk, UIMessage } from 'ai'

const NON_TEXT_SUCCESSFUL_CHUNK_TYPES = new Set([
  'tool-input-start',
  'tool-input-available',
  'tool-output-available',
])

export const DEFAULT_CHAT_STREAM_PROBE_TIMEOUT_MS = 10_000

class StreamProbeTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`El proveedor no emitió chunks iniciales dentro de ${timeoutMs} ms`)
    this.name = 'StreamProbeTimeoutError'
  }
}

interface ErrorProbeChunk {
  type: 'error'
  errorText: string
}

interface AbortProbeChunk {
  type: 'abort'
  reason?: string
}

function hasUsefulTextDelta<T extends UIMessage>(chunk: InferUIMessageChunk<T>) {
  if (chunk.type !== 'text-delta') {
    return false
  }

  const textCandidate =
    'delta' in chunk && typeof chunk.delta === 'string'
      ? chunk.delta
      : 'text' in chunk && typeof chunk.text === 'string'
        ? chunk.text
        : ''

  return textCandidate.trim().length > 0
}

function isSuccessfulProbeChunk<T extends UIMessage>(chunk: InferUIMessageChunk<T>) {
  return hasUsefulTextDelta(chunk) || NON_TEXT_SUCCESSFUL_CHUNK_TYPES.has(chunk.type)
}

async function readChunkWithTimeout<T extends UIMessage>(
  reader: ReadableStreamDefaultReader<InferUIMessageChunk<T>>,
  timeoutMs: number,
) {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new StreamProbeTimeoutError(timeoutMs))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}

export async function probeUiMessageStream<T extends UIMessage>(
  stream: ReadableStream<InferUIMessageChunk<T>>,
  timeoutMs = DEFAULT_CHAT_STREAM_PROBE_TIMEOUT_MS,
): Promise<
  | {
      ok: true
      stream: ReadableStream<InferUIMessageChunk<T>>
    }
  | {
      ok: false
      errorText: string
    }
> {
  const [probeStream, outputStream] = stream.tee()
  const reader = probeStream.getReader()

  try {
    while (true) {
      const { done, value } = await readChunkWithTimeout(reader, timeoutMs)

      if (done) {
        void outputStream
          .cancel('El proveedor finalizó el stream sin contenido útil')
          .catch(() => {})
        return {
          ok: false,
          errorText: 'El proveedor finalizó el stream sin contenido útil',
        }
      }

      if (value.type === 'error') {
        const errorChunk = value as ErrorProbeChunk
        void outputStream.cancel(errorChunk.errorText).catch(() => {})
        return {
          ok: false,
          errorText: errorChunk.errorText,
        }
      }

      if (value.type === 'abort') {
        const abortChunk = value as AbortProbeChunk
        const reason = abortChunk.reason ?? 'La transmisión del modelo fue abortada'
        void outputStream.cancel(reason).catch(() => {})
        return {
          ok: false,
          errorText: reason,
        }
      }

      if (isSuccessfulProbeChunk(value)) {
        return {
          ok: true,
          stream: outputStream,
        }
      }
    }
  } catch (error) {
    const errorText =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'El proveedor no respondió durante la fase inicial del stream'

    void outputStream.cancel(errorText).catch(() => {})

    return {
      ok: false,
      errorText,
    }
  } finally {
    void reader.cancel().catch(() => {})
  }
}
