import { H3Error, createError } from 'h3'
import type { ZodError } from 'zod'

export class AppError extends H3Error {
  code: string

  constructor(message: string, statusCode: number, code: string) {
    super(message)
    this.statusCode = statusCode
    this.code = code
  }
}

export function createValidationError(error: ZodError) {
  const details = error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }))

  return createError({
    statusCode: 400,
    message: 'Datos de entrada inválidos',
    data: {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Los datos enviados no son válidos',
        details,
      },
    },
  })
}

export function createBadRequestError(message: string, details?: unknown) {
  return createError({
    statusCode: 400,
    message,
    data: {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
  })
}

export function createAuthenticationError(message = 'Credenciales inválidas') {
  return createError({
    statusCode: 401,
    message,
    data: {
      success: false,
      error: { code: 'AUTHENTICATION_ERROR', message },
    },
  })
}

export function createAuthorizationError(message = 'No tienes permisos para esta acción') {
  return createError({
    statusCode: 403,
    message,
    data: {
      success: false,
      error: { code: 'AUTHORIZATION_ERROR', message },
    },
  })
}

export function createNotFoundError(resource = 'Recurso') {
  const message = `${resource} no encontrado`
  return createError({
    statusCode: 404,
    message,
    data: {
      success: false,
      error: { code: 'NOT_FOUND', message },
    },
  })
}

export function createConflictError(message: string) {
  return createError({
    statusCode: 409,
    message,
    data: {
      success: false,
      error: { code: 'CONFLICT', message },
    },
  })
}

export function createRateLimitError(retryAfterSeconds?: number) {
  const message = 'Demasiadas solicitudes. Intenta de nuevo más tarde'
  return createError({
    statusCode: 429,
    message,
    data: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message,
        ...(retryAfterSeconds && { retryAfter: retryAfterSeconds }),
      },
    },
  })
}

export function createPayloadTooLargeError(
  message = 'El archivo supera el tamaño máximo permitido',
) {
  return createError({
    statusCode: 413,
    message,
    data: {
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message },
    },
  })
}

export function createAccountLockedError(retryAfterMinutes: number) {
  const message = `Cuenta bloqueada temporalmente. Intenta de nuevo en ${retryAfterMinutes} minutos`
  return createError({
    statusCode: 403,
    message,
    data: {
      success: false,
      error: {
        code: 'ACCOUNT_LOCKED',
        message,
        retryAfter: retryAfterMinutes * 60,
      },
    },
  })
}
