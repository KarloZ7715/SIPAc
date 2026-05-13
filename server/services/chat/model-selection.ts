import {
  CHAT_PROVIDER_DISPLAY_NAME,
  type ChatModelOptionPublic,
  type ChatModelProvider,
  type ChatModelSelection,
} from '~~/app/types'
import {
  CEREBRAS_QWEN_DEPRECATION_DATE_ISO,
  getChatModelCandidates,
  getExperimentalChatModelCandidates,
  isCerebrasQwenDeprecated,
  type StructuredModelCandidate,
} from '~~/server/services/llm/provider'
import { createBadRequestError } from '~~/server/utils/errors'

/**
 * Nombres legibles del modelo (sin IDs en pantalla). Clave: `${provider}::${modelId}`
 */
const CHAT_MODEL_PICKER_LABELS: Record<string, string> = {
  'cerebras::qwen-3-235b-a22b-instruct-2507': 'Qwen 3 235B Instruct',
  'gemini::gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite (preview)',
  'gemini::gemma-4-31b-it': 'Gemma 4 31B (preview)',
  'nvidia::z-ai/glm-5.1': 'GLM 5.1',
  'nvidia::deepseek-ai/deepseek-v4-pro': 'DeepSeek V4 Pro',
  'nvidia::moonshotai/kimi-k2.6': 'Kimi K2.6',
  'nvidia::minimaxai/minimax-m2.7': 'MiniMax M2.7',
  'nvidia::mistralai/mistral-large-3-675b-instruct-2512': 'Mistral Large 3',
  'nvidia::z-ai/glm4.7': 'GLM 4.7',
  'openrouter::minimax/minimax-m2.5:free': 'MiniMax M2.5 (gratis)',
  'openrouter::openai/gpt-oss-120b:free': 'GPT-OSS 120B (gratis)',
  'openrouter::nvidia/nemotron-3-super-120b-a12b:free': 'Nemotron 3 Super 120B (preview)',
  'openrouter::z-ai/glm-4.5-air:free': 'GLM 4.5 Air (gratis)',
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
    candidate.modelId.includes('675b') ||
    candidate.modelId.includes('k2.6') ||
    candidate.modelId.includes('m2.7') ||
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

function getDeprecationBadgeText(candidate: StructuredModelCandidate): string | undefined {
  const isCerebrasQwen =
    candidate.name === 'cerebras' && candidate.modelId === 'qwen-3-235b-a22b-instruct-2507'

  if (!isCerebrasQwen || isCerebrasQwenDeprecated()) {
    return undefined
  }

  return 'Se depreca el 27 may 2026'
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
    deprecationDateIso: getDeprecationBadgeText(candidate)
      ? CEREBRAS_QWEN_DEPRECATION_DATE_ISO
      : undefined,
    deprecationBadgeText: getDeprecationBadgeText(candidate),
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
