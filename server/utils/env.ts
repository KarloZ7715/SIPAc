import { z } from 'zod'

const envSchema = z.object({
  mongodbUri: z.string().min(1, 'MONGODB_URI es requerido'),
  jwtSecret: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  googleApiKey: z.string().min(1, 'GOOGLE_API_KEY es requerido'),
  mistralApiKey: z.string().optional().default(''),
  ocrProvider: z.enum(['gemini', 'mistral']).default('gemini'),
  nerConfidenceThreshold: z.coerce.number().min(0).max(1).default(0.7),
  rateLimitDocumentsPerHour: z.coerce.number().int().positive().default(15),
})

export type EnvConfig = z.infer<typeof envSchema>

let _validated: EnvConfig | null = null

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  if (_validated) return _validated

  const result = envSchema.safeParse(config)

  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Variables de entorno inválidas:\n${formatted}`)
  }

  _validated = result.data
  return _validated
}
