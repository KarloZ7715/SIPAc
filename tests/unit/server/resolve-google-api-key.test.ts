import { describe, expect, it } from 'vitest'
import { resolveGoogleApiKeyFromProcessEnv } from '../../../server/utils/resolve-google-api-key'

describe('resolveGoogleApiKeyFromProcessEnv', () => {
  it('prefiere GOOGLE_API_KEY_TEST cuando ambas están definidas', () => {
    expect(
      resolveGoogleApiKeyFromProcessEnv({
        GOOGLE_API_KEY_TEST: '  test-key  ',
        GOOGLE_API_KEY: 'prod-key',
      }),
    ).toBe('test-key')
  })

  it('usa GOOGLE_API_KEY si no hay clave de prueba', () => {
    expect(
      resolveGoogleApiKeyFromProcessEnv({
        GOOGLE_API_KEY: 'prod-only',
      }),
    ).toBe('prod-only')
  })

  it('devuelve cadena vacía si no hay ninguna', () => {
    expect(resolveGoogleApiKeyFromProcessEnv({})).toBe('')
  })
})
