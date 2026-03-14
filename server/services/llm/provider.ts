import type { LanguageModel } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { validateEnv } from '~~/server/utils/env'

export type StructuredLlmProvider = 'gemini' | 'cerebras' | 'groq'

const GEMINI_FLASH_MODEL_ID = 'gemini-2.5-flash'
const GEMINI_FLASH_LITE_MODEL_ID = 'gemini-2.5-flash-lite'
const GROQ_GPT_OSS_120B_MODEL_ID = 'openai/gpt-oss-120b'
const GROQ_GPT_OSS_20B_MODEL_ID = 'openai/gpt-oss-20b'
const CEREBRAS_QWEN_MODEL_ID = 'qwen-3-235b-a22b-instruct-2507'
const CEREBRAS_GPT_OSS_MODEL_ID = 'gpt-oss-120b'

export interface StructuredModelCandidate {
  name: StructuredLlmProvider
  modelId: string
  model: LanguageModel
}

function getRuntimeConfigSafe(): Record<string, unknown> {
  try {
    return useRuntimeConfig()
  } catch {
    return {}
  }
}

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

  const candidates: StructuredModelCandidate[] = []

  candidates.push({
    name: 'gemini',
    modelId: GEMINI_FLASH_MODEL_ID,
    model: google(GEMINI_FLASH_MODEL_ID),
  })

  if (groq) {
    candidates.push({
      name: 'groq',
      modelId: GROQ_GPT_OSS_120B_MODEL_ID,
      model: groq(GROQ_GPT_OSS_120B_MODEL_ID),
    })
  }

  candidates.push({
    name: 'gemini',
    modelId: GEMINI_FLASH_LITE_MODEL_ID,
    model: google(GEMINI_FLASH_LITE_MODEL_ID),
  })

  if (groq) {
    candidates.push({
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

  const candidates: StructuredModelCandidate[] = []

  if (cerebras) {
    candidates.push({
      name: 'cerebras',
      modelId: CEREBRAS_GPT_OSS_MODEL_ID,
      model: cerebras(CEREBRAS_GPT_OSS_MODEL_ID),
    })
  }

  candidates.push({
    name: 'gemini',
    modelId: GEMINI_FLASH_MODEL_ID,
    model: google(GEMINI_FLASH_MODEL_ID),
  })

  if (cerebras) {
    candidates.push({
      name: 'cerebras',
      modelId: CEREBRAS_QWEN_MODEL_ID,
      model: cerebras(CEREBRAS_QWEN_MODEL_ID),
    })
  }

  return candidates
}

export function getGoogleVisionModel() {
  const env = validateEnv(getRuntimeConfigSafe())
  const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey })
  return google(GEMINI_FLASH_MODEL_ID)
}
