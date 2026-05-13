import type { LanguageModel } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCreateGoogleGenerativeAI, mockCreateOpenAICompatible, mockValidateEnv } = vi.hoisted(
  () => ({
    mockCreateGoogleGenerativeAI: vi.fn(),
    mockCreateOpenAICompatible: vi.fn(),
    mockValidateEnv: vi.fn(),
  }),
)

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: mockCreateGoogleGenerativeAI,
}))

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: mockCreateOpenAICompatible,
}))

vi.mock('~~/server/utils/env', () => ({
  validateEnv: mockValidateEnv,
}))

vi.mock('#imports', () => ({
  useRuntimeConfig: vi.fn(() => ({})),
}))

vi.mock('nuxt/app', () => ({
  useRuntimeConfig: vi.fn(() => ({})),
  useNuxtApp: vi.fn(() => ({ $config: {} })),
}))

const baseEnv = {
  googleApiKey: 'google-key',
  googleGeminiIncludeProModels: false,
  groqApiKey: 'groq-key',
  cerebrasApiKey: 'cerebras-key',
  llmProvider: 'gemini',
  nvidiaApiKey: '',
  nvidiaApiBaseUrl: 'https://integrate.api.nvidia.com/v1',
  openrouterApiKey: '',
  openrouterAppUrl: '',
}

