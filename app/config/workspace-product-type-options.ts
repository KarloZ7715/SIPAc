import type { ProductType } from '~~/app/types'

export const WORKSPACE_PRODUCT_TYPE_OPTIONS = [
  { label: 'Artículo científico', value: 'article' },
  { label: 'Ponencia en evento', value: 'conference_paper' },
  { label: 'Tesis o trabajo de grado', value: 'thesis' },
  { label: 'Certificado o constancia', value: 'certificate' },
  { label: 'Proyecto de investigación', value: 'research_project' },
  { label: 'Libro', value: 'book' },
  { label: 'Capítulo de libro', value: 'book_chapter' },
  { label: 'Reporte técnico', value: 'technical_report' },
  { label: 'Software', value: 'software' },
  { label: 'Patente', value: 'patent' },
] satisfies Array<{ label: string; value: ProductType }>
