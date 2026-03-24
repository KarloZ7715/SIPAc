import { z } from 'zod'
import {
  PRODUCT_TYPES,
  type ChatSearchToolInput,
  type ChatSearchToolOutput,
  type ProductType,
} from '~~/app/types'
import { executeGroundedRepositoryRetrieval } from '~~/server/services/chat/grounded-repository-retrieval'

const chatProductTypeLabels: Record<ProductType, string> = {
  article: 'Artículo',
  conference_paper: 'Ponencia',
  thesis: 'Tesis',
  certificate: 'Certificado',
  research_project: 'Proyecto de investigación',
  book: 'Libro',
  book_chapter: 'Capítulo de libro',
  technical_report: 'Informe técnico',
  software: 'Software',
  patent: 'Patente',
}

export const chatSearchToolInputSchema = z.object({
  question: z.string().trim().min(1).max(500),
  search: z.string().trim().max(160).optional(),
  title: z.string().trim().max(160).optional(),
  author: z.string().trim().max(160).optional(),
  institution: z.string().trim().max(160).optional(),
  keyword: z.string().trim().max(160).optional(),
  productType: z.enum(PRODUCT_TYPES).optional(),
  dateFrom: z.string().trim().max(32).optional(),
  dateTo: z.string().trim().max(32).optional(),
  yearFrom: z.number().int().min(1900).max(2100).optional(),
  yearTo: z.number().int().min(1900).max(2100).optional(),
  limit: z.number().int().min(1).max(8).optional(),
})

function compactText(values: Array<string | undefined>) {
  return values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
}

export function createRepositorySearchToolExecutor() {
  const toolCache = new Map<string, ChatSearchToolOutput>()

  return async function executeRepositorySearchTool(
    input: ChatSearchToolInput,
  ): Promise<ChatSearchToolOutput> {
    const output = await executeGroundedRepositoryRetrieval(input)

    const cached = toolCache.get(output.toolCallKey)
    if (cached) {
      return {
        ...cached,
        deduplicated: true,
      }
    }

    toolCache.set(output.toolCallKey, output)
    return output
  }
}

export function buildChatSystemPrompt() {
  return [
    'Eres el asistente de búsqueda académica de SIPAc.',
    'Tu alcance está restringido al repositorio confirmado del sistema.',
    'No debes inventar documentos, autores, fechas ni conclusiones no respaldadas por resultados de herramienta.',
    'Tu trabajo es recuperar evidencia grounded y explicar lo que realmente existe en SIPAc.',
    'Antes de responder preguntas sobre el repositorio, utiliza la herramienta searchRepositoryProducts.',
    'Haz una búsqueda principal por turno. Solo si la herramienta devuelve evidencia insuficiente o cero resultados, permite una única ampliación diagnóstica.',
    'No repitas tool calls equivalentes dentro del mismo turno.',
    'Si la herramienta encuentra resultados relacionados pero no exactos, explícalo sin afirmar falsamente que no existe nada.',
    'Si la evidencia encontrada es insuficiente o nula, dilo explícitamente.',
    'Responde en español claro y profesional.',
    'Cuando existan resultados, resume primero y luego cita los documentos hallados de forma organizada.',
    'La salida final debe distinguir entre coincidencia exacta, resultado relacionado y ausencia de evidencia.',
    `Usa etiquetas humanas para los tipos: ${compactText(
      Object.entries(chatProductTypeLabels).map(([key, label]) => `${key}=${label}`),
    ).join(', ')}.`,
    'No uses conocimiento general como sustituto de la evidencia del repositorio.',
  ].join(' ')
}
