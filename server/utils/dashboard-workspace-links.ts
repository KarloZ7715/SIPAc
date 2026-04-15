/**
 * Construye la ruta del espacio de trabajo con query estable (insights, enlaces profundos).
 */
export function workspaceDocumentsUrl(input: {
  productId?: string
  focus?: string
  extraParams?: Record<string, string>
}): string {
  const params = new URLSearchParams()
  if (input.productId) {
    params.set('productId', input.productId)
  }
  if (input.focus) {
    params.set('focus', input.focus)
  }
  if (input.extraParams) {
    for (const [k, v] of Object.entries(input.extraParams)) {
      if (v.length > 0) {
        params.set(k, v)
      }
    }
  }
  const q = params.toString()
  return q ? `/workspace-documents?${q}` : '/workspace-documents'
}
