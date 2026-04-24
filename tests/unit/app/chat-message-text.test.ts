import { describe, expect, it } from 'vitest'
import {
  chatMessagePlainText,
  hasAssistantMessageAfterIndex,
  isStoppedAssistantMessage,
  markLastAssistantMessageStopped,
} from '~~/app/utils/chat-message-text'
import type { ChatUiMessage } from '~~/app/types'

describe('chatMessagePlainText', () => {
  it('concatena solo partes de texto', () => {
    const message: ChatUiMessage = {
      id: '1',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Hola' },
        { type: 'text', text: ' mundo' },
      ],
    }
    expect(chatMessagePlainText(message)).toBe('Hola\n\nmundo')
  })

  it('oculta bloques privados <think> al preparar texto para copiar', () => {
    const message: ChatUiMessage = {
      id: '1',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Inicio' },
        { type: 'text', text: '<think>cadena privada</think> Visible' },
      ],
    }

    expect(chatMessagePlainText(message)).toBe('Inicio\n\nVisible')
  })

  it('detecta cuando la última respuesta fue detenida', () => {
    const message: ChatUiMessage = {
      id: '1',
      role: 'assistant',
      metadata: {
        stoppedByUser: true,
      },
      parts: [{ type: 'text', text: 'Hola' }],
    }

    expect(isStoppedAssistantMessage(message)).toBe(true)
  })

  it('no marca como detenida una respuesta que terminó normal con finishReason=stop', () => {
    const message: ChatUiMessage = {
      id: '2',
      role: 'assistant',
      metadata: {
        finishReason: 'stop',
      },
      parts: [{ type: 'text', text: 'Respuesta completa' }],
    }

    expect(isStoppedAssistantMessage(message)).toBe(false)
  })

  it('marca solo el último mensaje del asistente como detenido', () => {
    const messages: ChatUiMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hola' }],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Primera respuesta' }],
      },
      {
        id: 'assistant-2',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Respuesta parcial' }],
      },
    ]

    const markedMessages = markLastAssistantMessageStopped(messages)

    expect(markedMessages[1]?.metadata?.stoppedByUser).toBeUndefined()
    expect(markedMessages[2]?.metadata?.stoppedByUser).toBe(true)
  })

  it('no marca respuestas anteriores si el aborto ocurre antes de que el asistente responda en el turno actual', () => {
    const messages: ChatUiMessage[] = [
      {
        id: 'assistant-prev',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Respuesta completa anterior' }],
      },
      {
        id: 'user-new',
        role: 'user',
        parts: [{ type: 'text', text: 'Nueva pregunta' }],
      },
    ]

    const markedMessages = markLastAssistantMessageStopped(messages)

    expect(markedMessages[0]?.metadata?.stoppedByUser).toBeUndefined()
  })

  it('detecta si existe una respuesta del asistente despues de un indice base', () => {
    const messages: ChatUiMessage[] = [
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
      {
        id: 'assistant-2',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Respuesta nueva parcial' }],
      },
    ]

    expect(hasAssistantMessageAfterIndex(messages, 1)).toBe(true)
    expect(hasAssistantMessageAfterIndex(messages, 2)).toBe(false)
  })
})
