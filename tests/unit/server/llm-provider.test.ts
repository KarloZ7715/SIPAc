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

  it('uses NER fallback order Gemini Flash -> Groq 120B -> Gemini Flash-Lite -> Groq 20B', async () => {
    mockValidateEnv.mockReturnValue({
      googleApiKey: 'google-key',
      groqApiKey: 'groq-key',
      cerebrasApiKey: 'cerebras-key',
      llmProvider: 'gemini',
    })

    const { getStructuredModelCandidates, getChatModelCandidates } =
      await import('../../../server/services/llm/provider')

    const structured = getStructuredModelCandidates()
    expect(structured.map((candidate) => candidate.name)).toEqual([
      'gemini',
      'groq',
      'gemini',
      'groq',
    ])
    expect(structured.map((candidate) => candidate.modelId)).toEqual([
      'gemini-2.5-flash',
      'openai/gpt-oss-120b',
      'gemini-2.5-flash-lite',
      'openai/gpt-oss-20b',
    ])

    const chat = getChatModelCandidates()
    expect(chat.map((candidate) => candidate.name)).toEqual(['cerebras', 'gemini', 'cerebras'])
    expect(chat.map((candidate) => candidate.modelId)).toEqual([
      'gpt-oss-120b',
      'gemini-2.5-flash',
      'qwen-3-235b-a22b-instruct-2507',
    ])
  })

  it('skips Groq candidates when GROQ_API_KEY is missing', async () => {
    mockValidateEnv.mockReturnValue({
      googleApiKey: 'google-key',
      groqApiKey: '',
      cerebrasApiKey: '',
      llmProvider: 'gemini',
    })

    const { getStructuredModelCandidates } = await import('../../../server/services/llm/provider')

    const structured = getStructuredModelCandidates()
    expect(structured.map((candidate) => candidate.name)).toEqual(['gemini', 'gemini'])
    expect(structured.map((candidate) => candidate.modelId)).toEqual([
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ])
  })
})
