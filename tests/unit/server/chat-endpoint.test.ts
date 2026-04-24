import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatUiMessage } from '~~/app/types'

const harness = vi.hoisted(() => ({
  runExecute: false,
  finishIsAborted: false,
  finishMessages: [] as ChatUiMessage[],
  probeResults: [] as Array<{ ok: boolean; stream?: unknown; errorText?: string }>,
  lifecyclePromise: Promise.resolve(),
  writerWriteMock: vi.fn(),
  writerMergeMock: vi.fn(),
}))

const mocks = vi.hoisted(() => ({
  enforceChatRateLimitMock: vi.fn(),
  logAuditMock: vi.fn(),
  createBadRequestErrorMock: vi.fn((message: string) => {
    const error = new Error(message)
    Object.assign(error, { statusCode: 400 })
    return error
  }),
  getUserChatConversationMock: vi.fn(),
  sanitizeChatMessagesMock: vi.fn((messages: ChatUiMessage[]) => messages),
  saveUserChatConversationMock: vi.fn(),
  resolveChatModelCandidatesMock: vi.fn(),
  buildChatSystemPromptMock: vi.fn(() => 'system prompt'),
  createRepositorySearchToolExecutorMock: vi.fn(() => vi.fn()),
  extractLatestIncomingUserMessageMock: vi.fn(),
  isIncomingUserMessageWithinLimitsMock: vi.fn(),
  probeUiMessageStreamMock: vi.fn(
    async () =>
      harness.probeResults.shift() ?? {
        ok: true,
        stream: { cancel: vi.fn().mockResolvedValue(undefined) },
      },
  ),
  validateUIMessagesMock: vi.fn(async ({ messages }: { messages: ChatUiMessage[] }) => messages),
  convertToModelMessagesMock: vi.fn(async (messages: ChatUiMessage[]) => messages),
  streamTextMock: vi.fn(),
  createUIMessageStreamMock: vi.fn(),
  createUIMessageStreamResponseMock: vi.fn(({ stream }: { stream: unknown }) => ({ stream })),
  createIdGeneratorMock: vi.fn(() => () => 'chatmsg_1'),
  stepCountIsMock: vi.fn(),
  toolMock: vi.fn((definition: unknown) => definition),
}))

vi.mock('~~/server/utils/chat-rate-limit', () => ({
  enforceChatRateLimit: mocks.enforceChatRateLimitMock,
}))

vi.mock('~~/server/utils/audit', () => ({
  logAudit: mocks.logAuditMock,
}))

vi.mock('~~/server/utils/errors', () => ({
  createBadRequestError: mocks.createBadRequestErrorMock,
}))

vi.mock('~~/server/services/chat/conversations', () => ({
  getUserChatConversation: mocks.getUserChatConversationMock,
  sanitizeChatMessages: mocks.sanitizeChatMessagesMock,
  saveUserChatConversation: mocks.saveUserChatConversationMock,
}))

vi.mock('~~/server/services/chat/model-selection', () => ({
  resolveChatModelCandidates: mocks.resolveChatModelCandidatesMock,
}))

vi.mock('~~/server/services/chat/repository-search-tool', () => ({
  buildChatSystemPrompt: mocks.buildChatSystemPromptMock,
  createRepositorySearchToolExecutor: mocks.createRepositorySearchToolExecutorMock,
  chatSearchToolInputSchema: {},
}))

vi.mock('~~/server/services/chat/incoming-message', () => ({
  CHAT_MAX_INCOMING_MESSAGES: 240,
  extractLatestIncomingUserMessage: mocks.extractLatestIncomingUserMessageMock,
  isIncomingUserMessageWithinLimits: mocks.isIncomingUserMessageWithinLimitsMock,
}))

vi.mock('~~/server/services/chat/stream-probe', () => ({
  probeUiMessageStream: mocks.probeUiMessageStreamMock,
}))

vi.mock('ai', () => ({
  createUIMessageStream: mocks.createUIMessageStreamMock,
  createUIMessageStreamResponse: mocks.createUIMessageStreamResponseMock,
  convertToModelMessages: mocks.convertToModelMessagesMock,
  createIdGenerator: mocks.createIdGeneratorMock,
  stepCountIs: mocks.stepCountIsMock,
  streamText: mocks.streamTextMock,
  tool: mocks.toolMock,
  validateUIMessages: mocks.validateUIMessagesMock,
}))

