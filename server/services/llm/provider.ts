import type { LanguageModel } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { validateEnv, type EnvConfig } from '~~/server/utils/env'

export type StructuredLlmProvider = 'gemini' | 'cerebras' | 'groq' | 'openrouter' | 'nvidia'

const GROQ_GPT_OSS_120B_MODEL_ID = 'openai/gpt-oss-120b'
const GROQ_GPT_OSS_20B_MODEL_ID = 'openai/gpt-oss-20b'
const CEREBRAS_GLM_47_MODEL_ID = 'zai-glm-4.7'
const GEMINI_CHAT_MODEL_ID = 'gemini-3.1-flash-lite'
const GEMINI_CHAT_GEMMA_PREVIEW_MODEL_ID = 'gemma-4-31b-it'

const GEMINI_FLASH_PIPELINE_MODEL_IDS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
] as const

const GEMINI_PRO_PIPELINE_MODEL_IDS = ['gemini-2.5-pro', 'gemini-3.1-pro-preview'] as const

function resolveGeminiPipelineModelIds(env: EnvConfig): string[] {
  if (env.googleGeminiIncludeProModels) {
    return [...GEMINI_FLASH_PIPELINE_MODEL_IDS, ...GEMINI_PRO_PIPELINE_MODEL_IDS]
  }
  return [...GEMINI_FLASH_PIPELINE_MODEL_IDS]
}

// Cadena unificada NVIDIA NIM para NER y ChatAI.
// Modelos retirados de NIM (quitados): z-ai/glm4.7, deepseek-ai/deepseek-v3.1-terminus,
// deepseek-ai/deepseek-v3.2, nvidia/nemotron-3-super-120b-a12b, minimax/minimax-m2.5.
const NVIDIA_MODEL_IDS_ORDERED = [
  'z-ai/glm-5.1',
  'deepseek-ai/deepseek-v4-flash',
  'deepseek-ai/deepseek-v4-pro',
  'nvidia/nemotron-3-ultra-550b-a55b',
  'moonshotai/kimi-k2.6',
  'minimaxai/minimax-m2.7',
  'minimaxai/minimax-m3',
  'mistralai/mistral-large-3-675b-instruct-2512',
] as const

const OPENROUTER_MODEL_IDS_ORDERED = [
  'moonshotai/kimi-k2.6:free',
  'openai/gpt-oss-120b:free',
] as const

/**
 * Catálogo de modelos marcados como deprecados. Cada entrada incluye la fecha de
 * deprecación (ISO) y el texto del badge a mostrar en la UI. Se omite la entrada
 * cuando el modelo aún no está deprecado.
 *
 * El helper `isModelDeprecated(provider, modelId, nowMs)` permite reutilizar este
 * mecanismo con cualquier modelo en el futuro (no solo los aquí listados).
 */
export interface ModelDeprecationEntry {
  provider: StructuredLlmProvider
  modelId: string
  deprecationDateIso: string
  badgeText: string
}

const MODEL_DEPRECATIONS: readonly ModelDeprecationEntry[] = []

export function getModelDeprecations(): readonly ModelDeprecationEntry[] {
  return MODEL_DEPRECATIONS
}

export function isModelDeprecated(
  provider: StructuredLlmProvider,
  modelId: string,
  nowMs = Date.now(),
): boolean {
  const entry = MODEL_DEPRECATIONS.find(
    (item) => item.provider === provider && item.modelId === modelId,
  )
  if (!entry) {
    return false
  }
  return nowMs >= Date.parse(entry.deprecationDateIso)
}

export function getModelDeprecation(
  provider: StructuredLlmProvider,
  modelId: string,
): ModelDeprecationEntry | undefined {
  return MODEL_DEPRECATIONS.find((item) => item.provider === provider && item.modelId === modelId)
}

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export interface GoogleVisionModelCandidate {
  modelId: string
  model: LanguageModel
}

export interface StructuredModelCandidate {
  name: StructuredLlmProvider
  modelId: string
  model: LanguageModel
}

export function structuredModelCandidateKey(candidate: StructuredModelCandidate): string {
  return `${candidate.name}:${candidate.modelId}`
}

/**
 * Para la segunda pasada NER: prioriza modelos distintos al que ya acertó en la primera,
 * dejando el ganador de la pasada 1 al final como último recurso.
 */
export function reorderCandidatesForSecondPass(
  candidates: StructuredModelCandidate[],
  firstPassWinningKey: string | null,
): StructuredModelCandidate[] {
  if (!firstPassWinningKey || candidates.length <= 1) {
    return [...candidates]
  }

  const primary: StructuredModelCandidate[] = []
  const deferred: StructuredModelCandidate[] = []

  for (const candidate of candidates) {
    if (structuredModelCandidateKey(candidate) === firstPassWinningKey) {
      deferred.push(candidate)
    } else {
      primary.push(candidate)
    }
  }

  return [...primary, ...deferred]
}

