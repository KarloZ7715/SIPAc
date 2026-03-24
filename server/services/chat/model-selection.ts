import type { ChatModelOptionPublic, ChatModelProvider, ChatModelSelection } from '~~/app/types'
import {
  getChatModelCandidates,
  getExperimentalChatModelCandidates,
  type StructuredModelCandidate,
} from '~~/server/services/llm/provider'
import { createBadRequestError } from '~~/server/utils/errors'

const providerLabels: Record<ChatModelProvider, string> = {
  cerebras: 'Cerebras',
  gemini: 'Google Gemini',
  groq: 'Groq',
  nvidia: 'NVIDIA',
  openrouter: 'OpenRouter',
}

function inferStreamReliability(
  candidate: StructuredModelCandidate,
): ChatModelOptionPublic['streamReliability'] {
  if (candidate.name === 'groq') {
    return 'high'
  }

  if (candidate.name === 'nvidia' && candidate.modelId === 'z-ai/glm4.7') {
    return 'high'
  }

  if (candidate.name === 'gemini') {
    return 'low'
  }

  return 'medium'
}

function inferReasoningTier(
  candidate: StructuredModelCandidate,
): ChatModelOptionPublic['reasoningTier'] {
  if (
    candidate.modelId.includes('120b') ||
    candidate.modelId.includes('235b') ||
    candidate.modelId.includes('675b') ||
    candidate.modelId.includes('glm4.7') ||
    candidate.modelId.includes('deepseek-v3.2')
  ) {
    return 'high'
  }

  if (candidate.modelId.includes('20b') || candidate.modelId.includes('flash')) {
    return 'fast'
  }

  return 'medium'
}

function toOption(
  candidate: StructuredModelCandidate,
  index: number | null,
  enabledForAuto: boolean,
  enabledForManual: boolean,
  disabledReason?: string,
): ChatModelOptionPublic {
  return {
    provider: candidate.name,
    modelId: candidate.modelId,
    label: `${providerLabels[candidate.name]} · ${candidate.modelId}`,
    supportsTools: true,
    streamReliability: inferStreamReliability(candidate),
    reasoningTier: inferReasoningTier(candidate),
    fallbackRank: enabledForAuto && index !== null ? index + 1 : undefined,
    enabledForAuto,
    enabledForManual,
    disabledReason,
  }
}

export function getDefaultChatModelOptions() {
  return getChatModelCandidates().map((candidate, index) => toOption(candidate, index, true, true))
}

export function getManualChatModelOptions() {
  return getExperimentalChatModelCandidates()
    .filter((candidate) => candidate.name !== 'gemini')
    .map((candidate) => toOption(candidate, null, false, true))
}

export function getDisabledChatModelOptions() {
  return getExperimentalChatModelCandidates()
    .filter((candidate) => candidate.name === 'gemini')
    .map((candidate) =>
      toOption(
        candidate,
        null,
        false,
        false,
        'Excluido de la cadena principal del chat por política grounded vigente',
      ),
    )
}

export function resolveChatModelCandidates(selection?: ChatModelSelection) {
  if (!selection) {
    const defaultCandidates = getChatModelCandidates()
    if (defaultCandidates.length === 0) {
      throw createBadRequestError('No hay modelos de chat disponibles en el entorno actual')
    }
    return defaultCandidates
  }

  const candidate = getExperimentalChatModelCandidates().find(
    (item) => item.name === selection.provider && item.modelId === selection.modelId,
  )

  if (!candidate || candidate.name === 'gemini') {
    throw createBadRequestError('La selección de proveedor/modelo no está habilitada')
  }

  return [candidate]
}
