import { z } from 'zod'
import { PRODUCT_TYPES } from '~~/app/types'

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

export const productQuerySchema = z.object({
  productType: z.enum(PRODUCT_TYPES).optional(),
  owner: z.string().optional(),
  search: z.string().optional(),
  cursor: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(10).max(50).optional().default(20),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})
