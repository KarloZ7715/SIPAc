import mongoose from 'mongoose'

export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()
  const isDev = process.env.NODE_ENV === 'development'

  if (!config.mongodbUri) {
    if (isDev) {
      console.warn('[MongoDB] MONGODB_URI no configurada')
      return
    }
    throw new Error('[MongoDB] MONGODB_URI es requerida')
  }

  try {
    await mongoose.connect(config.mongodbUri)
    console.warn('[MongoDB] Conexión establecida')
  } catch (error) {
    console.error('[MongoDB] Error de conexión:', error)
    throw error
  }

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Error de conexión:', err)
  })

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Desconectado')
  })
})
