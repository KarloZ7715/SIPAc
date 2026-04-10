import { describe, expect, it } from 'vitest'
import { tool, validateUIMessages } from 'ai'
import { chatSearchToolInputSchema } from '~~/server/services/chat/repository-search-tool'
import { sanitizeChatMessages } from '~~/server/services/chat/conversations'
import type { ChatUiMessage } from '~~/app/types'

describe('chat message sanitization and tool schema robustness', () => {
  it('strips tool part nulls and unknown keys so validateUIMessages accepts OpenRouter-style tool payloads', async () => {
    const tools = {
      searchRepositoryProducts: tool({
        inputSchema: chatSearchToolInputSchema,
        execute: async () => ({
          filters: { institution: 'X', productType: 'thesis', limit: 6 },
          total: 0,
          limitedTo: 6,
          results: [],
        }),
      }),
    }

    const messages: ChatUiMessage[] = [
      {
        id: 'assistant-tool',
        role: 'assistant',
        metadata: { createdAt: Date.now() },
        parts: [
          { type: 'step-start' },
          { type: 'text', text: 'Voy a buscar.', state: 'done' },
          {
            type: 'tool-searchRepositoryProducts',
            toolCallId: 'functions.searchRepositoryProducts:0',
            state: 'output-available',
            title: null,
            input: { question: '¿Qué hay?', productType: 'thesis' },
            output: { total: 0, limitedTo: 6, results: [] },
            rawInput: null,
            errorText: null,
            providerExecuted: null,
            preliminary: null,
          },
          { type: 'text', text: 'Listo.', state: 'done' },
        ],
      },
    ]

    const sanitized = sanitizeChatMessages(messages)
    await expect(
      validateUIMessages<ChatUiMessage>({ messages: sanitized, tools }),
    ).resolves.toHaveLength(1)

    const toolPart = sanitized[0]?.parts.find((p) => p.type === 'tool-searchRepositoryProducts')
    expect(toolPart && typeof toolPart === 'object' && 'title' in toolPart).toBe(false)
  })

  it('strips providerMetadata null so validateUIMessages accepts assistant text (multi-turn)', async () => {
    const tools = {
      searchRepositoryProducts: tool({
        inputSchema: chatSearchToolInputSchema,
        execute: async () => ({
          filters: { institution: 'X', productType: 'thesis', limit: 6 },
          total: 0,
          limitedTo: 6,
          results: [],
        }),
      }),
    }

    const messages: ChatUiMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hola!' }],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        metadata: {
          createdAt: Date.now(),
          provider: 'openrouter',
          model: 'minimax/minimax-m2.5:free',
        },
        parts: [
          { type: 'step-start' },
          {
            type: 'text',
            text: '¡Hola!',
            providerMetadata: null,
            state: 'done',
          },
        ],
      },
      {
        id: 'user-2',
        role: 'user',
        parts: [{ type: 'text', text: 'Segundo turno.' }],
      },
    ]

    const sanitized = sanitizeChatMessages(messages)
    const result = await validateUIMessages<ChatUiMessage>({ messages: sanitized, tools })

    expect(result).toHaveLength(3)
    const textPart = result[1]?.parts.find((p) => p.type === 'text')
    expect(textPart?.type).toBe('text')
    if (textPart?.type === 'text') {
      expect('providerMetadata' in textPart ? textPart.providerMetadata : undefined).toBeUndefined()
    }
  })

  it('does not fail when persisted messages include transient parts (reasoning-start, step-start)', async () => {
    const tools = {
      searchRepositoryProducts: tool({
        inputSchema: chatSearchToolInputSchema,
        execute: async () => ({
          filters: { institution: 'X', productType: 'thesis', limit: 6 },
          total: 0,
          limitedTo: 6,
          results: [],
        }),
      }),
    }

    const messages: ChatUiMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Busca tesis' }],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        metadata: { createdAt: Date.now() },
        parts: [
          { type: 'reasoning-start' },
          { type: 'step-start' },
          {
            type: 'tool-searchRepositoryProducts',
            toolCallId: 'tool-1',
            state: 'output-available',
            input: {
              question: 'Busca tesis asociadas a X',
              institution: 'X',
            },
            output: {
              filters: { institution: 'X', productType: 'thesis', limit: 6 },
              total: 0,
              limitedTo: 6,
              results: [],
            },
          },
          { type: 'text', text: 'Resultado final', state: 'done' },
        ],
      },
    ]

    const sanitizedMessages = sanitizeChatMessages(messages)

    // The important assertion for this test is that validation does not throw
    const result = await validateUIMessages<ChatUiMessage>({ messages: sanitizedMessages, tools })

    expect(result).toHaveLength(2)
    // The persisted tool part must still be present after validation
    expect(result[1]?.parts.some((p) => p.type === 'tool-searchRepositoryProducts')).toBe(true)
  })

  it('handles tool input where model provided limit > 8 without crashing validation', async () => {
    const tools = {
      searchRepositoryProducts: tool({
        inputSchema: chatSearchToolInputSchema,
        execute: async () => ({
          filters: { institution: 'X', productType: 'thesis', limit: 8 },
          total: 0,
          limitedTo: 8,
          results: [],
        }),
      }),
    }

    const messages: ChatUiMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-searchRepositoryProducts',
            toolCallId: 'tool-1',
            state: 'output-available',
            input: {
              question: 'Busca tesis',
              institution: 'X',
              limit: 20, // model supplied an out-of-range limit
            },
            output: {
              filters: { institution: 'X', productType: 'thesis', limit: 20 },
              total: 0,
              limitedTo: 20,
              results: [],
            },
          },
        ],
      },
    ]

    const sanitizedMessages = sanitizeChatMessages(messages)

    const result = await validateUIMessages<ChatUiMessage>({ messages: sanitizedMessages, tools })

    expect(result).toHaveLength(1)
    expect(result[0]?.parts[0]?.type).toBe('tool-searchRepositoryProducts')
  })

  it('allows tool schema parsing for high limits so runtime clamping can apply downstream', () => {
    const parsed = chatSearchToolInputSchema.parse({
      question: 'Busca artículos recientes sobre IA educativa',
      limit: 20,
    })

    expect(parsed.limit).toBe(20)
  })

  it('coerces numeric string limits from persisted tool parts into bounded numeric limits', () => {
    const messages: ChatUiMessage[] = [
      {
        id: 'assistant-2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-searchRepositoryProducts',
            toolCallId: 'tool-2',
            state: 'output-available',
            input: {
              question: 'Busca tesis',
              institution: 'X',
              limit: '20' as unknown as number,
            },
            output: {
              filters: { institution: 'X', productType: 'thesis', limit: 20 },
              total: 0,
              limitedTo: 20,
              results: [],
            },
          },
        ],
      },
    ]

    const sanitizedMessages = sanitizeChatMessages(messages)
    const toolPart = sanitizedMessages[0]?.parts[0]

    expect(toolPart?.type).toBe('tool-searchRepositoryProducts')
    if (toolPart?.type === 'tool-searchRepositoryProducts') {
      expect(toolPart.input.limit).toBe(8)
    }
  })

  it('drops legacy top-level reasoning fields from persisted assistant messages', () => {
    const messages = [
      {
        id: 'assistant-legacy',
        role: 'assistant',
        reasoning: 'cadena de razonamiento legacy',
        reasoning_content: 'legacy field rejected by some providers',
        parts: [{ type: 'text', text: 'Respuesta previa' }],
      },
    ] as unknown as ChatUiMessage[]

    const sanitizedMessages = sanitizeChatMessages(messages)
    const first = sanitizedMessages[0] as Record<string, unknown>

    expect(first.reasoning).toBeUndefined()
    expect(first.reasoning_content).toBeUndefined()
  })
})
