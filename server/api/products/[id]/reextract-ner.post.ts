import mongoose from 'mongoose'
import { reextractProductNer } from '~~/server/services/products/reextract-product-ner'
import { enforceAuthRateLimit } from '~~/server/utils/auth-rate-limit'
import { createNotFoundError } from '~~/server/utils/errors'
import { ok } from '~~/server/utils/response'

export default defineEventHandler(async (event) => {
  enforceAuthRateLimit(event, 'products:reextract-ner', 10, 60_000)
  const auth = requireAuth(event)

  const productId = getRouterParam(event, 'id')
  if (!productId || !mongoose.isValidObjectId(productId)) {
    throw createNotFoundError('Producto academico')
  }

  const result = await reextractProductNer({
    productId,
    userId: auth.sub,
    isAdmin: auth.role === 'admin',
  })

  return ok(result)
})
