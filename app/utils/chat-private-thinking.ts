function isThinkTagBoundary(char: string | undefined): boolean {
  return !char || /[\s>/]/.test(char)
}

function readTagEndIndex(value: string, from: number): number {
  return value.indexOf('>', from)
}

export function extractPrivateThinking(value: string): { cleanText: string; thinkingText: string } {
  if (!value) {
    return { cleanText: '', thinkingText: '' }
  }

  const lower = value.toLowerCase()
  let cleanText = ''
  let thinkingText = ''
  let cursor = 0
  let thinkDepth = 0

  while (cursor < value.length) {
    const openTag = lower.startsWith('<think', cursor)
    if (openTag && isThinkTagBoundary(lower[cursor + 6])) {
      const end = readTagEndIndex(value, cursor + 6)
      if (end === -1) {
        break
      }
      thinkDepth += 1
      cursor = end + 1
      continue
    }

    const closeTag = lower.startsWith('</think', cursor)
    if (closeTag && isThinkTagBoundary(lower[cursor + 7])) {
      const end = readTagEndIndex(value, cursor + 7)
      if (end === -1) {
        break
      }
      if (thinkDepth > 0) {
        thinkDepth -= 1
      }
      cursor = end + 1
      continue
    }

    if (thinkDepth === 0) {
      cleanText += value[cursor]
    } else {
      thinkingText += value[cursor]
    }
    cursor += 1
  }

  return { cleanText: cleanText.replace(/\n{3,}/g, '\n\n'), thinkingText }
}

/**
 * Elimina bloques de pensamiento privado (<think>...</think>) del texto mostrado al usuario.
 * También cubre bloques sin cierre para evitar fugas durante streaming parcial.
 */
export function stripPrivateThinkingBlocks(value: string): string {
  return extractPrivateThinking(value).cleanText
}

export function hasPrivateThinkingBlocks(value: string): boolean {
  if (!value) {
    return false
  }

  return /<\/?think(?:\s|>|\/)/i.test(value)
}
