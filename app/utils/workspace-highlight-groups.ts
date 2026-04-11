import type { DocumentAnchor, ExtractedEntitiesPublic } from '~~/app/types'

export type WorkspaceHighlightGroup = {
  key: string
  label: string
  confidence?: number
  anchors: DocumentAnchor[]
}

export function uniqueWorkspaceAnchors(anchors: DocumentAnchor[]): DocumentAnchor[] {
  const seen = new Set<string>()
  return anchors.filter((anchor) => {
    const id = `${anchor.page}-${anchor.x}-${anchor.y}-${anchor.width}-${anchor.height}`
    if (seen.has(id)) {
      return false
    }
    seen.add(id)
    return true
  })
}

export function buildWorkspaceHighlightGroups(
  entities: ExtractedEntitiesPublic | null | undefined,
): WorkspaceHighlightGroup[] {
  if (!entities) {
    return []
  }
  const authorAnchors = uniqueWorkspaceAnchors(
    entities.authors.flatMap((author) => author.anchors ?? []),
  )
  const keywordAnchors = uniqueWorkspaceAnchors(
    entities.keywords.flatMap((keyword) => keyword.anchors ?? []),
  )
  return [
    {
      key: 'title',
      label: 'Título',
      confidence: entities.title?.confidence,
      anchors: entities.title?.anchors ?? [],
    },
    {
      key: 'authors',
      label: 'Autores',
      confidence: entities.authors[0]?.confidence,
      anchors: authorAnchors,
    },
    {
      key: 'year',
      label: 'Fecha',
      confidence: entities.date?.confidence,
      anchors: entities.date?.anchors ?? [],
    },
    {
      key: 'institution',
      label: 'Institución',
      confidence: entities.institution?.confidence,
      anchors: entities.institution?.anchors ?? [],
    },
    {
      key: 'doi',
      label: 'DOI',
      confidence: entities.doi?.confidence,
      anchors: entities.doi?.anchors ?? [],
    },
    {
      key: 'keywords',
      label: 'Palabras clave',
      confidence: entities.keywords[0]?.confidence,
      anchors: keywordAnchors,
    },
  ]
}
