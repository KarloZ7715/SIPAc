export const WORKSPACE_ROUTE_FOCUS_KEYS = [
  'title',
  'authors',
  'year',
  'institution',
  'doi',
  'keywords',
  'repositoryUrl',
  'softwareRepositoryUrl',
] as const

export type WorkspaceRouteFocusKey = (typeof WORKSPACE_ROUTE_FOCUS_KEYS)[number]

export function isWorkspaceRouteFocusKey(value: string): value is WorkspaceRouteFocusKey {
  return (WORKSPACE_ROUTE_FOCUS_KEYS as readonly string[]).includes(value)
}
