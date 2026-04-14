import { z } from 'zod'
import { ALLOWED_MIME_TYPES, PRODUCT_TYPES, MAX_FILE_SIZE_BYTES } from '~~/app/types'

export const uploadMetadataSchema = z.object({
  productType: z
    .enum(PRODUCT_TYPES, {
      error: 'El tipo de producto académico no es válido',
    })
    .optional(),
  /** multipart: "true" | "1" fuerza un solo trabajo (sin segmentación multi-obra). */
  nerForceSingleDocument: z.enum(['true', 'false', '1', '0', '']).optional(),
})

export const fileValidationSchema = z.object({
  mimeType: z.enum(ALLOWED_MIME_TYPES, {
    error:
      'Tipo de archivo no permitido. Aceptamos PDF, imágenes (JPG/PNG) y Office estructurado (p. ej. .docx, .xlsx, .pptx, ODF)',
  }),
  size: z.number().max(MAX_FILE_SIZE_BYTES, 'El archivo no puede superar los 20 MB'),
})
