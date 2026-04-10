import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getChatModelCandidatesMock, getExperimentalChatModelCandidatesMock } = vi.hoisted(() => ({
  getChatModelCandidatesMock: vi.fn(),
  getExperimentalChatModelCandidatesMock: vi.fn(),
}))

vi.mock('~~/server/services/llm/provider', () => ({
  getChatModelCandidates: getChatModelCandidatesMock,
  getExperimentalChatModelCandidates: getExperimentalChatModelCandidatesMock,
}))

describe('chat model selection', () => {
  beforeEach(() => {
    getChatModelCandidatesMock.mockReset()
    getExperimentalChatModelCandidatesMock.mockReset()
  })

  it('incluye Gemini entre las opciones manuales sin meterlo en la cadena automática', async () => {
    getExperimentalChatModelCandidatesMock.mockReturnValue([
      { name: 'cerebras', modelId: 'qwen-3-235b-a22b-instruct-2507', model: {} },
      { name: 'gemini', modelId: 'gemini-2.5-flash', model: {} },
    ])

    const { getManualChatModelOptions, getDisabledChatModelOptions } =
      await import('../../../server/services/chat/model-selection')

    expect(getManualChatModelOptions().map((option) => option.provider)).toEqual([
      'cerebras',
      'gemini',
    ])
    expect(getDisabledChatModelOptions()).toEqual([])
  })

  it('permite seleccionar Gemini manualmente cuando está habilitado en candidatos experimentales', async () => {
    getExperimentalChatModelCandidatesMock.mockReturnValue([
      { name: 'gemini', modelId: 'gemini-2.5-flash', model: { provider: 'gemini' } },
    ])

    const { resolveChatModelCandidates } =
      await import('../../../server/services/chat/model-selection')

    expect(
      resolveChatModelCandidates({
        provider: 'gemini',
        modelId: 'gemini-2.5-flash',
      }),
    ).toHaveLength(1)
  })
})
