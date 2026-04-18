import { Google } from 'arctic'

let _google: Google | null = null

export interface GoogleOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export function getGoogleClient(): Google | null {
  if (_google) return _google
  const config = useRuntimeConfig()
  const clientId = String(config.googleOauthClientId || '')
  const clientSecret = String(config.googleOauthClientSecret || '')
  const redirectUri = String(config.googleOauthRedirectUri || '')
  if (!clientId || !clientSecret || !redirectUri) return null
  _google = new Google(clientId, clientSecret, redirectUri)
  return _google
}

export function assertGoogleConfigured(): Google {
  const client = getGoogleClient()
  if (!client) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Google OAuth no está configurado en el servidor',
    })
  }
  return client
}
