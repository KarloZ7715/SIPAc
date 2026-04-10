import { describe, expect, it } from 'vitest'
import {
  getChatCopyErrorFeedback,
  getChatCopySuccessFeedback,
  getChatHistoryWarningFeedback,
  getChatResponseErrorFeedback,
  getChatStopFeedback,
  getChatToolbarFeedback,
} from '~~/app/utils/chat-feedback'

describe('chat feedback copy', () => {
  it('expone mensajes claros para copiado y detención', () => {
    expect(getChatCopySuccessFeedback()).toEqual({
      title: 'Respuesta copiada',
      description: 'Ya puedes pegarla donde la necesites.',
    })

    expect(getChatCopyErrorFeedback()).toEqual({
      title: 'No pudimos copiar la respuesta',
      description: 'Inténtalo de nuevo o copia el texto manualmente.',
    })

    expect(getChatStopFeedback()).toEqual({
      title: 'Respuesta detenida',
      description: 'Se conservó el texto generado hasta este punto.',
    })
  })
})

describe('chat feedback error normalization', () => {
  it('normaliza errores serializados como JSON', () => {
    const feedback = getChatResponseErrorFeedback(
      new Error(
        JSON.stringify({
          statusCode: 429,
          data: {
            error: {
              message: 'Too many requests',
            },
          },
        }),
      ),
    )

    expect(feedback).toEqual({
      title: 'Hay demasiadas solicitudes en este momento',
      description: 'Espera unos segundos y vuelve a intentarlo.',
    })
  })

  it('traduce fallos de conexión a texto user-first', () => {
    expect(getChatResponseErrorFeedback(new TypeError('Failed to fetch'))).toEqual({
      title: 'Se perdió la conexión mientras respondía',
      description: 'Revisa tu conexión y vuelve a intentarlo.',
    })
  })

  it('devuelve una advertencia simple para historial no disponible', () => {
    expect(getChatHistoryWarningFeedback(new Error('Internal server error'))).toEqual({
      title: 'No se pudo recuperar esta conversación',
      description:
        'Abrí una sesión nueva para que puedas seguir. Si necesitas el historial, recarga la página o inténtalo más tarde.',
    })
  })

  it('conserva el mensaje específico de sesión inválida al recuperar historial', () => {
    expect(
      getChatHistoryWarningFeedback({
        statusCode: 401,
        message: 'Unauthorized',
      }),
    ).toEqual({
      title: 'Tu sesión ya no es válida',
      description: 'Recarga la página e inicia sesión de nuevo para recuperar tus conversaciones.',
    })
  })
})

describe('chat toolbar feedback', () => {
  it('muestra estados claros para listo, error y respuesta detenida', () => {
    expect(getChatToolbarFeedback('ready')).toEqual({
      color: 'success',
      label: 'Listo',
    })

    expect(getChatToolbarFeedback('error')).toEqual({
      color: 'error',
      label: 'Hubo un problema',
    })

    expect(getChatToolbarFeedback('ready', true)).toEqual({
      color: 'warning',
      label: 'Respuesta detenida',
    })
  })
})
