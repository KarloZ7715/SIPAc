import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  createIdGenerator,
  stepCountIs,
  streamText,
  tool,
  validateUIMessages,
} from 'ai'
import { z } from 'zod'
import type { ChatModelSelection, ChatUiMessage } from '~~/app/types'
import { logAudit } from '~~/server/utils/audit'
import { enforceChatRateLimit } from '~~/server/utils/chat-rate-limit'
import { createBadRequestError } from '~~/server/utils/errors'
import {
  getUserChatConversation,
  sanitizeChatMessages,
  saveUserChatConversation,
} from '~~/server/services/chat/conversations'
import { resolveChatModelCandidates } from '~~/server/services/chat/model-selection'
import {
  buildChatSystemPrompt,
  createRepositorySearchToolExecutor,
  chatSearchToolInputSchema,
} from '~~/server/services/chat/repository-search-tool'
import { probeUiMessageStream } from '~~/server/services/chat/stream-probe'
import type { StructuredModelCandidate } from '~~/server/services/llm/provider'
import { markLastAssistantMessageStopped } from '~~/app/utils/chat-message-text'

const postChatBodySchema = z.object({
  id: z.string().trim().min(1).max(120),
  messages: z.array(z.unknown()).default([]),
  trigger: z.enum(['submit-message', 'regenerate-message']).optional(),
  messageId: z.string().trim().min(1).max(120).optional(),
  selectedModel: z
    .object({
      provider: z.enum(['cerebras', 'gemini', 'groq', 'openrouter', 'nvidia']),
      modelId: z.string().trim().min(1).max(160),
    })
    .optional(),
})

const CHAT_MAX_STEPS = 3

function extractLatestUserMessage(messages: ChatUiMessage[]) {
  return [...messages].reverse().find((message) => message.role === 'user')
}

function createChatTools() {
  const executeRepositorySearchTool = createRepositorySearchToolExecutor()

  return {
    searchRepositoryProducts: tool({
      description:
        'Busca documentos confirmados del repositorio compartido de SIPAc con filtros (autor, título, institución, tipo, fechas, palabras clave). Si no hay coincidencias exactas, amplía la búsqueda de forma controlada y, si aplica, revisa el texto extraído de los PDF.',
      inputSchema: chatSearchToolInputSchema,
      execute: executeRepositorySearchTool,
    }),
  }
}

async function consumeUiMessageSseStream(input: { stream: ReadableStream<string> }) {
  const reader = input.stream.getReader()

  try {
    while (true) {
      const { done } = await reader.read()
      if (done) {
        break
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function formatProviderErrorMessage(candidate: StructuredModelCandidate, error: unknown) {
  const rawMessage = error instanceof Error && error.message.trim().length > 0 ? error.message : ''

  if (
    candidate.name === 'openrouter' &&
    /user not found|invalid api key|unauthorized|401/i.test(rawMessage)
  ) {
    return 'El servicio de IA no está disponible por un problema de configuración. Prueba con otro modelo o avisa al administrador.'
  }

  if (
    candidate.name === 'openrouter' &&
    /no endpoints available matching your guardrail restrictions and data policy/i.test(rawMessage)
  ) {
    return 'Ese modelo no está disponible con la configuración actual. Elige otro modelo y vuelve a intentarlo.'
  }

  if (candidate.name === 'nvidia' && /bad request/i.test(rawMessage)) {
    return 'Ese modelo no pudo procesar tu solicitud. Prueba con otro modelo o reformula la pregunta.'
  }

  return 'No pude completar la respuesta con ese modelo. Intenta de nuevo en unos segundos o cambia de modelo.'
}

function stripReasoningForGroqGptOss120b(messages: ChatUiMessage[]): ChatUiMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    metadata: message.metadata,
    parts: message.parts.filter(
      (part) => !(part.type === 'reasoning' || part.type.startsWith('reasoning-')),
    ),
  }))
}

