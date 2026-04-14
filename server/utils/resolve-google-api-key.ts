export function resolveGoogleApiKeyFromProcessEnv(env: NodeJS.ProcessEnv = process.env): string {
  const testKey = env.GOOGLE_API_KEY_TEST?.trim()
  if (testKey) {
    return testKey
  }
  return env.GOOGLE_API_KEY?.trim() ?? ''
}
