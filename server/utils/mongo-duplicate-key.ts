/**
 * Detecta violación de índice único en operaciones MongoDB/Mongoose.
 * Cubre el error plano, `codeName`, y errores anidados en `cause` (p. ej. drivers recientes).
 */
export function isMongoDuplicateKeyError(error: unknown): boolean {
  let current: unknown = error
  const seen = new Set<unknown>()
  while (current != null && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const record = current as {
      code?: number
      codeName?: string
      cause?: unknown
    }
    if (record.code === 11000) {
      return true
    }
    if (record.codeName === 'DuplicateKey') {
      return true
    }
    current = record.cause
  }
  return false
}