async function buildCandidateUiStream(
  candidate: StructuredModelCandidate,
  messages: ChatUiMessage[],
  tools: ReturnType<typeof createChatTools>,
) {
  const candidateMessages =
    candidate.name === 'groq' && candidate.modelId.includes('gpt-oss-120b')
      ? stripReasoningForGroqGptOss120b(messages)
      : messages

  const baseModelMessages = await convertToModelMessages(candidateMessages)
  const modelMessages =
    candidate.name === 'groq'
      ? baseModelMessages.map((message) => {
          if (message.role !== 'assistant') {
            return message
          }

          const sanitizedMessage = { ...message } as Record<string, unknown>
          delete sanitizedMessage.reasoning_content
          delete sanitizedMessage.reasoning

          return sanitizedMessage as (typeof baseModelMessages)[number]
        })
      : baseModelMessages

  const result = streamText({
    model: candidate.model,
    system: buildChatSystemPrompt(),
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(CHAT_MAX_STEPS),
    temperature: 0.2,
  })

  return result.toUIMessageStream<ChatUiMessage>({
    messageMetadata: ({ part }) => {
      if (part.type === 'start') {
        return {
          createdAt: Date.now(),
          provider: candidate.name,
          model: candidate.modelId,
        }
      }

      if (part.type === 'finish') {
        return {
          finishReason: part.finishReason,
          totalTokens: part.totalUsage.totalTokens,
        }
      }
    },
    onError: (error) => {
      console.error(
        `[Chat] Error al generar respuesta con ${candidate.name}/${candidate.modelId}:`,
        error,
      )
      return formatProviderErrorMessage(candidate, error)
    },
  })
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  await enforceChatRateLimit(event, auth.sub)

  const rawBody = await readBody(event)
  const parsedBody = postChatBodySchema.safeParse(rawBody)

  if (!parsedBody.success) {
    throw createBadRequestError(
      'No pudimos enviar el mensaje porque la solicitud llegó incompleta. Recarga la página y vuelve a intentarlo.',
    )
  }

  const { id: chatId, trigger, selectedModel } = parsedBody.data
  const incomingMessages = sanitizeChatMessages(parsedBody.data.messages as ChatUiMessage[])

  const existingConversation = await getUserChatConversation(auth.sub, chatId)
  const persistedMessages = sanitizeChatMessages(
    (existingConversation?.messages as ChatUiMessage[] | undefined) ?? [],
  )

  let messagesForProcessing = persistedMessages

  if (trigger === 'submit-message' || !trigger) {
    const latestUserMessage = extractLatestUserMessage(incomingMessages)
    if (!latestUserMessage) {
      throw createBadRequestError(
        'No encontramos el mensaje que querías enviar. Vuelve a escribirlo e inténtalo de nuevo.',
      )
    }

    messagesForProcessing =
      persistedMessages.length > 0
        ? sanitizeChatMessages([...persistedMessages, latestUserMessage])
        : incomingMessages
  }

  const tools = createChatTools()

  const validatedMessages = (await validateUIMessages({
    messages: messagesForProcessing,
    tools,
  })) as ChatUiMessage[]
  const selectedCandidates = resolveChatModelCandidates(
    selectedModel as ChatModelSelection | undefined,
  )

  const generateMessageId = createIdGenerator({
    prefix: 'chatmsg',
    size: 16,
  })

  const stream = createUIMessageStream<ChatUiMessage>({
    originalMessages: validatedMessages,
    generateId: generateMessageId,
    execute: async ({ writer }) => {
      const startedAt = Date.now()
      let lastErrorText =
        'No pude completar la respuesta en este momento. Intenta de nuevo en unos segundos.'
      let fallbackCount = 0

      for (const candidate of selectedCandidates) {
        const candidateStream = await buildCandidateUiStream(candidate, validatedMessages, tools)
        const probe = await probeUiMessageStream(candidateStream)

        if (probe.ok) {
          console.info(
            `[Chat] Stream iniciado con ${candidate.name}/${candidate.modelId} en ${Date.now() - startedAt} ms tras ${fallbackCount} fallback(s)`,
          )
          writer.merge(probe.stream)
          return
        }

        lastErrorText = probe.errorText
        fallbackCount += 1
        void candidateStream.cancel(probe.errorText).catch(() => {})
        console.warn(
          `[Chat] Fallback activado tras fallo de ${candidate.name}/${candidate.modelId}: ${probe.errorText}`,
        )
      }

      writer.write({
        type: 'error',
        errorText: lastErrorText,
      })
    },
    onError: (error) => {
      console.error('[Chat] Error al generar respuesta:', error)
      return 'No pude completar la respuesta en este momento. Intenta de nuevo en unos segundos.'
    },
    onFinish: async ({ messages, isAborted }) => {
      const finalMessages = isAborted
        ? markLastAssistantMessageStopped(messages as ChatUiMessage[])
        : (messages as ChatUiMessage[])

      const savedConversation = await saveUserChatConversation({
        userId: auth.sub,
        chatId,
        messages: finalMessages,
      })

      if (isAborted) {
        console.info(
          `[Chat] Stream abortado; conversación ${chatId} persistida con el estado disponible`,
        )
      }

      if (!existingConversation) {
        await logAudit(event, {
          userId: auth.sub,
          userName: auth.email,
          action: 'create',
          resource: 'chat_conversation',
          resourceId: savedConversation?._id,
          details: `Conversación de chat creada: ${chatId}`,
        })
      }
    },
  })

  return createUIMessageStreamResponse({
    stream,
    consumeSseStream: consumeUiMessageSseStream,
  })
})
