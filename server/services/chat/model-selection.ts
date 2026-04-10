import {
  CHAT_PROVIDER_DISPLAY_NAME,
  type ChatModelOptionPublic,
  type ChatModelProvider,
  type ChatModelSelection,
} from '~~/app/types'
import {
  getChatModelCandidates,
  getExperimentalChatModelCandidates,
  type StructuredModelCandidate,
} from '~~/server/services/llm/provider'
import { createBadRequestError } from '~~/server/utils/errors'

/**
 * Nombres legibles del modelo (sin IDs en pantalla). Clave: `${provider}::${modelId}`
 */
const CHAT_MODEL_PICKER_LABELS: Record<string, string> = {
  'cerebras::qwen-3-235b-a22b-instruct-2507': 'Qwen 3 235B Instruct',
  'groq::openai/gpt-oss-120b': 'GPT-OSS 120B',
  'groq::openai/gpt-oss-20b': 'GPT-OSS 20B',
  'nvidia::z-ai/glm4.7': 'GLM 4.7',
  'nvidia::deepseek-ai/deepseek-v3.1-terminus': 'DeepSeek V3.1 Terminus',
  'nvidia::mistralai/mistral-large-3-675b-instruct-2512': 'Mistral Large 3',
  'nvidia::deepseek-ai/deepseek-v3.2': 'DeepSeek V3.2',
  'nvidia::moonshotai/kimi-k2-instruct-0905': 'Kimi K2 Instruct',
  'openrouter::minimax/minimax-m2.5:free': 'MiniMax M2.5 (gratis)',
  'openrouter::openai/gpt-oss-120b:free': 'GPT-OSS 120B (gratis)',
  'openrouter::google/gemma-4-31b-it:free': 'Gemma 4 31B IT (gratis)',
  'openrouter::nvidia/nemotron-3-super-120b-a12b:free': 'Nemotron 3 Super 120B (gratis)',
  'openrouter::z-ai/glm-4.5-air:free': 'GLM 4.5 Air (gratis)',
  'gemini::gemini-2.5-flash': 'Gemini 2.5 Flash',
}

export function publicChatModelPickerLabel(provider: ChatModelProvider, modelId: string): string {
  const key = `${provider}::${modelId}`
  return (
    CHAT_MODEL_PICKER_LABELS[key] ?? `${CHAT_PROVIDER_DISPLAY_NAME[provider]} — modelo adicional`
  )
}

function inferStreamReliability(
  candidate: StructuredModelCandidate,
): ChatModelOptionPublic['streamReliability'] {
  if (candidate.name === 'groq') {
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
    label: publicChatModelPickerLabel(candidate.name, candidate.modelId),
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
  return getExperimentalChatModelCandidates().map((candidate) =>
    toOption(candidate, null, false, true),
  )
}

export function getDisabledChatModelOptions() {
  return []
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

  if (!candidate) {
    throw createBadRequestError('La selección de proveedor/modelo no está habilitada')
  }

  return [candidate]
}
