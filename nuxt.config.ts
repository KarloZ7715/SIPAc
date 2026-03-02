import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: { enabled: true },

  modules: ['@pinia/nuxt', '@nuxt/eslint'],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss() as any],
  },

  typescript: {
    strict: true,
  },

  runtimeConfig: {
    mongodbUri: process.env.MONGODB_URI ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    googleApiKey: process.env.GOOGLE_API_KEY ?? '',
    mistralApiKey: process.env.MISTRAL_API_KEY ?? '',
    ocrProvider: process.env.OCR_PROVIDER ?? 'gemini',
    nerConfidenceThreshold: Number(process.env.NER_CONFIDENCE_THRESHOLD ?? 0.7),
    rateLimitDocumentsPerHour: Number(process.env.RATE_LIMIT_DOCS_PER_HOUR ?? 15),
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

  nitro: {
    experimental: {
      asyncContext: true,
    },
  },
})
