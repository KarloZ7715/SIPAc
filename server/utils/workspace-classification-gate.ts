import { PRODUCT_TYPES } from '~~/app/types'
import type { DocumentClassificationProfile } from '~~/server/services/ner/extract-academic-entities'

/** Confianza mínima para rechazar un archivo marcado como no académico (evita cortes por dudas muy bajas). */
const NON_ACADEMIC_REJECT_MIN_CONFIDENCE = 0.55

const ALLOWED_TYPES = new Set<string>(PRODUCT_TYPES)

/**
 * Si el perfil no debe continuar al NER, devuelve un mensaje listo para el usuario final.
 * En caso contrario, null.
 */
export function getWorkspaceClassificationRejectionMessage(
  profile: DocumentClassificationProfile,
): string | null {
  if (
    profile.documentClassification === 'non_academic' &&
    profile.classificationConfidence >= NON_ACADEMIC_REJECT_MIN_CONFIDENCE
  ) {
    return 'Este archivo no encaja con lo que registramos aquí: parece un documento que no es una producción académica (por ejemplo un recibo, un correo o material administrativo). Solo puedes dar de alta trabajos como artículos, libros, ponencias, tesis u otros tipos de producción académica. Prueba con otro archivo.'
  }

  const rawType = profile.productType as string
  if (!ALLOWED_TYPES.has(rawType)) {
    return 'No logramos reconocer en este archivo un tipo de producción académica que podamos registrar. Comprueba que sea un trabajo académico (por ejemplo artículo, libro, ponencia o tesis) y que el texto se lea con claridad.'
  }

  return null
}
