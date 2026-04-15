import { describe, expect, it } from 'vitest'
import { isMongoDuplicateKeyError } from '~~/server/utils/mongo-duplicate-key'

describe('isMongoDuplicateKeyError', () => {
  it('detects code 11000', () => {
    expect(isMongoDuplicateKeyError({ code: 11000 })).toBe(true)
  })

  it('detects DuplicateKey codeName', () => {
    expect(isMongoDuplicateKeyError({ codeName: 'DuplicateKey' })).toBe(true)
  })

  it('detects nested cause', () => {
    expect(
      isMongoDuplicateKeyError({
        message: 'wrapper',
        cause: { code: 11000 },
      }),
    ).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isMongoDuplicateKeyError(new Error('timeout'))).toBe(false)
    expect(isMongoDuplicateKeyError({ code: 42 })).toBe(false)
    expect(isMongoDuplicateKeyError(null)).toBe(false)
  })

  it('does not loop on circular cause', () => {
    const a: { cause?: unknown; code?: number } = {}
    const b: { cause?: unknown; code?: number } = { cause: a }
    a.cause = b
    expect(isMongoDuplicateKeyError(a)).toBe(false)
  })
})
