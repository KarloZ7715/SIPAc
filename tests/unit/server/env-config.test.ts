import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
})

describe('validateEnv', () => {
  it('applies defaults for OCR/NER timeout and candidate budget settings', async () => {
    const { validateEnv } = await import('../../../server/utils/env')

    const env = validateEnv({
      mongodbUri: 'mongodb://localhost:27017/sipac',
      jwtSecret: 'abcdefghijklmnopqrstuvwxyz123456',
      googleApiKey: 'google-key',
    })

    expect(env.ocrRequestTimeoutMs).toBe(45_000)
    expect(env.nerRequestTimeoutMs).toBe(35_000)
    expect(env.nerMaxCandidateAttempts).toBe(4)
  })
})
