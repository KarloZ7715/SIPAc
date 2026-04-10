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
  it('accepts a text chunk as a successful probe', async () => {
    const stream = new ReadableStream<InferUIMessageChunk<MinimalMessage>>({
      start(controller) {
        controller.enqueue(chunk('text-start', { id: 'txt-1' }))
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

  it('fails when stream closes without useful content', async () => {
    const stream = new ReadableStream<InferUIMessageChunk<MinimalMessage>>({
      start(controller) {
        controller.close()
      },
    })

    const result = await probeUiMessageStream(stream, 25)

    expect(result).toEqual({
      ok: false,
      errorText: 'El proveedor finalizó el stream sin contenido útil',
    })
  })

  it('should NOT consider the stream successful when a reasoning-start is immediately followed by an error', async () => {
    const stream = new ReadableStream<InferUIMessageChunk<MinimalMessage>>({
      start(controller) {
        controller.enqueue(chunk('reasoning-start', { messageId: 'msg-2' }))
        controller.enqueue(chunk('error', { errorText: 'early failure' }))
      },
    })

    const result = await probeUiMessageStream(stream, 50)

    expect(result).toEqual({ ok: false, errorText: 'early failure' })
  })
})
