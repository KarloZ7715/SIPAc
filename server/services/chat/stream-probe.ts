import type { InferUIMessageChunk, UIMessage } from 'ai'

const SUCCESSFUL_STREAM_CHUNK_TYPES = new Set([
  'start',
  'start-step',
  'text-start',
  'text-delta',
  'reasoning-start',
  'tool-input-start',
  'tool-input-available',
  'tool-output-available',
  'source-url',
  'source-document',
  'file',
  'finish',
])

export const DEFAULT_CHAT_STREAM_PROBE_TIMEOUT_MS = 15000

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

function isSuccessfulProbeChunk<T extends UIMessage>(chunk: InferUIMessageChunk<T>) {
  return SUCCESSFUL_STREAM_CHUNK_TYPES.has(chunk.type)
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
        return {
          ok: true,
          stream: outputStream,
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