function getRuntimeConfigSafe(): Record<string, unknown> {
  try {
    return useRuntimeConfig()
  } catch {
    return {}
  }
}

function pushCandidate(
  seen: Set<string>,
  list: StructuredModelCandidate[],
  candidate: StructuredModelCandidate,
) {
  const key = structuredModelCandidateKey(candidate)
  if (seen.has(key)) {
    return
  }
  seen.add(key)
  list.push(candidate)
}

// Mantenido por compatibilidad hacia atrás: reexporta la API genérica de
// deprecación. Cualquier modelo puede marcarse vía `MODEL_DEPRECATIONS`.
export {
  isModelDeprecated as isCerebrasQwenDeprecated,
  getModelDeprecation as getCerebrasQwenDeprecation,
}

/**
 * Cadena NER estructurado (clasificación + extracción JSON): más capaz → fallback más barato.
 */
export function getStructuredModelCandidates(): StructuredModelCandidate[] {
  const env = validateEnv(getRuntimeConfigSafe())
  const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey })

  const groq =
    env.groqApiKey.length > 0
      ? createOpenAICompatible({
          name: 'groq',
          apiKey: env.groqApiKey,
          baseURL: 'https://api.groq.com/openai/v1',
          supportsStructuredOutputs: true,
        })
      : null

  const nvidia =
    env.nvidiaApiKey.length > 0
      ? createOpenAICompatible({
          name: 'nvidia',
          apiKey: env.nvidiaApiKey,
          baseURL: env.nvidiaApiBaseUrl,
          supportsStructuredOutputs: true,
        })
      : null

  const openrouterHeaders: Record<string, string> = {
    'X-Title': 'SIPAc',
  }
  if (env.openrouterAppUrl.trim().length > 0) {
    openrouterHeaders['HTTP-Referer'] = env.openrouterAppUrl.trim()
  }

  const openrouter =
    env.openrouterApiKey.length > 0
      ? createOpenAICompatible({
          name: 'openrouter',
          apiKey: env.openrouterApiKey,
          baseURL: OPENROUTER_BASE_URL,
          headers: openrouterHeaders,
          supportsStructuredOutputs: true,
        })
      : null

  const candidates: StructuredModelCandidate[] = []
  const seen = new Set<string>()

  for (const modelId of resolveGeminiPipelineModelIds(env)) {
    pushCandidate(seen, candidates, {
      name: 'gemini',
      modelId,
      model: google(modelId),
    })
  }

  if (nvidia) {
    for (const modelId of NVIDIA_MODEL_IDS_ORDERED) {
      pushCandidate(seen, candidates, {
        name: 'nvidia',
        modelId,
        model: nvidia(modelId),
      })
    }
  }

  if (openrouter) {
    for (const modelId of OPENROUTER_MODEL_IDS_ORDERED) {
      pushCandidate(seen, candidates, {
        name: 'openrouter',
        modelId,
        model: openrouter(modelId),
      })
    }
  }

  if (groq) {
    pushCandidate(seen, candidates, {
      name: 'groq',
      modelId: GROQ_GPT_OSS_120B_MODEL_ID,
      model: groq(GROQ_GPT_OSS_120B_MODEL_ID),
    })
    pushCandidate(seen, candidates, {
      name: 'groq',
      modelId: GROQ_GPT_OSS_20B_MODEL_ID,
      model: groq(GROQ_GPT_OSS_20B_MODEL_ID),
    })
  }

  return candidates
}

export function getChatModelCandidates(): StructuredModelCandidate[] {
  const env = validateEnv(getRuntimeConfigSafe())
  const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey })
  const cerebras =
    env.cerebrasApiKey.length > 0
      ? createOpenAICompatible({
          name: 'cerebras',
          apiKey: env.cerebrasApiKey,
          baseURL: 'https://api.cerebras.ai/v1',
          supportsStructuredOutputs: true,
        })
      : null
  const nvidia =
    env.nvidiaApiKey.length > 0
      ? createOpenAICompatible({
          name: 'nvidia',
          apiKey: env.nvidiaApiKey,
          baseURL: env.nvidiaApiBaseUrl,
          supportsStructuredOutputs: true,
        })
      : null
  const openrouterHeaders: Record<string, string> = {
    'X-Title': 'SIPAc',
  }
  if (env.openrouterAppUrl.trim().length > 0) {
    openrouterHeaders['HTTP-Referer'] = env.openrouterAppUrl.trim()
  }
  const openrouter =
    env.openrouterApiKey.length > 0
      ? createOpenAICompatible({
          name: 'openrouter',
          apiKey: env.openrouterApiKey,
          baseURL: OPENROUTER_BASE_URL,
          headers: openrouterHeaders,
          supportsStructuredOutputs: true,
        })
      : null

  const candidates: StructuredModelCandidate[] = []
  const seen = new Set<string>()

  if (nvidia) {
    for (const modelId of NVIDIA_MODEL_IDS_ORDERED) {
      pushCandidate(seen, candidates, {
        name: 'nvidia',
        modelId,
        model: nvidia(modelId),
      })
    }
  }

  if (openrouter) {
    for (const modelId of OPENROUTER_MODEL_IDS_ORDERED) {
      pushCandidate(seen, candidates, {
        name: 'openrouter',
        modelId,
        model: openrouter(modelId),
      })
    }
  }

  if (cerebras && !isModelDeprecated('cerebras', CEREBRAS_GLM_47_MODEL_ID)) {
    pushCandidate(seen, candidates, {
      name: 'cerebras',
      modelId: CEREBRAS_GLM_47_MODEL_ID,
      model: cerebras(CEREBRAS_GLM_47_MODEL_ID),
    })
  }

  pushCandidate(seen, candidates, {
    name: 'gemini',
    modelId: GEMINI_CHAT_MODEL_ID,
    model: google(GEMINI_CHAT_MODEL_ID),
  })
  pushCandidate(seen, candidates, {
    name: 'gemini',
    modelId: GEMINI_CHAT_GEMMA_PREVIEW_MODEL_ID,
    model: google(GEMINI_CHAT_GEMMA_PREVIEW_MODEL_ID),
  })

  return candidates
}

