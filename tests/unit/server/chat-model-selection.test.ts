import type * as LlmProvider from '~~/server/services/llm/provider'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getChatModelCandidatesMock, getExperimentalChatModelCandidatesMock } = vi.hoisted(() => ({
  getChatModelCandidatesMock: vi.fn(),
  getExperimentalChatModelCandidatesMock: vi.fn(),
}))

vi.mock('~~/server/services/llm/provider', async (importOriginal) => {
  const actual = await importOriginal<typeof LlmProvider>()
  return {
    ...actual,
    getChatModelCandidates: getChatModelCandidatesMock,
    getExperimentalChatModelCandidates: getExperimentalChatModelCandidatesMock,
  }
})

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

  it('incluye GLM 4.7 de Cerebras en opciones manuales sin badge de deprecación', async () => {
    getExperimentalChatModelCandidatesMock.mockReturnValue([
      { name: 'cerebras', modelId: 'zai-glm-4.7', model: {} },
      { name: 'nvidia', modelId: 'z-ai/glm-5.1', model: {} },
    ])

    const { getManualChatModelOptions, getDisabledChatModelOptions } =
      await import('../../../server/services/chat/model-selection')

    const manual = getManualChatModelOptions()
    const glm = manual.find(
      (option) => option.provider === 'cerebras' && option.modelId === 'zai-glm-4.7',
    )

    expect(glm?.label).toBe('GLM 4.7 (Cerebras)')
    expect(glm?.deprecationBadgeText).toBeUndefined()
    expect(glm?.deprecationDateIso).toBeUndefined()
    expect(manual.map((option) => option.provider)).toEqual(['cerebras', 'nvidia'])
    expect(getDisabledChatModelOptions()).toEqual([])
  })

  it('muestra badge de deprecación cuando getModelDeprecation devuelve una entrada', async () => {
    getExperimentalChatModelCandidatesMock.mockReturnValue([
      { name: 'cerebras', modelId: 'zai-glm-4.7', model: {} },
    ])

    const provider = await import('../../../server/services/llm/provider')
    const deprecationSpy = vi.spyOn(provider, 'getModelDeprecation').mockReturnValue({
      provider: 'cerebras',
      modelId: 'zai-glm-4.7',
      deprecationDateIso: '2026-05-27T00:00:00.000Z',
      badgeText: 'Se depreca el 27 may 2026',
    })

    const { getManualChatModelOptions } =
      await import('../../../server/services/chat/model-selection')

    const manual = getManualChatModelOptions()
    const glm = manual.find(
      (option) => option.provider === 'cerebras' && option.modelId === 'zai-glm-4.7',
    )

    expect(glm?.deprecationBadgeText).toBe('Se depreca el 27 may 2026')
    expect(glm?.deprecationDateIso).toBe('2026-05-27T00:00:00.000Z')

    deprecationSpy.mockRestore()
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
