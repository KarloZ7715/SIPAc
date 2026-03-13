import type { LanguageModel } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { validateEnv } from '~~/server/utils/env'

export type StructuredLlmProvider = 'gemini' | 'cerebras'

export interface StructuredModelCandidate {
  name: StructuredLlmProvider
  modelId: string
  model: LanguageModel
}

export function getStructuredModelCandidates(): StructuredModelCandidate[] {
  const env = validateEnv(useRuntimeConfig())
  const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey })

  const candidates: StructuredModelCandidate[] = []

  if (env.llmProvider === 'cerebras' && env.cerebrasApiKey) {
    const cerebras = createOpenAICompatible({
      name: 'cerebras',
      apiKey: env.cerebrasApiKey,
      baseURL: 'https://api.cerebras.ai/v1',
    })

    candidates.push({
      name: 'cerebras',
      modelId: 'gpt-oss-120b',
      model: cerebras('gpt-oss-120b'),
    })
  }

  candidates.push({
    name: 'gemini',
    modelId: 'gemini-2.5-flash',
    model: google('gemini-2.5-flash'),
  })

  return candidates
}

export function getGoogleVisionModel() {
  const env = validateEnv(useRuntimeConfig())
  const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey })
  return google('gemini-2.5-flash')
}
