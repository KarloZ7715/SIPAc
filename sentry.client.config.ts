import * as Sentry from '@sentry/nuxt'

const config = useRuntimeConfig().public.sentry as { dsn?: string; environment?: string }
const dsn = config?.dsn ?? ''
const environment = config?.environment ?? 'development'
const isProduction = environment === 'production'

if (dsn && isProduction) {
  Sentry.init({
    dsn,

    tracesSampleRate: isProduction ? 0.2 : 1.0,

    // Session Replay: solo grabar cuando hay error
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.replayIntegration()],

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
