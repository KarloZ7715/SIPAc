import mongoose from 'mongoose'
import { PRODUCT_TYPES, type ProductType } from '~~/app/types'
import { createAuthenticationError } from '~~/server/utils/errors'
import type { TokenPayload } from '~~/server/utils/jwt'

export function parseDashboardDateParam(value: unknown, boundary: 'start' | 'end') {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }

  if (boundary === 'end') {
    parsed.setUTCHours(23, 59, 59, 999)
  } else {
    parsed.setUTCHours(0, 0, 0, 0)
  }

  return parsed
}

export function parseDashboardProductTypesParam(value: unknown): ProductType[] {
  const rawValues = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []

  const normalized = rawValues
    .flatMap((candidate) => candidate.split(','))
    .map((candidate) => candidate.trim())
    .filter((candidate): candidate is ProductType =>
      (PRODUCT_TYPES as readonly string[]).includes(candidate),
    )

  return Array.from(new Set(normalized))
}

/**
 * Misma base de filtro que el tablero de repositorio confirmado (`/api/dashboard`).
 * `from` / `to` se aplican a la fecha efectiva manual o extraída.
 */
export function buildDashboardRepositoryMatch(
  auth: TokenPayload,
  query: Record<string, unknown>,
): { match: Record<string, unknown>; from?: Date; to?: Date } {
  const match: Record<string, unknown> = {
    isDeleted: false,
    reviewStatus: 'confirmed',
  }

  const productTypes = parseDashboardProductTypesParam(query.productType)

  if (productTypes.length === 1) {
    match.productType = productTypes[0]
  } else if (productTypes.length > 1) {
    match.productType = { $in: productTypes }
  }

  if (auth.role === 'admin') {
    if (typeof query.owner === 'string' && mongoose.isValidObjectId(query.owner)) {
      match.owner = new mongoose.Types.ObjectId(query.owner)
    }
  } else if (mongoose.isValidObjectId(auth.sub)) {
    match.owner = new mongoose.Types.ObjectId(auth.sub)
  } else {
    throw createAuthenticationError()
  }

  const from = parseDashboardDateParam(query.from, 'start')
  const to = parseDashboardDateParam(query.to, 'end')
  if (from || to) {
    match.$expr = {
      $and: [
        ...(from
          ? [
              {
                $gte: [
                  { $ifNull: ['$manualMetadata.date', '$extractedEntities.date.value'] },
                  from,
                ],
              },
            ]
          : []),
        ...(to
          ? [
              {
                $lte: [{ $ifNull: ['$manualMetadata.date', '$extractedEntities.date.value'] }, to],
              },
            ]
          : []),
      ],
    }
  }

  return { match, from, to }
}
