import mongoose from 'mongoose'
import { validateCoreEnv } from '~~/server/utils/env'

export default defineNitroPlugin(async () => {
  const config = validateCoreEnv(useRuntimeConfig())

  if (mongoose.connection.readyState === 1) {
    return
  }

  if (mongoose.connection.readyState === 2) {
    return
  }

  try {
    await mongoose.connect(config.mongodbUri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      autoIndex: process.env.NODE_ENV !== 'production',
    })

    console.info(`[MongoDB] Conectado a ${mongoose.connection.host}/${mongoose.connection.name}`)
  } catch (error) {
    console.error('[MongoDB] Error de conexión:', error)
    throw error
  }

  if (mongoose.connection.listeners('error').length === 0) {
    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Error de conexión:', err)
    })
  }

  if (mongoose.connection.listeners('disconnected').length === 0) {
    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Desconectado')
    })
  }
})
