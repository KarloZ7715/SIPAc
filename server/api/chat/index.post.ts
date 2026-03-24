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

function extractLatestUserMessage(messages: ChatUiMessage[]) {
  return [...messages].reverse().find((message) => message.role === 'user')
}

function createChatTools() {
  const executeRepositorySearchTool = createRepositorySearchToolExecutor()

  return {
    searchRepositoryProducts: tool({
      description:
        'Recupera evidencia grounded del repositorio confirmado usando filtros estructurados, ampliación diagnóstica controlada y texto OCR/nativo cuando haga falta.',
      inputSchema: chatSearchToolInputSchema,
      execute: executeRepositorySearchTool,
    }),
  }
}

async function buildCandidateUiStream(
  candidate: StructuredModelCandidate,
  messages: ChatUiMessage[],
  tools: ReturnType<typeof createChatTools>,
) {
  const result = streamText({
    model: candidate.model,
    system: buildChatSystemPrompt(),
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(2),
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
      return error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'Error desconocido del proveedor de chat'
    },
  })
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  enforceChatRateLimit(event, auth.sub)

  const rawBody = await readBody(event)
  const parsedBody = postChatBodySchema.safeParse(rawBody)

  if (!parsedBody.success) {
    throw createBadRequestError('La solicitud del chat no tiene el formato esperado')
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
      throw createBadRequestError('No se encontró el mensaje del usuario para procesar')
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
      let lastErrorText = 'No fue posible completar la respuesta del chat en este momento.'
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
      return 'No fue posible completar la respuesta del chat en este momento.'
    },
    onFinish: async ({ messages }) => {
      const savedConversation = await saveUserChatConversation({
        userId: auth.sub,
        chatId,
        messages: messages as ChatUiMessage[],
      })

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

  return createUIMessageStreamResponse({ stream })
})
