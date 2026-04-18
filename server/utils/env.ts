import { z } from 'zod'

function hasExplicitDatabaseName(uri: string) {
  try {
    const parsed = new URL(uri)
    return parsed.pathname !== '/'
  } catch {
    return false
  }
}

const mongodbUriSchema = z
  .string()
  .min(1, 'MONGODB_URI es requerido')
  .refine((value) => value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'), {
    message: 'MONGODB_URI debe iniciar con mongodb:// o mongodb+srv://',
  })
  .refine(hasExplicitDatabaseName, {
    message:
      'MONGODB_URI debe incluir explícitamente el nombre de la base de datos, por ejemplo /sipac',
  })

const optionalAdminEmailSchema = z.union([
  z.literal(''),
  z.email('ADMIN_EMAIL debe ser un correo válido'),
])
const optionalAdminPasswordSchema = z.union([
  z.literal(''),
  z.string().min(12, 'ADMIN_PASSWORD debe tener al menos 12 caracteres'),
])

const envSchema = z.object({
  mongodbUri: mongodbUriSchema,
  jwtSecret: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  googleApiKey: z
    .string()
    .min(1, 'Define GOOGLE_API_KEY_TEST (pruebas) o GOOGLE_API_KEY (producción)'),
  googleGeminiIncludeProModels: z.boolean().default(false),
  groqApiKey: z.string().optional().default(''),
  nvidiaApiKey: z.string().optional().default(''),
  nvidiaApiBaseUrl: z.string().min(1).default('https://integrate.api.nvidia.com/v1'),
  openrouterApiKey: z.string().optional().default(''),
  openrouterAppUrl: z.string().optional().default(''),
  cerebrasApiKey: z.string().optional().default(''),
  mistralApiKey: z.string().optional().default(''),
  ocrProvider: z.enum(['gemini', 'mistral']).default('gemini'),
  llmProvider: z.enum(['gemini', 'cerebras']).default('cerebras'),
  ocrRequestTimeoutMs: z.coerce.number().int().positive().default(45_000),
  ocrMaxGeminiVisionAttempts: z.coerce.number().int().positive().default(6),
  nerRequestTimeoutMs: z.coerce.number().int().positive().default(35_000),
  nerMaxCandidateAttempts: z.coerce.number().int().positive().default(4),
  nerConfidenceThreshold: z.coerce.number().min(0).max(1).default(0.7),
  /** Si true, siempre se ejecuta la segunda pasada de extracción común en documentos academic (más coste API). */
  nerAlwaysSecondPass: z.boolean().default(false),
  /** Si true, se fusionan pasada 1 y 2 en lugar de elegir solo la de mayor score calibrado. */
  nerMergeExtractionPasses: z.boolean().default(true),
  /** Segunda llamada LLM para metadatos específicos cuando la primera deja muchos campos vacíos. */
  nerProductSpecificFillPass: z.boolean().default(true),
  /** Si la proporción de campos rellenados es menor a este umbral, se intenta la pasada de relleno. */
  nerProductSpecificSparseThreshold: z.coerce.number().min(0).max(1).default(0.4),
  /** Segmentación multi-obra (compendios): requiere heurística + opcional LLM barato. */
  nerSegmentationEnabled: z.boolean().default(false),
  nerSegmentationMaxSegments: z.coerce.number().int().min(1).max(20).default(6),
  nerSegmentationInputMaxChars: z.coerce.number().int().min(2000).max(200_000).default(28_000),
  nerSegmentationMinSegmentChars: z.coerce.number().int().min(50).max(10_000).default(400),
  nerSegmentationModelId: z.string().trim().min(1).default('gemini-2.5-flash-lite'),
  rateLimitDocumentsPerHour: z.coerce.number().int().positive().default(15),
  brevoApiKey: z.string().optional().default(''),
  brevoFromEmail: z
    .union([z.literal(''), z.email('BREVO_FROM_EMAIL debe ser un correo válido')])
    .default(''),
  brevoFromName: z.string().optional().default(''),
  googleOauthClientId: z.string().optional().default(''),
  googleOauthClientSecret: z.string().optional().default(''),
  googleOauthRedirectUri: z.string().optional().default(''),
  publicAppUrl: z.string().optional().default(''),
})

const coreEnvSchema = z
  .object({
    mongodbUri: mongodbUriSchema,
    jwtSecret: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
    adminEmail: optionalAdminEmailSchema.default(''),
    adminPassword: optionalAdminPasswordSchema.default(''),
  })
  .superRefine((data, ctx) => {
    const hasAdminEmail = data.adminEmail.length > 0
    const hasAdminPassword = data.adminPassword.length > 0

    if (hasAdminEmail !== hasAdminPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['adminEmail'],
        message: 'ADMIN_EMAIL y ADMIN_PASSWORD deben configurarse juntos o dejarse ambos vacíos',
      })
    }
  })

export type EnvConfig = z.infer<typeof envSchema>
export type CoreEnvConfig = z.infer<typeof coreEnvSchema>

let _validated: EnvConfig | null = null
let _validatedCore: CoreEnvConfig | null = null

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

export function validateCoreEnv(config: Record<string, unknown>): CoreEnvConfig {
  if (_validatedCore) return _validatedCore

  const result = coreEnvSchema.safeParse(config)

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Variables de entorno base inválidas:\n${formatted}`)
  }

  _validatedCore = result.data
  return _validatedCore
}
