import { generateCodeVerifier, generateState } from 'arctic'
import { assertGoogleConfigured } from '~~/server/utils/google-oauth'

export default defineEventHandler(async (event) => {
  const google = assertGoogleConfigured()
  const state = generateState()
  const codeVerifier = generateCodeVerifier()

  const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile'])

  setCookie(event, 'google_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
  })
  setCookie(event, 'google_oauth_verifier', codeVerifier, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
  })

  return sendRedirect(event, url.toString(), 302)
})
