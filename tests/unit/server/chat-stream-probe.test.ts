import { describe, expect, it } from 'vitest'
import type { InferUIMessageChunk, UIMessage } from 'ai'
import { probeUiMessageStream } from '~~/server/services/chat/stream-probe'

type MinimalMessage = UIMessage

function chunk(type: string, extra: Record<string, unknown> = {}) {
  return {
    type,
    ...extra,
  } as InferUIMessageChunk<MinimalMessage>
}

describe('probeUiMessageStream', () => {
  it('accepts a start chunk as a successful probe', async () => {
    const stream = new ReadableStream<InferUIMessageChunk<MinimalMessage>>({
      start(controller) {
        controller.enqueue(chunk('start', { messageId: 'msg-1' }))
      },
    })

    const result = await probeUiMessageStream(stream, 25)

    expect(result.ok).toBe(true)
  })

  it('fails fast when the provider never emits an initial chunk', async () => {
    const stream = new ReadableStream<InferUIMessageChunk<MinimalMessage>>({
      start() {},
    })

    const result = await probeUiMessageStream(stream, 10)

    expect(result).toEqual({
      ok: false,
      errorText: 'El proveedor no emitió chunks iniciales dentro de 10 ms',
    })
  })
})
