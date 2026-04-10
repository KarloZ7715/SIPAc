export interface ChatToastFeedback {
  title: string
  description: string
}

export interface ChatToolbarFeedback {
  color: 'success' | 'warning' | 'error'
  label: string
}

type ParsedChatError = {
  message: string
  statusCode?: number
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function tryParseJson(value: string): unknown {
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

function extractMessageFromRecord(record: Record<string, unknown> | null): string | undefined {
  if (!record) {
    return undefined
  }

  const nestedData = asRecord(record.data)
  const nestedError = asRecord(record.error)
  const nestedDataError = asRecord(nestedData?.error)

  return (
    (typeof nestedDataError?.message === 'string' && nestedDataError.message) ||
    (typeof nestedError?.message === 'string' && nestedError.message) ||
    (typeof nestedData?.message === 'string' && nestedData.message) ||
    (typeof record.statusMessage === 'string' && record.statusMessage) ||
    (typeof record.message === 'string' && record.message) ||
    undefined
  )
}

function extractStatusCodeFromRecord(record: Record<string, unknown> | null): number | undefined {
  if (!record) {
    return undefined
  }

  const nestedData = asRecord(record.data)
  const candidates = [record.statusCode, nestedData?.statusCode]

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate
    }
  }

  return undefined
}

function parseChatError(error: unknown): ParsedChatError {
  if (error instanceof Error) {
    const parsed = tryParseJson(error.message)
    const parsedRecord = asRecord(parsed)
    const parsedMessage = extractMessageFromRecord(parsedRecord)
    const directRecord = asRecord(error)

    return {
      message:
        parsedMessage ??
        extractMessageFromRecord(directRecord) ??
        error.message ??
        'No pude completar la respuesta.',
      statusCode:
        extractStatusCodeFromRecord(parsedRecord) ?? extractStatusCodeFromRecord(directRecord),
    }
  }

  const record = asRecord(error)
  if (record) {
    return {
      message: extractMessageFromRecord(record) ?? 'No pude completar la respuesta.',
      statusCode: extractStatusCodeFromRecord(record),
    }
  }

  return { message: 'No pude completar la respuesta.' }
}

function normalizeChatErrorMessage(message: string, statusCode?: number): ChatToastFeedback {
  const normalizedMessage = message.trim()
  const lowerMessage = normalizedMessage.toLowerCase()

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    /\bunauthorized\b|\bauth\b|api key|autenticaci[óo]n/i.test(lowerMessage)
  ) {
    return {
      title: 'El chat no está disponible en este momento',
      description: 'Prueba con otro modelo o avisa al administrador para revisar la configuración.',
    }
  }

  if (statusCode === 429 || /rate limit|too many requests|quota|cuota/i.test(lowerMessage)) {
    return {
      title: 'Hay demasiadas solicitudes en este momento',
      description: 'Espera unos segundos y vuelve a intentarlo.',
    }
  }

  if (/fetch|network|conexion|conexión|disconnect|timed out|timeout/i.test(lowerMessage)) {
    return {
      title: 'Se perdió la conexión mientras respondía',
      description: 'Revisa tu conexión y vuelve a intentarlo.',
    }
  }

  if (/formato esperado|mensaje del usuario/i.test(lowerMessage) || statusCode === 400) {
    return {
      title: 'No pudimos procesar tu mensaje',
      description:
        'Recarga la página y vuelve a enviarlo. Si pasa otra vez, prueba con un mensaje más corto.',
    }
  }

  if (/guardrail restrictions|data policy|privacy/i.test(lowerMessage)) {
    return {
      title: 'Ese modelo no está disponible con la configuración actual',
      description: 'Elige otro modelo y vuelve a intentarlo.',
    }
  }

  if (
    /bad request|modelo/i.test(lowerMessage) &&
    /nvidia|openrouter|groq|gemini|cerebras/i.test(lowerMessage)
  ) {
    return {
      title: 'Ese modelo no pudo completar la solicitud',
      description: 'Prueba con otro modelo o reformula la pregunta.',
    }
  }

  return {
    title: 'No pude completar la respuesta',
    description: 'Intenta de nuevo en unos segundos. Si se repite, cambia de modelo.',
  }
}

export function getChatResponseErrorFeedback(error: unknown): ChatToastFeedback {
  const parsed = parseChatError(error)
  return normalizeChatErrorMessage(parsed.message, parsed.statusCode)
}

export function getChatHistoryWarningFeedback(error: unknown): ChatToastFeedback {
  const parsed = parseChatError(error)

  if (parsed.statusCode === 401 || parsed.statusCode === 403) {
    return {
      title: 'Tu sesión ya no es válida',
      description: 'Recarga la página e inicia sesión de nuevo para recuperar tus conversaciones.',
    }
  }

  return {
    title: 'No se pudo recuperar esta conversación',
    description:
      'Abrí una sesión nueva para que puedas seguir. Si necesitas el historial, recarga la página o inténtalo más tarde.',
  }
}

export function getChatToolbarFeedback(
  status: string,
  lastResponseStopped = false,
): ChatToolbarFeedback {
  if (status === 'error') {
    return {
      color: 'error',
      label: 'Hubo un problema',
    }
  }

  if (lastResponseStopped) {
    return {
      color: 'warning',
      label: 'Respuesta detenida',
    }
  }

  if (status === 'ready') {
    return {
      color: 'success',
      label: 'Listo',
    }
  }

  return {
    color: 'warning',
    label: 'Procesando',
  }
}

export function getChatStopFeedback(): ChatToastFeedback {
  return {
    title: 'Respuesta detenida',
    description: 'Se conservó el texto generado hasta este punto.',
  }
}

export function getChatCopySuccessFeedback(): ChatToastFeedback {
  return {
    title: 'Respuesta copiada',
    description: 'Ya puedes pegarla donde la necesites.',
  }
}

export function getChatCopyErrorFeedback(): ChatToastFeedback {
  return {
    title: 'No pudimos copiar la respuesta',
    description: 'Inténtalo de nuevo o copia el texto manualmente.',
  }
}
