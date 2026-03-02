import { z } from 'zod'
import { ALLOWED_MIME_TYPES, PRODUCT_TYPES, MAX_FILE_SIZE_BYTES } from '~~/app/types'

export const uploadMetadataSchema = z.object({
  productType: z.enum(PRODUCT_TYPES, {
    error: 'El tipo de producto académico es requerido o inválido',
  }),
})

export const fileValidationSchema = z.object({
  mimeType: z.enum(ALLOWED_MIME_TYPES, {
    error: 'Tipo de archivo no permitido. Solo se aceptan PDF, JPG y PNG',
  }),
  size: z.number().max(MAX_FILE_SIZE_BYTES, 'El archivo no puede superar los 20 MB'),
})
