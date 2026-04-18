/**
 * Combine structured name parts into a single display string. Fallbacks to
 * `fallback` when no structured parts are provided (legacy users).
 */
export function buildFullName(parts: {
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
  secondLastName?: string | null
  fallback?: string | null
}): string {
  const segments = [parts.firstName, parts.middleName, parts.lastName, parts.secondLastName]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)

  if (segments.length === 0) {
    return (parts.fallback ?? '').trim()
  }

  return segments.join(' ')
}

/**
 * Best-effort heuristic split of a single string into structured name parts.
 *
 * Strategy:
 * - 1 word   → firstName only
 * - 2 words  → firstName + lastName
 * - 3 words  → firstName + lastName + secondLastName
 * - 4+ words → firstName + middleName (rest) + lastName + secondLastName
 */
export function splitFullName(fullName: string): {
  firstName: string
  middleName?: string
  lastName?: string
  secondLastName?: string
} {
  const words = fullName.trim().split(/\s+/).filter(Boolean)

  if (words.length === 0) return { firstName: '' }
  if (words.length === 1) return { firstName: words[0]! }
  if (words.length === 2) return { firstName: words[0]!, lastName: words[1]! }
  if (words.length === 3) {
    return { firstName: words[0]!, lastName: words[1]!, secondLastName: words[2]! }
  }

  const [first, ...rest] = words
  const secondLastName = rest.pop()
  const lastName = rest.pop()
  const middleName = rest.join(' ')

  return {
    firstName: first!,
    ...(middleName ? { middleName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(secondLastName ? { secondLastName } : {}),
  }
}
