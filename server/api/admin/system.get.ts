import mongoose from 'mongoose'
import { requireRole } from '~~/server/utils/authorize'
import UploadedFile from '~~/server/models/UploadedFile'
import { ok } from '~~/server/utils/response'
import * as os from 'node:os'

export default defineEventHandler(async (event) => {
  requireRole(event, 'admin')

  // Collect Node.js process data
  const memoryUsage = process.memoryUsage()
  const uptime = process.uptime()

  // Collect DB status
  const dbStateMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  }
  const dbStatus = dbStateMap[mongoose.connection.readyState] || 'unknown'

  // Determine an overall health status
  const healthStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'degraded'

  const [processingQueue, latestCompleted] = await Promise.all([
    UploadedFile.countDocuments({
      isDeleted: false,
      processingStatus: { $in: ['pending', 'processing'] },
    }),
    UploadedFile.findOne({
      isDeleted: false,
      processingStatus: 'completed',
      processingCompletedAt: { $ne: null },
    })
      .sort({ processingCompletedAt: -1 })
      .select({ processingCompletedAt: 1 })
      .lean(),
  ])

  return ok({
    health: healthStatus,
    timestamp: new Date().toISOString(),
    system: {
      uptimeSeconds: uptime,
      memoryUsage: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
      },
      os: {
        platform: os.platform(),
        release: os.release(),
        totalMem: os.totalmem(),
        freeMem: os.freemem(),
        loadAvg: os.loadavg(),
      },
    },
    database: {
      status: dbStatus,
      name: mongoose.connection.name,
      host: mongoose.connection.host,
    },
    services: {
      ocr: {
        status: 'online',
        lastProcessed: latestCompleted?.processingCompletedAt?.toISOString() ?? null,
        queueLength: processingQueue,
      },
      ner: {
        status: 'online',
        lastExtracted: latestCompleted?.processingCompletedAt?.toISOString() ?? null,
        queueLength: processingQueue,
      },
    },
  })
})
