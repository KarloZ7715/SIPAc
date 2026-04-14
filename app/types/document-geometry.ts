export interface DocumentAnchor {
  page: number
  x: number // Normalized percentage 0-1
  y: number // Normalized percentage 0-1
  width: number // Normalized percentage 0-1
  height: number // Normalized percentage 0-1
  confidence: number // 0-1
  sourceText?: string
  provider: 'pdfjs_native' | 'gemini_vision' | 'mistral_ocr_3' | 'office_native'
}

export interface ExtractedEntityWithEvidence<T> {
  value: T
  confidence: number
  anchors: DocumentAnchor[]
}
