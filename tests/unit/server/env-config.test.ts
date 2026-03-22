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
    expect(env.ocrMaxGeminiVisionAttempts).toBe(6)
    expect(env.nerRequestTimeoutMs).toBe(35_000)
    expect(env.nerMaxCandidateAttempts).toBe(4)
    expect(env.nerAlwaysSecondPass).toBe(false)
    expect(env.nerMergeExtractionPasses).toBe(true)
    expect(env.nerProductSpecificFillPass).toBe(true)
    expect(env.nerProductSpecificSparseThreshold).toBe(0.4)
    expect(env.nvidiaApiKey).toBe('')
    expect(env.nvidiaApiBaseUrl).toBe('https://integrate.api.nvidia.com/v1')
    expect(env.openrouterApiKey).toBe('')
    expect(env.openrouterAppUrl).toBe('')
    expect(env.googleGeminiIncludeProModels).toBe(false)
    expect(env.nerSegmentationEnabled).toBe(false)
    expect(env.nerSegmentationMaxSegments).toBe(6)
    expect(env.nerSegmentationInputMaxChars).toBe(28_000)
    expect(env.nerSegmentationMinSegmentChars).toBe(400)
    expect(env.nerSegmentationModelId).toBe('gemini-2.5-flash-lite')
  })
})