function makeEvent(body: unknown) {
  const req = new EventEmitter() as EventEmitter & {
    destroyed?: boolean
  }
  const res = new EventEmitter() as EventEmitter & {
    writableEnded?: boolean
    writableFinished?: boolean
  }
  res.writableEnded = false
  res.writableFinished = false

  return {
    body,
    node: {
      req,
      res,
    },
  }
}

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    harness.runExecute = false
    harness.finishIsAborted = false
    harness.finishMessages = []
    harness.probeResults = []
    harness.lifecyclePromise = Promise.resolve()
    harness.writerWriteMock.mockReset()
    harness.writerMergeMock.mockReset()

    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('requireAuth', () => ({ sub: 'user-1', email: 'test@sipac.test' }))
    vi.stubGlobal('readBody', async (event: { body?: unknown }) => event.body)

    mocks.getUserChatConversationMock.mockResolvedValue({ messages: [] })
    mocks.resolveChatModelCandidatesMock.mockReturnValue([])
    mocks.extractLatestIncomingUserMessageMock.mockReturnValue({
      id: 'incoming-user',
      role: 'user',
      parts: [{ type: 'text', text: 'Consulta' }],
    })
    mocks.isIncomingUserMessageWithinLimitsMock.mockReturnValue(true)
    mocks.saveUserChatConversationMock.mockResolvedValue({ _id: 'chat-doc-id' })

    mocks.createUIMessageStreamMock.mockImplementation(
      (options: {
        execute: (payload: {
          writer: { write: typeof harness.writerWriteMock; merge: typeof harness.writerMergeMock }
        }) => Promise<void>
        onFinish: (payload: { messages: ChatUiMessage[]; isAborted: boolean }) => Promise<void>
      }) => {
        harness.lifecyclePromise = (async () => {
          if (harness.runExecute) {
            await options.execute({
              writer: {
                write: harness.writerWriteMock,
                merge: harness.writerMergeMock,
              },
            })
          }

          await options.onFinish({
            messages: harness.finishMessages,
            isAborted: harness.finishIsAborted,
          })
        })()

        return { kind: 'mock-ui-stream' }
      },
    )

    mocks.streamTextMock.mockImplementation(() => ({
      toUIMessageStream: vi.fn(() => ({
        cancel: vi.fn().mockResolvedValue(undefined),
      })),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('no marca respuestas historicas al abortar un regenerate sin nueva respuesta del turno actual', async () => {
    const persistedMessages: ChatUiMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Pregunta anterior' }],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Respuesta anterior' }],
      },
    ]

    mocks.getUserChatConversationMock.mockResolvedValue({ messages: persistedMessages })
    harness.finishIsAborted = true
    harness.finishMessages = persistedMessages

    const { default: handler } = await import('~~/server/api/chat/index.post')

    await handler(
      makeEvent({
        id: 'chat-1',
        trigger: 'regenerate-message',
        messages: [],
      }) as never,
    )
    await harness.lifecyclePromise

    const persistedPayload = mocks.saveUserChatConversationMock.mock.calls[0]?.[0] as {
      messages: ChatUiMessage[]
    }

    expect(persistedPayload.messages[1]?.metadata?.stoppedByUser).toBeUndefined()
  })

  it('marca solo la nueva respuesta del turno actual cuando el stream aborta tras generar asistente', async () => {
    const persistedMessages: ChatUiMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Pregunta anterior' }],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Respuesta anterior' }],
      },
    ]

    const generatedMessages: ChatUiMessage[] = [
      ...persistedMessages,
      {
        id: 'assistant-2',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Respuesta nueva parcial' }],
      },
    ]

    mocks.getUserChatConversationMock.mockResolvedValue({ messages: persistedMessages })
    harness.finishIsAborted = true
    harness.finishMessages = generatedMessages

    const { default: handler } = await import('~~/server/api/chat/index.post')

    await handler(
      makeEvent({
        id: 'chat-1',
        trigger: 'regenerate-message',
        messages: [],
      }) as never,
    )
    await harness.lifecyclePromise

    const persistedPayload = mocks.saveUserChatConversationMock.mock.calls[0]?.[0] as {
      messages: ChatUiMessage[]
    }

    expect(persistedPayload.messages[1]?.metadata?.stoppedByUser).toBeUndefined()
    expect(persistedPayload.messages[2]?.metadata?.stoppedByUser).toBe(true)
  })

  it('aplica fallback entre candidatos y persiste el resultado final del stream', async () => {
    const persistedMessages: ChatUiMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Pregunta' }],
      },
    ]

    const finalMessages: ChatUiMessage[] = [
      ...persistedMessages,
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Respuesta final' }],
      },
    ]

    const firstCandidateStream = {
      cancel: vi.fn().mockResolvedValue(undefined),
    }
    const secondCandidateStream = {
      cancel: vi.fn().mockResolvedValue(undefined),
    }
    const successfulProbeStream = { cancel: vi.fn().mockResolvedValue(undefined) }

    let streamBuildCount = 0
    mocks.streamTextMock.mockImplementation(() => ({
      toUIMessageStream: vi.fn(() => {
        streamBuildCount += 1
        return streamBuildCount === 1 ? firstCandidateStream : secondCandidateStream
      }),
    }))

    mocks.resolveChatModelCandidatesMock.mockReturnValue([
      { name: 'openrouter', modelId: 'm1', model: {} },
      { name: 'gemini', modelId: 'm2', model: {} },
    ])
    mocks.getUserChatConversationMock.mockResolvedValue({ messages: persistedMessages })

    harness.runExecute = true
    harness.finishIsAborted = false
    harness.finishMessages = finalMessages
    harness.probeResults = [
      { ok: false, errorText: 'timeout' },
      { ok: true, stream: successfulProbeStream },
    ]

    const { default: handler } = await import('~~/server/api/chat/index.post')

    await handler(
      makeEvent({
        id: 'chat-1',
        trigger: 'regenerate-message',
        messages: [],
      }) as never,
    )
    await harness.lifecyclePromise

    expect(firstCandidateStream.cancel).toHaveBeenCalledWith('timeout')
    expect(harness.writerMergeMock).toHaveBeenCalledWith(successfulProbeStream)
    expect(mocks.saveUserChatConversationMock).toHaveBeenCalledWith({
      userId: 'user-1',
      chatId: 'chat-1',
      messages: finalMessages,
    })
  })

  it('reintenta persistencia una vez cuando la primera escritura falla', async () => {
    const persistedMessages: ChatUiMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Pregunta' }],
      },
    ]

    const finalMessages: ChatUiMessage[] = [
      ...persistedMessages,
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Respuesta final' }],
      },
    ]

    mocks.getUserChatConversationMock.mockResolvedValue({ messages: persistedMessages })
    mocks.saveUserChatConversationMock
      .mockRejectedValueOnce(new Error('transient-db-error'))
      .mockResolvedValueOnce({ _id: 'chat-doc-id' })

    harness.finishIsAborted = false
    harness.finishMessages = finalMessages

    const { default: handler } = await import('~~/server/api/chat/index.post')

    await handler(
      makeEvent({
        id: 'chat-1',
        trigger: 'regenerate-message',
        messages: [],
      }) as never,
    )
    await harness.lifecyclePromise

    expect(mocks.saveUserChatConversationMock).toHaveBeenCalledTimes(2)
    expect(mocks.saveUserChatConversationMock).toHaveBeenLastCalledWith({
      userId: 'user-1',
      chatId: 'chat-1',
      messages: finalMessages,
    })
  })

  it('rechaza payloads con mensaje de usuario que excede limites de texto', async () => {
    mocks.isIncomingUserMessageWithinLimitsMock.mockReturnValue(false)

    const { default: handler } = await import('~~/server/api/chat/index.post')

    await expect(
      handler(
        makeEvent({
          id: 'chat-1',
          trigger: 'submit-message',
          messages: [
            {
              id: 'user-oversized',
              role: 'user',
              parts: [{ type: 'text', text: 'x'.repeat(50_000) }],
            },
          ],
        }) as never,
      ),
    ).rejects.toMatchObject({ statusCode: 400 })

    expect(mocks.saveUserChatConversationMock).not.toHaveBeenCalled()
  })

  it('rechaza payloads con demasiados mensajes en la solicitud', async () => {
    const { default: handler } = await import('~~/server/api/chat/index.post')

    await expect(
      handler(
        makeEvent({
          id: 'chat-1',
          trigger: 'submit-message',
          messages: Array.from({ length: 241 }, (_, index) => ({
            id: `msg-${index}`,
            role: 'user',
            parts: [{ type: 'text', text: 'x' }],
          })),
        }) as never,
      ),
    ).rejects.toMatchObject({ statusCode: 400 })

    expect(mocks.createUIMessageStreamMock).not.toHaveBeenCalled()
  })
})