export function getExperimentalChatModelCandidates(): StructuredModelCandidate[] {
  const env = validateEnv(getRuntimeConfigSafe())
  const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey })
  const candidates: StructuredModelCandidate[] = []
  const seen = new Set<string>()

  const cerebras =
    env.cerebrasApiKey.length > 0
      ? createOpenAICompatible({
          name: 'cerebras',
          apiKey: env.cerebrasApiKey,
          baseURL: 'https://api.cerebras.ai/v1',
          supportsStructuredOutputs: true,
        })
      : null

  const nvidia =
    env.nvidiaApiKey.length > 0
      ? createOpenAICompatible({
          name: 'nvidia',
          apiKey: env.nvidiaApiKey,
          baseURL: env.nvidiaApiBaseUrl,
          supportsStructuredOutputs: true,
        })
      : null

  const openrouterHeaders: Record<string, string> = {
    'X-Title': 'SIPAc',
  }
  if (env.openrouterAppUrl.trim().length > 0) {
    openrouterHeaders['HTTP-Referer'] = env.openrouterAppUrl.trim()
  }

  const openrouter =
    env.openrouterApiKey.length > 0
      ? createOpenAICompatible({
          name: 'openrouter',
          apiKey: env.openrouterApiKey,
          baseURL: OPENROUTER_BASE_URL,
          headers: openrouterHeaders,
          supportsStructuredOutputs: true,
        })
      : null

  if (cerebras && !isModelDeprecated('cerebras', CEREBRAS_GLM_47_MODEL_ID)) {
    pushCandidate(seen, candidates, {
      name: 'cerebras',
      modelId: CEREBRAS_GLM_47_MODEL_ID,
      model: cerebras(CEREBRAS_GLM_47_MODEL_ID),
    })
  }

  if (nvidia) {
    for (const modelId of NVIDIA_MODEL_IDS_ORDERED) {
      pushCandidate(seen, candidates, {
        name: 'nvidia',
        modelId,
        model: nvidia(modelId),
      })
    }
  }

  if (openrouter) {
    for (const modelId of OPENROUTER_MODEL_IDS_ORDERED) {
      pushCandidate(seen, candidates, {
        name: 'openrouter',
        modelId,
        model: openrouter(modelId),
      })
    }
  }

  pushCandidate(seen, candidates, {
    name: 'gemini',
    modelId: GEMINI_CHAT_MODEL_ID,
    model: google(GEMINI_CHAT_MODEL_ID),
  })
  pushCandidate(seen, candidates, {
    name: 'gemini',
    modelId: GEMINI_CHAT_GEMMA_PREVIEW_MODEL_ID,
    model: google(GEMINI_CHAT_GEMMA_PREVIEW_MODEL_ID),
  })

  return candidates
}

export function getGoogleVisionModelCandidates(): GoogleVisionModelCandidate[] {
  const env = validateEnv(getRuntimeConfigSafe())
  const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey })
  return resolveGeminiPipelineModelIds(env).map((modelId) => ({
    modelId,
    model: google(modelId),
  }))
}

export function getGoogleVisionModel(): LanguageModel {
  const [first] = getGoogleVisionModelCandidates()
  if (!first) {
    const env = validateEnv(getRuntimeConfigSafe())
    return createGoogleGenerativeAI({ apiKey: env.googleApiKey })('gemini-2.5-flash')
  }
  return first.model
}

export function getGeminiModelById(modelId: string): LanguageModel {
  const env = validateEnv(getRuntimeConfigSafe())
  return createGoogleGenerativeAI({ apiKey: env.googleApiKey })(modelId)
}
