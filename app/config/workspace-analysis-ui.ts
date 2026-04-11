/** Mensajes rotativos y límites del panel de “análisis en curso” (solo UX, no progreso real del servidor). */

export const WORKSPACE_ANALYSIS_PROCESSING_MESSAGES = [
  'Revisando el documento de arriba a abajo…',
  'Buscando título, autores y fecha…',
  'Leyendo el texto para sacar lo importante…',
  'Afinando qué tipo de trabajo académico es…',
  'Preparando la ficha para que la revises…',
  'Casi listo: ordenando lo que encontramos…',
  'Últimos retoques antes de mostrarte la ficha…',
] as const

export const WORKSPACE_MAX_VISIBLE_ANALYSIS_HIGHLIGHTS = 4
export const WORKSPACE_ANALYSIS_HIGHLIGHT_INTERVAL_MS = 1800
export const WORKSPACE_ANALYSIS_HIGHLIGHT_EXIT_DELAY_MS = 240
