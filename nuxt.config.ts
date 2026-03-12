const maxUploadFileSizeBytes = 20_971_520
const maxMultipartRequestSizeBytes = 22_020_096

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxt/eslint', 'nuxt-security'],

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
    cerebrasApiKey: process.env.CEREBRAS_API_KEY ?? '',
    mistralApiKey: process.env.MISTRAL_API_KEY ?? '',
    ocrProvider: process.env.OCR_PROVIDER ?? 'gemini',
    llmProvider: process.env.LLM_PROVIDER ?? 'cerebras',
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
    },
  },

  eslint: {
    config: {
      standalone: true,
    },
  },

  security: {
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
})
