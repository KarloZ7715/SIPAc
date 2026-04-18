import { resolveGoogleApiKeyFromProcessEnv } from './server/utils/resolve-google-api-key'

const maxUploadFileSizeBytes = 20_971_520
const maxMultipartRequestSizeBytes = 22_020_096
const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
const hasSentryDsn = Boolean(process.env.SENTRY_DSN)
const enableSentry = isProduction && hasSentryDsn
const enableNuxtDevtools = process.env.NUXT_PUBLIC_ENABLE_DEVTOOLS === 'true'
const modules = ['@nuxt/ui', '@pinia/nuxt', '@nuxt/eslint'] as string[]

if (!isTest) {
  modules.push('nuxt-security')
  modules.push('@sentry/nuxt/module')
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules,
  css: ['~/assets/css/main.css'],

  typescript: {
    strict: true,
  },

  vite: {
    server: {
      allowedHosts: ['localhost', '127.0.0.1', '.trycloudflare.com'],
    },
    optimizeDeps: {
      include: [
        'pdfjs-dist/legacy/build/pdf.mjs',
        'motion-v',
        'ai',
        '@ai-sdk/vue',
        'chart.js',
        'vue-chartjs',
      ],
    },
  },

  runtimeConfig: {
    mongodbUri: process.env.MONGODB_URI ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    adminEmail: process.env.ADMIN_EMAIL ?? '',
    adminPassword: process.env.ADMIN_PASSWORD ?? '',
    googleApiKey: resolveGoogleApiKeyFromProcessEnv(),
    googleGeminiIncludeProModels: process.env.GOOGLE_GEMINI_INCLUDE_PRO_MODELS === 'true',
    groqApiKey: process.env.GROQ_API_KEY ?? '',
    nvidiaApiKey: process.env.NVIDIA_API_KEY ?? '',
    nvidiaApiBaseUrl:
      process.env.NVIDIA_API_BASE_URL?.trim() || 'https://integrate.api.nvidia.com/v1',
    openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
    openrouterAppUrl: process.env.OPENROUTER_APP_URL ?? '',
    cerebrasApiKey: process.env.CEREBRAS_API_KEY ?? '',
    mistralApiKey: process.env.MISTRAL_API_KEY ?? '',
    ocrProvider: process.env.OCR_PROVIDER ?? 'gemini',
    llmProvider: process.env.LLM_PROVIDER ?? 'cerebras',
    ocrRequestTimeoutMs: Number(process.env.OCR_REQUEST_TIMEOUT_MS ?? 45000),
    ocrMaxGeminiVisionAttempts: Number(process.env.OCR_MAX_GEMINI_VISION_ATTEMPTS ?? 6),
    nerRequestTimeoutMs: Number(process.env.NER_REQUEST_TIMEOUT_MS ?? 35000),
    nerMaxCandidateAttempts: Number(process.env.NER_MAX_CANDIDATE_ATTEMPTS ?? 4),
    nerConfidenceThreshold: Number(process.env.NER_CONFIDENCE_THRESHOLD ?? 0.7),
    nerAlwaysSecondPass: process.env.NER_ALWAYS_SECOND_PASS === 'true',
    nerMergeExtractionPasses: process.env.NER_MERGE_EXTRACTION_PASSES !== 'false',
    nerProductSpecificFillPass: process.env.NER_PRODUCT_SPECIFIC_FILL_PASS !== 'false',
    nerProductSpecificSparseThreshold: Number(
      process.env.NER_PRODUCT_SPECIFIC_SPARSE_THRESHOLD ?? 0.4,
    ),
    nerSegmentationEnabled: process.env.NER_SEGMENTATION_ENABLED === 'true',
    nerSegmentationMaxSegments: Number(process.env.NER_SEGMENTATION_MAX_SEGMENTS ?? 6),
    nerSegmentationInputMaxChars: Number(process.env.NER_SEGMENTATION_INPUT_MAX_CHARS ?? 28000),
    nerSegmentationMinSegmentChars: Number(process.env.NER_SEGMENTATION_MIN_SEGMENT_CHARS ?? 400),
    nerSegmentationModelId:
      process.env.NER_SEGMENTATION_MODEL_ID?.trim() || 'gemini-2.5-flash-lite',
    rateLimitDocumentsPerHour: Number(process.env.RATE_LIMIT_DOCS_PER_HOUR ?? 15),
    brevoApiKey: process.env.BREVO_API_KEY ?? '',
    brevoFromEmail: process.env.BREVO_FROM_EMAIL ?? '',
    brevoFromName: process.env.BREVO_FROM_NAME ?? '',
    googleOauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
    googleOauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
    googleOauthRedirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? '',
    publicAppUrl: process.env.NUXT_PUBLIC_APP_URL ?? '',
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
      xFrameOptions: 'SAMEORIGIN',
      contentSecurityPolicy: {
        'img-src': ["'self'", 'data:', 'https:'],
        // Vista previa PDF en iframe (blob: / misma app) en workspace.
        'frame-src': ["'self'", 'blob:', 'data:'],
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

  ...(isTest ? {} : { devtools: { enabled: enableNuxtDevtools } }),

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

  devtools: {
    enabled: enableNuxtDevtools,
  },
})
