import { z } from 'zod'
import { PRODUCT_TYPES, VERIFICATION_STATUSES } from '~~/app/types'

export const manualMetadataSchema = z.object({
  title: z.string().trim().optional(),
  authors: z.array(z.string().trim()).default([]),
  institution: z.string().trim().optional(),
  date: z.coerce.date().optional(),
  doi: z.string().trim().optional(),
  keywords: z.array(z.string().trim()).default([]),
  notes: z.string().max(2000, 'Las notas no pueden superar los 2000 caracteres').optional(),
})

export const updateProductSchema = z.object({
  manualMetadata: manualMetadataSchema.optional(),
})

export const verifyProductSchema = z.object({
  verificationStatus: z.enum(['verified', 'rejected']),
  rejectionReason: z
    .string()
    .max(500, 'El motivo de rechazo no puede superar los 500 caracteres')
    .optional(),
})

export const productQuerySchema = z.object({
  productType: z.enum(PRODUCT_TYPES).optional(),
  verificationStatus: z.enum(VERIFICATION_STATUSES).optional(),
  owner: z.string().optional(),
  search: z.string().optional(),
  cursor: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(10).max(50).optional().default(20),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})
