export type DashboardInsightSeverity = 'warning' | 'info' | 'success'

/**
 * Insight calculado en servidor para el tablero.
 * `count` es el número de productos afectados en el conjunto filtrado (misma base que `/api/dashboard`).
 */
export interface DashboardInsightItem {
  id: string
  severity: DashboardInsightSeverity
  title: string
  description: string
  count: number
  ctaLabel: string
  href: string
  /** Segundo enlace opcional (p. ej. subir documento o ver repositorio) */
  secondaryCtaLabel?: string
  secondaryHref?: string
  /** Hasta 3 IDs para enlaces directos al workspace */
  sampleProductIds?: string[]
}
