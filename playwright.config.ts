import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolveGoogleApiKeyFromProcessEnv } from './server/utils/resolve-google-api-key'

const resolvedGoogleApiKey = resolveGoogleApiKeyFromProcessEnv()
const playwrightPort = Number(process.env.PLAYWRIGHT_PORT ?? 4173)
const playwrightBaseUrl = `http://127.0.0.1:${playwrightPort}`

function readDotEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {}
  }

  const envFile = readFileSync(filePath, 'utf8')
  const env: Record<string, string> = {}

  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex <= 0) {
      continue
    }

    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    } else {
      const commentIndex = value.indexOf(' #')
      if (commentIndex >= 0) {
        value = value.slice(0, commentIndex).trim()
      }
    }

    env[key] = value
  }

  return env
}

const dotenvEnv = readDotEnvFile('.env')
const resolvedWebServerEnv = {
  ...dotenvEnv,
  ...process.env,
  ...(resolvedGoogleApiKey ? { GOOGLE_API_KEY: resolvedGoogleApiKey } : {}),
}

const projects = process.env.CI
  ? [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
  : [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    ]

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: playwrightBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects,
  webServer: {
    command: `pnpm exec nuxt dev --port ${playwrightPort} --host 127.0.0.1`,
    url: playwrightBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: resolvedWebServerEnv,
  },
})
