import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getChatModelCandidatesMock, getExperimentalChatModelCandidatesMock } = vi.hoisted(() => ({
  getChatModelCandidatesMock: vi.fn(),
  getExperimentalChatModelCandidatesMock: vi.fn(),
}))

vi.mock('~~/server/services/llm/provider', () => ({
  CEREBRAS_QWEN_DEPRECATION_DATE_ISO: '2026-05-27T00:00:00.000Z',
  isCerebrasQwenDeprecated: vi.fn(() => false),
  getChatModelCandidates: getChatModelCandidatesMock,
  getExperimentalChatModelCandidates: getExperimentalChatModelCandidatesMock,
}))

describe('chat model selection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-01T00:00:00.000Z'))
    getChatModelCandidatesMock.mockReset()
    getExperimentalChatModelCandidatesMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('incluye Qwen con badge de deprecación en opciones manuales antes de su fecha límite', async () => {
    getExperimentalChatModelCandidatesMock.mockReturnValue([
      { name: 'cerebras', modelId: 'qwen-3-235b-a22b-instruct-2507', model: {} },
      { name: 'nvidia', modelId: 'z-ai/glm-5.1', model: {} },
    ])

    const { getManualChatModelOptions, getDisabledChatModelOptions } =
      await import('../../../server/services/chat/model-selection')

    const manual = getManualChatModelOptions()
    const qwen = manual.find(
      (option) =>
        option.provider === 'cerebras' && option.modelId === 'qwen-3-235b-a22b-instruct-2507',
    )

    expect(qwen?.deprecationBadgeText).toBe('Se depreca el 27 may 2026')
    expect(qwen?.deprecationDateIso).toBe('2026-05-27T00:00:00.000Z')
    expect(manual.map((option) => option.provider)).toEqual(['cerebras', 'nvidia'])
    expect(getDisabledChatModelOptions()).toEqual([])
  })

  it('permite seleccionar manualmente un modelo NVIDIA nuevo cuando está habilitado', async () => {
    getExperimentalChatModelCandidatesMock.mockReturnValue([
      {
        name: 'nvidia',
        modelId: 'z-ai/glm-5.1',
        model: { provider: 'nvidia' },
      },
    ])

    const { resolveChatModelCandidates } =
      await import('../../../server/services/chat/model-selection')

    expect(
      resolveChatModelCandidates({
        provider: 'nvidia',
        modelId: 'z-ai/glm-5.1',
      }),
    ).toHaveLength(1)
  })
})
