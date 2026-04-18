import { getGoogleClient } from '~~/server/utils/google-oauth'

export default defineEventHandler(() => {
  return ok({ enabled: getGoogleClient() !== null })
})
