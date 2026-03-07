export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxt/eslint', 'nuxt-security'],

  css: ['~/assets/css/main.css'],

  typescript: {
    strict: true,
  },

  runtimeConfig: {
    mongodbUri: process.env.MONGODB_URI ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    adminEmail: process.env.ADMIN_EMAIL ?? '',
    adminPassword: process.env.ADMIN_PASSWORD ?? '',
    googleApiKey: process.env.GOOGLE_API_KEY ?? '',
    mistralApiKey: process.env.MISTRAL_API_KEY ?? '',
    ocrProvider: process.env.OCR_PROVIDER ?? 'gemini',
    nerConfidenceThreshold: Number(process.env.NER_CONFIDENCE_THRESHOLD ?? 0.7),
    rateLimitDocumentsPerHour: Number(process.env.RATE_LIMIT_DOCS_PER_HOUR ?? 15),
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
      maxRequestSizeInBytes: 2000000,
      maxUploadFileRequestInBytes: 8000000,
    },
  },

  nitro: {
    experimental: {
      asyncContext: true,
    },
  },
})
