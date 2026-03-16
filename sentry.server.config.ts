import * as Sentry from '@sentry/nuxt'

const dsn = process.env.SENTRY_DSN ?? ''
const environment = process.env.SENTRY_ENV ?? process.env.NODE_ENV ?? 'development'
const isProduction = environment === 'production'

if (dsn && isProduction) {
  Sentry.init({
    dsn,

    tracesSampleRate: isProduction ? 0.2 : 1.0,
    enableLogs: !isProduction,
    sendDefaultPii: false,
    environment,

    beforeSend(event) {
      const httpStatus = event.contexts?.response?.status_code as number | undefined
      if (httpStatus && [401, 403, 404, 422, 429].includes(httpStatus)) {
        return null
      }
      return event
    },

    debug: !isProduction,
  })
}