describe('LLM provider candidates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-01T00:00:00.000Z'))
    vi.stubGlobal('useRuntimeConfig', () => ({}))

    mockCreateGoogleGenerativeAI.mockReturnValue((modelId: string) => ({
      provider: 'gemini',
      modelId,
    }))

    mockCreateOpenAICompatible.mockImplementation(({ name }: { name: string }) => {
      return (modelId: string) => ({ provider: name, modelId })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('NER: cadena Gemini solo Flash por defecto, luego Groq cuando hay GROQ_API_KEY', async () => {
    mockValidateEnv.mockReturnValue(baseEnv)

    const { getStructuredModelCandidates } = await import('../../../server/services/llm/provider')

    const structured = getStructuredModelCandidates()
    expect(structured.map((c) => c.name)).toEqual([
      'gemini',
      'gemini',
      'gemini',
      'gemini',
      'groq',
      'groq',
    ])
    expect(structured.map((c) => c.modelId)).toEqual([
      'gemini-3.1-flash-lite-preview',
      'gemini-3-flash-preview',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
    ])
  })

  it('NER: añade modelos Pro si googleGeminiIncludeProModels es true', async () => {
    mockValidateEnv.mockReturnValue({ ...baseEnv, googleGeminiIncludeProModels: true })

    const { getStructuredModelCandidates } = await import('../../../server/services/llm/provider')

    const structured = getStructuredModelCandidates()
    const geminiIds = structured.filter((c) => c.name === 'gemini').map((c) => c.modelId)
    expect(geminiIds).toEqual([
      'gemini-3.1-flash-lite-preview',
      'gemini-3-flash-preview',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-3.1-pro-preview',
    ])
  })

  it('NER: inserta NVIDIA y OpenRouter cuando hay API keys', async () => {
    mockValidateEnv.mockReturnValue({
      ...baseEnv,
      nvidiaApiKey: 'nv-key',
      openrouterApiKey: 'or-key',
      openrouterAppUrl: 'https://example.com',
    })

    const { getStructuredModelCandidates } = await import('../../../server/services/llm/provider')

    const structured = getStructuredModelCandidates()
    expect(structured.some((c) => c.name === 'nvidia')).toBe(true)
    expect(structured.some((c) => c.name === 'openrouter')).toBe(true)
    const nvidiaIds = structured.filter((c) => c.name === 'nvidia').map((c) => c.modelId)
    expect(nvidiaIds[0]).toBe('z-ai/glm4.7')
    const orIds = structured.filter((c) => c.name === 'openrouter').map((c) => c.modelId)
    expect(orIds).toEqual(['minimax/minimax-m2.5:free', 'openai/gpt-oss-120b:free'])
  })

  it('omite Groq en NER si GROQ_API_KEY esta vacia', async () => {
    mockValidateEnv.mockReturnValue({ ...baseEnv, groqApiKey: '' })

    const { getStructuredModelCandidates } = await import('../../../server/services/llm/provider')

    const structured = getStructuredModelCandidates()
    expect(structured.every((c) => c.name !== 'groq')).toBe(true)
    expect(structured).toHaveLength(4)
  })

  it('reorderCandidatesForSecondPass prioriza otros modelos antes que el ganador de pasada 1', async () => {
    const { reorderCandidatesForSecondPass, structuredModelCandidateKey } =
      await import('../../../server/services/llm/provider')

    const mk = (name: 'gemini' | 'groq', modelId: string) =>
      ({
        name,
        modelId,
        model: { provider: name, modelId } as unknown as LanguageModel,
      }) as const

    const a = mk('gemini', 'gemini-2.5-flash')
    const b = mk('groq', 'openai/gpt-oss-120b')
    const c = mk('gemini', 'gemini-2.5-flash-lite')

    const reordered = reorderCandidatesForSecondPass([a, b, c], structuredModelCandidateKey(a))
    expect(reordered.map((x) => x.modelId)).toEqual([
      'openai/gpt-oss-120b',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
    ])
  })

  it('OCR visión: cadena Gemini solo Flash por defecto', async () => {
    mockValidateEnv.mockReturnValue(baseEnv)

    const { getGoogleVisionModelCandidates } = await import('../../../server/services/llm/provider')

    const vision = getGoogleVisionModelCandidates()
    expect(vision.map((v) => v.modelId)).toEqual([
      'gemini-3.1-flash-lite-preview',
      'gemini-3-flash-preview',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
    ])
  })

  it('OCR visión: incluye Pro si googleGeminiIncludeProModels es true', async () => {
    mockValidateEnv.mockReturnValue({ ...baseEnv, googleGeminiIncludeProModels: true })

    const { getGoogleVisionModelCandidates } = await import('../../../server/services/llm/provider')

    const vision = getGoogleVisionModelCandidates()
    expect(vision.map((v) => v.modelId)).toEqual([
      'gemini-3.1-flash-lite-preview',
      'gemini-3-flash-preview',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-3.1-pro-preview',
    ])
  })

  it('chat: usa una cadena inteligente multi-proveedor con Gemini Flash Lite + Gemma preview', async () => {
    mockValidateEnv.mockReturnValue(baseEnv)

    const { getChatModelCandidates } = await import('../../../server/services/llm/provider')

    const chat = getChatModelCandidates()
    expect(chat.map((candidate) => candidate.name)).toEqual(['cerebras', 'gemini', 'gemini'])
    expect(chat.map((candidate) => candidate.modelId)).toEqual([
      'qwen-3-235b-a22b-instruct-2507',
      'gemini-3.1-flash-lite-preview',
      'gemma-4-31b-it',
    ])
  })

  it('chat: prioriza GLM 5.1 como primer candidato cuando NVIDIA está habilitado', async () => {
    mockValidateEnv.mockReturnValue({
      ...baseEnv,
      nvidiaApiKey: 'nv-key',
    })

    const { getChatModelCandidates } = await import('../../../server/services/llm/provider')

    const chat = getChatModelCandidates()
    const nvidiaIds = chat.filter((candidate) => candidate.name === 'nvidia').map((c) => c.modelId)

    expect(nvidiaIds[0]).toBe('z-ai/glm-5.1')
    expect(chat.some((candidate) => candidate.name === 'cerebras')).toBe(true)
  })

  it('chat: excluye Qwen de Cerebras al llegar la fecha de deprecación', async () => {
    vi.setSystemTime(new Date('2026-05-27T00:00:00.000Z'))
    mockValidateEnv.mockReturnValue(baseEnv)

    const { getChatModelCandidates, getExperimentalChatModelCandidates } =
      await import('../../../server/services/llm/provider')

    const defaultChain = getChatModelCandidates()
    const manual = getExperimentalChatModelCandidates()

    expect(
      defaultChain.some(
        (candidate) =>
          candidate.name === 'cerebras' && candidate.modelId === 'qwen-3-235b-a22b-instruct-2507',
      ),
    ).toBe(false)
    expect(
      manual.some(
        (candidate) =>
          candidate.name === 'cerebras' && candidate.modelId === 'qwen-3-235b-a22b-instruct-2507',
      ),
    ).toBe(false)
  })

  it('chat experimental: expone proveedores adicionales cuando hay credenciales y omite Groq', async () => {
    mockValidateEnv.mockReturnValue({
      ...baseEnv,
      nvidiaApiKey: 'nv-key',
      openrouterApiKey: 'or-key',
      openrouterAppUrl: 'https://example.com',
    })

    const { getExperimentalChatModelCandidates } =
      await import('../../../server/services/llm/provider')

    const experimental = getExperimentalChatModelCandidates()

    expect(experimental.some((candidate) => candidate.name === 'cerebras')).toBe(true)
    expect(experimental.some((candidate) => candidate.name === 'groq')).toBe(false)
    expect(experimental.some((candidate) => candidate.name === 'nvidia')).toBe(true)
    expect(experimental.some((candidate) => candidate.name === 'openrouter')).toBe(true)
    expect(experimental.some((candidate) => candidate.name === 'gemini')).toBe(true)
    expect(
      experimental.some(
        (candidate) =>
          candidate.name === 'gemini' && candidate.modelId === 'gemini-3.1-flash-lite-preview',
      ),
    ).toBe(true)
    expect(
      experimental.some(
        (candidate) => candidate.name === 'gemini' && candidate.modelId === 'gemma-4-31b-it',
      ),
    ).toBe(true)
    expect(
      experimental.some(
        (candidate) => candidate.name === 'nvidia' && candidate.modelId === 'z-ai/glm-5.1',
      ),
    ).toBe(true)
    expect(
      experimental.some(
        (candidate) =>
          candidate.name === 'nvidia' && candidate.modelId === 'deepseek-ai/deepseek-v4-pro',
      ),
    ).toBe(true)
    expect(
      experimental.some(
        (candidate) => candidate.name === 'nvidia' && candidate.modelId === 'moonshotai/kimi-k2.6',
      ),
    ).toBe(true)
    expect(
      experimental.some(
        (candidate) =>
          candidate.name === 'nvidia' && candidate.modelId === 'deepseek-ai/deepseek-v3.1-terminus',
      ),
    ).toBe(false)
    expect(
      experimental.some(
        (candidate) =>
          candidate.name === 'nvidia' && candidate.modelId === 'deepseek-ai/deepseek-v3.2',
      ),
    ).toBe(false)
    expect(
      experimental.some(
        (candidate) =>
          candidate.name === 'nvidia' && candidate.modelId === 'moonshotai/kimi-k2-thinking',
      ),
    ).toBe(false)
    expect(
      experimental.some(
        (candidate) =>
          candidate.name === 'nvidia' && candidate.modelId === 'moonshotai/kimi-k2-instruct-0905',
      ),
    ).toBe(false)
    expect(
      experimental.some(
        (candidate) =>
          candidate.name === 'openrouter' && candidate.modelId === 'google/gemma-4-31b-it:free',
      ),
    ).toBe(false)
  })
})
