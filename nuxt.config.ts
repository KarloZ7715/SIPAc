const maxUploadFileSizeBytes = 20_971_520
const maxMultipartRequestSizeBytes = 22_020_096
const isProduction = process.env.NODE_ENV === 'production'
const hasSentryDsn = Boolean(process.env.SENTRY_DSN)
const enableSentry = isProduction && hasSentryDsn

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxt/eslint', 'nuxt-security', '@sentry/nuxt/module'],
  css: ['~/assets/css/main.css'],

  typescript: {
    strict: true,
  },

  vite: {
    server: {
      allowedHosts: ['localhost', '127.0.0.1', '.trycloudflare.com'],
    },
  },

  runtimeConfig: {
    mongodbUri: process.env.MONGODB_URI ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    adminEmail: process.env.ADMIN_EMAIL ?? '',
    adminPassword: process.env.ADMIN_PASSWORD ?? '',
    googleApiKey: process.env.GOOGLE_API_KEY ?? '',
    groqApiKey: process.env.GROQ_API_KEY ?? '',
    cerebrasApiKey: process.env.CEREBRAS_API_KEY ?? '',
    mistralApiKey: process.env.MISTRAL_API_KEY ?? '',
    ocrProvider: process.env.OCR_PROVIDER ?? 'gemini',
    llmProvider: process.env.LLM_PROVIDER ?? 'cerebras',
    ocrRequestTimeoutMs: Number(process.env.OCR_REQUEST_TIMEOUT_MS ?? 45000),
    nerRequestTimeoutMs: Number(process.env.NER_REQUEST_TIMEOUT_MS ?? 35000),
    nerMaxCandidateAttempts: Number(process.env.NER_MAX_CANDIDATE_ATTEMPTS ?? 4),
    nerConfidenceThreshold: Number(process.env.NER_CONFIDENCE_THRESHOLD ?? 0.7),
    rateLimitDocumentsPerHour: Number(process.env.RATE_LIMIT_DOCS_PER_HOUR ?? 15),
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    resendFromEmail: process.env.RESEND_FROM_EMAIL ?? '',
    session: {
      maxAge: 28800, // 8 hours
    },
    public: {
      appName: 'SIPAc',
      appDescription: 'Sistema Inteligente de Productividad Académica',
      enableTestingMetrics: process.env.NUXT_PUBLIC_ENABLE_TESTING_METRICS === 'true',
      sentry: {
        dsn: process.env.SENTRY_DSN ?? '',
        environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV ?? 'development',
      },
    },
  },

  eslint: {
    config: {
      standalone: true,
    },
  },

  security: {
    // Solo activo en producción. En desarrollo lo desactivamos porque Vite (HMR)
    // y el tooling pueden usar eval; en producción la CSP va activa y la vista
    // previa PDF es compatible gracias a getDocument({ isEvalSupported: false }).
    enabled: isProduction,
    headers: {
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        'img-src': ["'self'", 'data:', 'https:'],
      },
    },
    rateLimiter: {
      tokensPerInterval: 150,
      interval: 300000,
    },
    requestSizeLimiter: {
      maxRequestSizeInBytes: maxMultipartRequestSizeBytes,
      maxUploadFileRequestInBytes: maxUploadFileSizeBytes,
    },
  },

  nitro: {
    experimental: {
      asyncContext: true,
    },
  },

  sentry: enableSentry
    ? {
        org: process.env.SENTRY_ORG ?? 'carlos-cc',
        project: process.env.SENTRY_PROJECT ?? 'sipac-nuxt',
        autoInjectServerSentry: 'top-level-import',
      }
    : false,

  sourcemap: enableSentry
    ? {
        client: 'hidden',
      }
    : undefined,
})
