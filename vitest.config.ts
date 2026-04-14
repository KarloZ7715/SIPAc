import { defineVitestConfig } from '@nuxt/test-utils/config'
import { resolveGoogleApiKeyFromProcessEnv } from './server/utils/resolve-google-api-key'

const resolvedGoogleApiKey = resolveGoogleApiKeyFromProcessEnv()

export default defineVitestConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    env: {
      ...(resolvedGoogleApiKey ? { GOOGLE_API_KEY: resolvedGoogleApiKey } : {}),
    },
    include: ['tests/**/*.{test,spec}.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['server/**/*.ts', 'app/**/*.{ts,vue}'],
      exclude: ['server/plugins/**', '**/*.d.ts', 'tests/**'],
    },
  },
})
