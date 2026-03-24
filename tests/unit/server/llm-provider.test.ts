import type { LanguageModel } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    vi.stubGlobal('useRuntimeConfig', () => ({}))

    mockCreateGoogleGenerativeAI.mockReturnValue((modelId: string) => ({
      provider: 'gemini',
      modelId,
    }))

    mockCreateOpenAICompatible.mockImplementation(({ name }: { name: string }) => {
      return (modelId: string) => ({ provider: name, modelId })
    })
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

  it('chat: usa una cadena inteligente multi-proveedor y excluye Gemini del flujo automático', async () => {
    mockValidateEnv.mockReturnValue(baseEnv)

    const { getChatModelCandidates } = await import('../../../server/services/llm/provider')

    const chat = getChatModelCandidates()
    expect(chat.map((candidate) => candidate.name)).toEqual(['cerebras', 'groq', 'groq'])
    expect(chat.map((candidate) => candidate.modelId)).toEqual([
      'qwen-3-235b-a22b-instruct-2507',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
    ])
  })

  it('chat experimental: expone proveedores adicionales cuando hay credenciales', async () => {
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
    expect(experimental.some((candidate) => candidate.name === 'groq')).toBe(true)
    expect(experimental.some((candidate) => candidate.name === 'nvidia')).toBe(true)
    expect(experimental.some((candidate) => candidate.name === 'openrouter')).toBe(true)
    expect(experimental.some((candidate) => candidate.name === 'gemini')).toBe(true)
  })
})
