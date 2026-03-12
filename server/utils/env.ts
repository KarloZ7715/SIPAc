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
  googleApiKey: z.string().min(1, 'GOOGLE_API_KEY es requerido'),
  cerebrasApiKey: z.string().optional().default(''),
  mistralApiKey: z.string().optional().default(''),
  ocrProvider: z.enum(['gemini', 'mistral']).default('gemini'),
  llmProvider: z.enum(['gemini', 'cerebras']).default('cerebras'),
  nerConfidenceThreshold: z.coerce.number().min(0).max(1).default(0.7),
  rateLimitDocumentsPerHour: z.coerce.number().int().positive().default(15),
  resendApiKey: z.string().optional().default(''),
  resendFromEmail: z
    .union([z.literal(''), z.email('RESEND_FROM_EMAIL debe ser un correo válido')])
    .default(''),
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
