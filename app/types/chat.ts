import type { UIMessage } from 'ai'
import type { ProductType } from './academic-product'
import type { DatabaseId } from './database'

export const CHAT_MODEL_PROVIDERS = ['cerebras', 'gemini', 'groq', 'openrouter', 'nvidia'] as const
export type ChatModelProvider = (typeof CHAT_MODEL_PROVIDERS)[number]

/** Título de proveedor en el selector de modelos (sin IDs técnicos). */
export const CHAT_PROVIDER_DISPLAY_NAME: Record<ChatModelProvider, string> = {
  cerebras: 'Cerebras',
  gemini: 'Google',
  groq: 'Groq',
  nvidia: 'NVIDIA',
  openrouter: 'OpenRouter',
}

/** Orden de secciones en el desplegable de modelos (proveedores no listados van al final, por nombre). */
export const CHAT_MODEL_PROVIDER_SECTION_ORDER: ChatModelProvider[] = [
  'cerebras',
  'groq',
  'nvidia',
  'openrouter',
  'gemini',
]

export interface ChatMessageMetadata {
  createdAt?: number
  provider?: ChatModelProvider
  model?: string
  finishReason?: string
  stoppedByUser?: boolean
  totalTokens?: number
  retrievalStrategy?: ChatSearchStrategy
}

export interface ChatSearchFilters {
  search?: string
  title?: string
  author?: string
  institution?: string
  productType?: ProductType
  keyword?: string
  dateFrom?: string
  dateTo?: string
  yearFrom?: number
  yearTo?: number
  limit?: number
}

export type ChatSearchStrategy = 'structured_exact' | 'diagnostic_broadened' | 'ocr_full_text'
export type ChatEvidenceSource = 'metadata' | 'ocr_text'
export type ChatModelReasoningTier = 'high' | 'medium' | 'fast'
export type ChatModelStreamReliability = 'high' | 'medium' | 'low'

export interface ChatEvidenceSnippet {
  source: ChatEvidenceSource
  field?: string
  text: string
}

export interface ChatSearchResult {
  productId: string
  sourceFileId: string
  productType: ProductType
  title: string
  authors: string[]
  institution?: string
  year?: number
  keywords: string[]
  referenceDate?: string
  summary: string
  matchedFields: string[]
  evidenceSnippets: ChatEvidenceSnippet[]
  score?: number
  searchStrategy?: ChatSearchStrategy
  relatedReason?: string
  viewUrl: string
  downloadUrl: string
}

export interface ChatSearchDiagnosticInfo {
  broadened: boolean
  droppedFilters: Array<keyof ChatSearchFilters>
  notes: string[]
}

export interface ChatSearchToolOutput {
  filters: ChatSearchFilters
  normalizedFilters: ChatSearchFilters
  total: number
  limitedTo: number
  strategyUsed: ChatSearchStrategy
  matchedFields: string[]
  evidenceSnippets: ChatEvidenceSnippet[]
  toolCallKey: string
  deduplicated?: boolean
  diagnosticInfo?: ChatSearchDiagnosticInfo
  results: ChatSearchResult[]
}

export interface ChatSearchToolInput extends ChatSearchFilters {
  question: string
}

export type ChatUiMessage = UIMessage<
  ChatMessageMetadata,
  never,
  {
    searchRepositoryProducts: {
      input: ChatSearchToolInput
      output: ChatSearchToolOutput
    }
  }
>

export interface IChatConversation {
  _id: DatabaseId
  chatId: string
  userId: DatabaseId
  title: string
  messages: ChatUiMessage[]
  messageCount?: number
  lastMessagePreview?: string
  lastMessageAt?: Date
  isActive: boolean
  lastAccessedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface ChatConversationSummaryPublic {
  id: string
  title: string
  messageCount: number
  lastMessagePreview?: string
  /** Última actividad con mensajes (max metadata.createdAt); no cambia al solo abrir el chat. */
  lastMessageAt: string
  createdAt: string
  updatedAt: string
}

export interface ChatConversationPublic extends ChatConversationSummaryPublic {
  messages: ChatUiMessage[]
}

export interface ChatModelOptionPublic {
  provider: ChatModelProvider
  modelId: string
  label: string
  supportsTools: boolean
  streamReliability: ChatModelStreamReliability
  reasoningTier: ChatModelReasoningTier
  fallbackRank?: number
  enabledForAuto: boolean
  enabledForManual: boolean
  disabledReason?: string
}

export interface ChatModelSelection {
  provider: ChatModelProvider
  modelId: string
}

export interface ChatProvidersResponse {
  defaultChain: ChatModelOptionPublic[]
  manualOptions: ChatModelOptionPublic[]
  disabledOptions: ChatModelOptionPublic[]
}
