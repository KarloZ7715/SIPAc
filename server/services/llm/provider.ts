import type { LanguageModel } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { validateEnv, type EnvConfig } from '~~/server/utils/env'

export type StructuredLlmProvider = 'gemini' | 'cerebras' | 'groq' | 'openrouter' | 'nvidia'

const GROQ_GPT_OSS_120B_MODEL_ID = 'openai/gpt-oss-120b'
const GROQ_GPT_OSS_20B_MODEL_ID = 'openai/gpt-oss-20b'
const CEREBRAS_QWEN_MODEL_ID = 'qwen-3-235b-a22b-instruct-2507'
const GEMINI_CHAT_MODEL_ID = 'gemini-2.5-flash'

const GEMINI_FLASH_PIPELINE_MODEL_IDS = [
  'gemini-3.1-flash-lite-preview',
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

const NER_NVIDIA_MODEL_IDS_ORDERED = [
  'z-ai/glm4.7',
  'deepseek-ai/deepseek-v3.1-terminus',
  // deepseek-ai/deepseek-v3.1 se excluye por bad request recurrente en chat.
  'mistralai/mistral-large-3-675b-instruct-2512',
  'deepseek-ai/deepseek-v3.2',
] as const

const NER_OPENROUTER_MODEL_IDS_ORDERED = [
  'minimax/minimax-m2.5:free',
  'openai/gpt-oss-120b:free',
] as const

/** Modelos extra solo en chat (no alteran la cadena NER). */
const CHAT_OPENROUTER_MODEL_IDS_ORDERED = [
  ...NER_OPENROUTER_MODEL_IDS_ORDERED,
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'z-ai/glm-4.5-air:free',
] as const

const CHAT_NVIDIA_MODEL_IDS_ORDERED = [
  ...NER_NVIDIA_MODEL_IDS_ORDERED,
  'moonshotai/kimi-k2-instruct-0905',
] as const
const CHAT_GROQ_MODEL_IDS_ORDERED = [GROQ_GPT_OSS_120B_MODEL_ID, GROQ_GPT_OSS_20B_MODEL_ID] as const

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
    for (const modelId of NER_NVIDIA_MODEL_IDS_ORDERED) {
      pushCandidate(seen, candidates, {
        name: 'nvidia',
        modelId,
        model: nvidia(modelId),
      })
    }
  }

  if (openrouter) {
    for (const modelId of NER_OPENROUTER_MODEL_IDS_ORDERED) {
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
  const cerebras =
    env.cerebrasApiKey.length > 0
      ? createOpenAICompatible({
          name: 'cerebras',
          apiKey: env.cerebrasApiKey,
          baseURL: 'https://api.cerebras.ai/v1',
          supportsStructuredOutputs: true,
        })
      : null
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

  if (cerebras) {
    pushCandidate(seen, candidates, {
      name: 'cerebras',
      modelId: CEREBRAS_QWEN_MODEL_ID,
      model: cerebras(CEREBRAS_QWEN_MODEL_ID),
    })
  }

  if (nvidia) {
    for (const modelId of CHAT_NVIDIA_MODEL_IDS_ORDERED) {
      pushCandidate(seen, candidates, {
        name: 'nvidia',
        modelId,
        model: nvidia(modelId),
      })
    }
  }

  if (groq) {
    pushCandidate(seen, candidates, {
      name: 'groq',
      modelId: GROQ_GPT_OSS_120B_MODEL_ID,
      model: groq(GROQ_GPT_OSS_120B_MODEL_ID),
    })
  }

  if (groq) {
    pushCandidate(seen, candidates, {
      name: 'groq',
      modelId: GROQ_GPT_OSS_20B_MODEL_ID,
      model: groq(GROQ_GPT_OSS_20B_MODEL_ID),
    })
  }

  if (openrouter) {
    for (const modelId of CHAT_OPENROUTER_MODEL_IDS_ORDERED) {
      pushCandidate(seen, candidates, {
        name: 'openrouter',
        modelId,
        model: openrouter(modelId),
      })
    }
  }

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

  if (cerebras) {
    pushCandidate(seen, candidates, {
      name: 'cerebras',
      modelId: CEREBRAS_QWEN_MODEL_ID,
      model: cerebras(CEREBRAS_QWEN_MODEL_ID),
    })
  }

  if (groq) {
    for (const modelId of CHAT_GROQ_MODEL_IDS_ORDERED) {
      pushCandidate(seen, candidates, {
        name: 'groq',
        modelId,
        model: groq(modelId),
      })
    }
  }

  if (nvidia) {
    for (const modelId of CHAT_NVIDIA_MODEL_IDS_ORDERED) {
      pushCandidate(seen, candidates, {
        name: 'nvidia',
        modelId,
        model: nvidia(modelId),
      })
    }
  }

  if (openrouter) {
    for (const modelId of CHAT_OPENROUTER_MODEL_IDS_ORDERED) {
      pushCandidate(seen, candidates, {
        name: 'openrouter',
        modelId,
        model: openrouter(modelId),
      })
    }
  }

  // Gemini queda fuera de la política normal del chat. Se deja disponible solo
  // como candidato excepcional para diagnóstico futuro si se decide exponerlo.
  pushCandidate(seen, candidates, {
    name: 'gemini',
    modelId: GEMINI_CHAT_MODEL_ID,
    model: google(GEMINI_CHAT_MODEL_ID),
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

/** Primer modelo de la cadena OCR visión (compatibilidad). */
export function getGoogleVisionModel(): LanguageModel {
  const [first] = getGoogleVisionModelCandidates()
  if (!first) {
    const env = validateEnv(getRuntimeConfigSafe())
    return createGoogleGenerativeAI({ apiKey: env.googleApiKey })('gemini-2.5-flash')
  }
  return first.model
}

/** Un modelo Gemini por id (p. ej. segmentación barata). */
export function getGeminiModelById(modelId: string): LanguageModel {
  const env = validateEnv(getRuntimeConfigSafe())
  return createGoogleGenerativeAI({ apiKey: env.googleApiKey })(modelId)
}
