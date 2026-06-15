import {
  CHAT_PROVIDER_DISPLAY_NAME,
  type ChatModelOptionPublic,
  type ChatModelProvider,
  type ChatModelSelection,
} from '~~/app/types'
import {
  getChatModelCandidates,
  getExperimentalChatModelCandidates,
  getModelDeprecation,
  type StructuredLlmProvider,
  type StructuredModelCandidate,
} from '~~/server/services/llm/provider'
import { createBadRequestError } from '~~/server/utils/errors'

/**
 * Nombres legibles del modelo (sin IDs en pantalla). Clave: `${provider}::${modelId}`
 */
const CHAT_MODEL_PICKER_LABELS: Record<string, string> = {
  'cerebras::zai-glm-4.7': 'GLM 4.7 (Cerebras)',
  'gemini::gemini-3.5-flash': 'Gemini 3.5 Flash',
  'gemini::gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite (preview)',
  'gemini::gemma-4-31b-it': 'Gemma 4 31B (preview)',
  'nvidia::z-ai/glm-5.1': 'GLM 5.1',
  'nvidia::deepseek-ai/deepseek-v4-flash': 'DeepSeek V4 Flash',
  'nvidia::deepseek-ai/deepseek-v4-pro': 'DeepSeek V4 Pro',
  'nvidia::nvidia/nemotron-3-ultra-550b-a55b': 'Nemotron 3 Ultra 550B',
  'nvidia::moonshotai/kimi-k2.6': 'Kimi K2.6',
  'nvidia::minimaxai/minimax-m2.7': 'MiniMax M2.7',
  'nvidia::minimaxai/minimax-m3': 'MiniMax M3',
  'nvidia::mistralai/mistral-large-3-675b-instruct-2512': 'Mistral Large 3',
  'openrouter::moonshotai/kimi-k2.6:free': 'Kimi K2.6 (gratis)',
  'openrouter::openai/gpt-oss-120b:free': 'GPT-OSS 120B (gratis)',
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
  if (candidate.name === 'nvidia') {
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
    candidate.modelId.includes('550b') ||
    candidate.modelId.includes('675b') ||
    candidate.modelId.includes('k2.6') ||
    candidate.modelId.includes('m2.7') ||
    candidate.modelId.includes('m3') ||
    candidate.modelId.includes('glm4.7') ||
    candidate.modelId.includes('glm-5.1') ||
    candidate.modelId.includes('deepseek-v4')
  ) {
    return 'high'
  }

  if (candidate.modelId.includes('20b') || candidate.modelId.includes('flash')) {
    return 'fast'
  }

  return 'medium'
}

function getDeprecation(
  provider: StructuredLlmProvider,
  modelId: string,
): { deprecationDateIso: string; badgeText: string } | undefined {
  const entry = getModelDeprecation(provider, modelId)
  if (!entry) {
    return undefined
  }
  return {
    deprecationDateIso: entry.deprecationDateIso,
    badgeText: entry.badgeText,
  }
}

function toOption(
  candidate: StructuredModelCandidate,
  index: number | null,
  enabledForAuto: boolean,
  enabledForManual: boolean,
  disabledReason?: string,
): ChatModelOptionPublic {
  const deprecation = getDeprecation(candidate.name, candidate.modelId)
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
    deprecationDateIso: deprecation?.deprecationDateIso,
    deprecationBadgeText: deprecation?.badgeText,
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
