<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { DefaultChatTransport } from 'ai'
import { Chat } from '@ai-sdk/vue'
import type {
  ChatModelSelection,
  ChatSearchResult,
  ChatSearchToolOutput,
  ChatUiMessage,
} from '~~/app/types'

const toast = useToast()
const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()

const chatSession = shallowRef<Chat<ChatUiMessage> | null>(null)
const draftInput = ref('')
const selectedDocument = ref<ChatSearchResult | null>(null)
const previewOpen = ref(false)
const selectedModelKey = ref<string>('default')
const initializing = ref(false)

function createConversationId() {
  if (import.meta.client && typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `chat_${crypto.randomUUID().replace(/-/g, '')}`
  }

  return `chat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

const conversationId = computed(() => {
  const id = route.query.id
  return typeof id === 'string' && id.trim().length > 0 ? id : null
})

const providerOptions = computed(() => {
  const defaultOption = {
    label: 'Cadena inteligente por defecto',
    value: 'default',
    hint: 'Usa la política grounded estable del sistema para el chat.',
  }

  const manualOptions =
    chatStore.providers?.manualOptions.map((option) => ({
      label: option.label,
      value: `${option.provider}::${option.modelId}`,
      hint: `${option.reasoningTier} · stream ${option.streamReliability}`,
    })) ?? []

  return [defaultOption, ...manualOptions]
})

const selectedModel = computed<ChatModelSelection | undefined>(() => {
  if (selectedModelKey.value === 'default') {
    return undefined
  }

  const [provider, modelId] = selectedModelKey.value.split('::')
  if (!provider || !modelId) {
    return undefined
  }

  return {
    provider: provider as ChatModelSelection['provider'],
    modelId,
  }
})

const messages = computed(() => chatSession.value?.messages ?? [])
const chatStatus = computed(() => chatSession.value?.status ?? 'ready')
const activeConversationTitle = computed(
  () => chatStore.activeConversation?.title ?? 'Nueva conversación grounded',
)

const latestSearchResults = computed(() => {
  const resultMap = new Map<string, ChatSearchResult>()

  for (const message of messages.value) {
    if (message.role !== 'assistant') {
      continue
    }

    for (const part of message.parts) {
      if (part.type === 'tool-searchRepositoryProducts' && part.state === 'output-available') {
        for (const result of part.output.results) {
          resultMap.set(result.productId, result)
        }
      }
    }
  }

  return [...resultMap.values()]
})

const canSend = computed(
  () =>
    Boolean(chatSession.value) &&
    !initializing.value &&
    draftInput.value.trim().length > 0 &&
    chatStatus.value !== 'submitted' &&
    chatStatus.value !== 'streaming',
)

function formatTimestamp(timestamp?: number) {
  if (!timestamp) {
    return ''
  }

  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function formatProductType(productType: ChatSearchResult['productType']) {
  return (
    {
      article: 'Artículo',
      conference_paper: 'Ponencia',
      thesis: 'Tesis',
      certificate: 'Certificado',
      research_project: 'Proyecto',
      book: 'Libro',
      book_chapter: 'Capítulo',
      technical_report: 'Informe',
      software: 'Software',
      patent: 'Patente',
    }[productType] ?? productType
  )
}

function formatSearchStrategy(strategy?: ChatSearchToolOutput['strategyUsed']) {
  return (
    {
      structured_exact: 'Coincidencia exacta',
      diagnostic_broadened: 'Diagnóstico ampliado',
      ocr_full_text: 'Evidencia OCR/nativa',
    }[strategy ?? 'structured_exact'] ?? strategy
  )
}

function formatMatchedField(field: string) {
  return (
    {
      'manualMetadata.title': 'Título manual',
      'extractedEntities.title.value': 'Título extraído',
      'manualMetadata.authors': 'Autores manuales',
      'extractedEntities.authors.value': 'Autores extraídos',
      director: 'Director',
      jurors: 'Jurados',
      principalInvestigatorName: 'Investigador principal',
      coResearchers: 'Coinvestigadores',
      'manualMetadata.institution': 'Institución manual',
      'extractedEntities.institution.value': 'Institución extraída',
      university: 'Universidad',
      degreeGrantor: 'Otorgante de grado',
      eventSponsor: 'Patrocinador del evento',
      publisher: 'Editorial / publisher',
      reportInstitution: 'Institución del informe',
      reportSponsor: 'Patrocinador del informe',
      issuingEntity: 'Entidad emisora',
      institution: 'Institución del proyecto',
      bookPublisher: 'Editorial del libro',
      chapterPublisher: 'Editorial del capítulo',
      patentAssignee: 'Titular de patente',
      'manualMetadata.keywords': 'Palabras clave manuales',
      'extractedEntities.keywords.value': 'Palabras clave extraídas',
      areaOfKnowledge: 'Área de conocimiento',
      reportAreaOfKnowledge: 'Área del informe',
      keywords: 'Keywords del proyecto',
      'extractedEntities.eventOrJournal.value': 'Evento o revista extraído',
      journalName: 'Revista',
      eventName: 'Evento',
      proceedingsTitle: 'Memorias / proceedings',
      programOrCall: 'Programa o convocatoria',
      relatedEvent: 'Evento relacionado',
      softwareProgrammingLanguage: 'Lenguaje de programación',
      softwarePlatform: 'Plataforma',
      patentClassification: 'Clasificación de patente',
      'manualMetadata.notes': 'Notas manuales',
      degreeName: 'Nombre del grado',
      faculty: 'Facultad',
      projectCode: 'Código de proyecto',
      conferenceAcronym: 'Sigla de congreso',
      journalAbbreviation: 'Abreviatura de revista',
      bookCollection: 'Colección',
      reportRevision: 'Revisión de informe',
      softwareLicense: 'Licencia de software',
      softwareType: 'Tipo de software',
      patentOffice: 'Oficina de patente',
      patentCountry: 'País de patente',
      rawExtractedText: 'Texto OCR/nativo',
    }[field] ?? field
  )
}

function isDuplicateToolPart(message: ChatUiMessage, index: number) {
  const part = message.parts[index]
  if (part?.type !== 'tool-searchRepositoryProducts' || part.state !== 'output-available') {
    return false
  }

  return message.parts.slice(0, index).some((previousPart) => {
    return (
      previousPart.type === 'tool-searchRepositoryProducts' &&
      previousPart.state === 'output-available' &&
      previousPart.output.toolCallKey === part.output.toolCallKey
    )
  })
}

function formatFilterValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  return String(value)
}

function visibleFilterEntries(filters: ChatSearchToolOutput['normalizedFilters']) {
  return [
    ['Tipo', formatFilterValue(filters.productType && formatProductType(filters.productType))],
    ['Institución', formatFilterValue(filters.institution)],
    ['Autor', formatFilterValue(filters.author)],
    ['Título', formatFilterValue(filters.title)],
    ['Tema', formatFilterValue(filters.keyword ?? filters.search)],
    ['Desde', formatFilterValue(filters.yearFrom ?? filters.dateFrom)],
    ['Hasta', formatFilterValue(filters.yearTo ?? filters.dateTo)],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))
}

const disabledModelLabels = computed(
  () => chatStore.providers?.disabledOptions.map((option) => option.label).join(', ') ?? '',
)

function openDocument(result: ChatSearchResult) {
  selectedDocument.value = result
  previewOpen.value = true
}

function buildConversationActions(conversationIdValue: string): DropdownMenuItem[][] {
  return [
    [
      {
        label: 'Eliminar conversación',
        icon: 'i-lucide-trash-2',
        color: 'error',
        onSelect: async () => {
          await chatStore.deleteConversation(conversationIdValue)

          if (conversationId.value === conversationIdValue) {
            await startNewConversation()
          }
        },
      },
    ],
  ]
}

async function ensureConversationId() {
  if (conversationId.value) {
    return conversationId.value
  }

  const nextId = createConversationId()
  await router.replace({
    path: '/chat',
    query: { id: nextId },
  })
  return nextId
}

async function initializeChatSession() {
  initializing.value = true

  try {
    const nextConversationId = await ensureConversationId()
    let initialMessages: ChatUiMessage[] = []

    try {
      const conversation = await chatStore.fetchConversation(nextConversationId)
      initialMessages = conversation?.messages ?? []
    } catch {
      chatStore.clearActiveConversation()
      initialMessages = []
    }

    selectedDocument.value = null
    previewOpen.value = false

    chatSession.value = new Chat<ChatUiMessage>({
      id: nextConversationId,
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: '/api/chat',
        body: () => (selectedModel.value ? { selectedModel: selectedModel.value } : {}),
      }),
      onFinish: () => {
        void chatStore.fetchConversations()
      },
      onError: (error) => {
        toast.add({
          title: 'No fue posible completar la respuesta',
          description: error.message,
          color: 'error',
          icon: 'i-lucide-octagon-alert',
        })
      },
    })
  } finally {
    initializing.value = false
  }
}

async function handleSubmit() {
  if (!chatSession.value) {
    await initializeChatSession()
  }

  if (!chatSession.value || !canSend.value) {
    return
  }

  const nextInput = draftInput.value.trim()
  draftInput.value = ''

  await chatSession.value.sendMessage({
    text: nextInput,
  })
}

async function startNewConversation() {
  chatStore.clearActiveConversation()
  draftInput.value = ''
  selectedDocument.value = null
  previewOpen.value = false

  await router.push({
    path: '/chat',
    query: { id: createConversationId() },
  })
}

onMounted(async () => {
  await chatStore.fetchConversations()

  try {
    await chatStore.fetchProviders()
  } catch {
    // El selector manual no debe bloquear el chat si el endpoint no está disponible.
  }

  await initializeChatSession()
})

watch(
  () => conversationId.value,
  async (next, previous) => {
    if (next === previous && chatSession.value) {
      return
    }

    await initializeChatSession()
  },
)
</script>

<template>
  <div class="space-y-8">
    <section class="panel-surface hero-wash fade-up p-6 sm:p-8">
      <div class="flex flex-wrap items-start justify-between gap-5">
        <div class="space-y-4">
          <div class="section-chip">M9 · Chat IA</div>
          <SipacSectionHeader
            title="Repositorio conversacional grounded"
            description="Consulta el repositorio confirmado con lenguaje natural. El asistente responde solo con evidencia encontrada en SIPAc."
            size="md"
          />
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <SipacBadge color="primary" variant="subtle">Solo evidencia</SipacBadge>
          <SipacBadge color="neutral" variant="outline">Sin borradores</SipacBadge>
          <SipacButton icon="i-lucide-square-pen" @click="startNewConversation">
            Nueva conversación
          </SipacButton>
        </div>
      </div>

      <div
        class="mt-6 grid gap-4 rounded-[1.4rem] border border-white/75 bg-white/70 p-4 text-sm text-text-muted md:grid-cols-[1.4fr_1fr]"
      >
        <div class="panel-muted p-4">
          <p class="font-semibold text-text">Qué sí hace este v1</p>
          <p class="mt-2">
            Busca por autor, título, tema, institución, tipo y fechas; combina filtros; conserva
            contexto de sesión; y enlaza el documento asociado cuando existe evidencia confirmada.
          </p>
        </div>

        <div class="panel-muted p-4">
          <p class="font-semibold text-text">Límite deliberado</p>
          <p class="mt-2">
            No redacta respuestas “creativas” ni completa huecos con conocimiento general. Si no
            encuentra respaldo suficiente, lo indica.
          </p>
        </div>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[19rem_minmax(0,1fr)]">
      <aside class="space-y-4">
        <div class="panel-surface p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
                Historial
              </p>
              <h2 class="mt-1 font-display text-xl text-text">Conversaciones</h2>
            </div>
            <SipacButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-refresh-cw"
              :loading="chatStore.conversationsLoading"
              @click="chatStore.fetchConversations()"
            />
          </div>

          <div class="mt-4 space-y-2">
            <button
              v-for="conversation in chatStore.conversations"
              :key="conversation.id"
              type="button"
              class="interactive-card w-full rounded-[1.2rem] border p-3 text-left"
              :class="
                conversation.id === conversationId
                  ? 'border-sipac-300 bg-sipac-50/70 shadow-[0_14px_35px_-28px_rgba(29,99,60,0.45)]'
                  : 'border-border-muted bg-white'
              "
              @click="
                router.push({
                  path: '/chat',
                  query: { id: conversation.id },
                })
              "
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="line-clamp-2 text-sm font-semibold text-text">
                    {{ conversation.title }}
                  </p>
                  <p class="mt-1 line-clamp-2 text-xs text-text-muted">
                    {{ conversation.lastMessagePreview || 'Sin vista previa todavía.' }}
                  </p>
                </div>

                <UDropdownMenu :items="buildConversationActions(conversation.id)">
                  <SipacButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    icon="i-lucide-ellipsis-vertical"
                    :loading="chatStore.deletingConversationId === conversation.id"
                    @click.stop
                  />
                </UDropdownMenu>
              </div>

              <div class="mt-3 flex items-center justify-between text-[0.72rem] text-text-soft">
                <span>{{ conversation.messageCount }} mensajes</span>
                <span>{{ new Date(conversation.updatedAt).toLocaleDateString('es-CO') }}</span>
              </div>
            </button>

            <UEmpty
              v-if="!chatStore.conversationsLoading && !chatStore.conversations.length"
              icon="i-lucide-messages-square"
              title="Sin conversaciones guardadas"
              description="Inicia una búsqueda y SIPAc conservará este hilo para retomarlo después."
            />
          </div>
        </div>

        <div class="panel-surface p-4">
          <div class="space-y-3">
            <div>
              <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
                Laboratorio manual
              </p>
              <h3 class="mt-1 font-display text-xl text-text">Selector de modelo</h3>
            </div>

            <USelect
              v-model="selectedModelKey"
              color="neutral"
              variant="outline"
              :items="providerOptions"
              :loading="chatStore.providersLoading"
            />

            <p class="text-xs leading-5 text-text-muted">
              Temporalmente puedes elegir proveedor/modelo desde cuentas docentes. El servidor solo
              expone candidatos validados para tools y streaming grounded.
            </p>

            <p v-if="disabledModelLabels" class="text-[0.72rem] leading-5 text-text-soft">
              Fuera de la cadena manual por política actual: {{ disabledModelLabels }}.
            </p>
          </div>
        </div>
      </aside>

      <div class="panel-surface flex min-h-[75vh] flex-col overflow-hidden">
        <div
          class="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 px-5 py-4"
        >
          <div>
            <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
              Conversación activa
            </p>
            <h2 class="mt-1 font-display text-2xl text-text">{{ activeConversationTitle }}</h2>
            <p class="mt-1 text-sm text-text-muted">
              {{ latestSearchResults.length }} resultados estructurados visibles en este hilo.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <SipacBadge
              :color="chatStatus === 'ready' ? 'success' : 'warning'"
              variant="subtle"
              class="capitalize"
            >
              {{ chatStatus }}
            </SipacBadge>
            <SipacBadge v-if="selectedModel" color="neutral" variant="outline">
              {{ selectedModel.provider }} · {{ selectedModel.modelId }}
            </SipacBadge>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-4 py-5 sm:px-5">
          <div v-if="initializing" class="grid gap-4">
            <div class="panel-muted h-24 animate-pulse" />
            <div class="panel-muted ml-auto h-16 w-3/4 animate-pulse" />
            <div class="panel-muted h-32 animate-pulse" />
          </div>

          <div v-else-if="chatSession" class="space-y-5">
            <div v-if="!messages.length" class="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div class="panel-muted p-6">
                <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
                  Primeros ejemplos
                </p>
                <div class="mt-4 grid gap-3">
                  <button
                    type="button"
                    class="interactive-card rounded-[1.15rem] border border-border-muted bg-white p-4 text-left"
                    @click="
                      draftInput =
                        'Muéstrame artículos de 2020 a 2025 relacionados con inteligencia artificial educativa.'
                    "
                  >
                    Buscar por periodo y tema
                  </button>
                  <button
                    type="button"
                    class="interactive-card rounded-[1.15rem] border border-border-muted bg-white p-4 text-left"
                    @click="
                      draftInput =
                        '¿Qué tesis confirmadas están asociadas a la Universidad de Córdoba?'
                    "
                  >
                    Filtrar por tipo e institución
                  </button>
                  <button
                    type="button"
                    class="interactive-card rounded-[1.15rem] border border-border-muted bg-white p-4 text-left"
                    @click="
                      draftInput =
                        'Busca productos de Martha Cecilia Pacheco Lora y luego dime cuáles son de 2025.'
                    "
                  >
                    Probar contexto conversacional
                  </button>
                </div>
              </div>

              <div class="panel-muted p-6">
                <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
                  Slice actual
                </p>
                <ul class="mt-4 space-y-3 text-sm text-text-muted">
                  <li>Consultas combinadas sobre productos confirmados.</li>
                  <li>Historial persistido austero en MongoDB.</li>
                  <li>Resultados estructurados con apertura de documento.</li>
                  <li>Selector manual temporal para pruebas de compatibilidad.</li>
                </ul>
              </div>
            </div>

            <article
              v-for="message in messages"
              :key="message.id"
              class="fade-in"
              :class="message.role === 'user' ? 'ml-auto max-w-3xl' : 'max-w-4xl'"
            >
              <div
                class="rounded-[1.5rem] border px-4 py-4 sm:px-5"
                :class="
                  message.role === 'user'
                    ? 'border-sipac-300 bg-linear-to-br from-sipac-50 to-white'
                    : 'border-border-muted bg-white'
                "
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2">
                    <span
                      class="flex size-9 items-center justify-center rounded-2xl"
                      :class="
                        message.role === 'user'
                          ? 'bg-sipac-700 text-white'
                          : 'bg-earth-100 text-earth-700'
                      "
                    >
                      <UIcon
                        :name="
                          message.role === 'user' ? 'i-lucide-user-round' : 'i-lucide-sparkles'
                        "
                        class="size-4.5"
                      />
                    </span>
                    <div>
                      <p class="text-sm font-semibold text-text">
                        {{ message.role === 'user' ? 'Tú' : 'SIPAc IA' }}
                      </p>
                      <p class="text-xs text-text-soft">
                        {{ formatTimestamp(message.metadata?.createdAt) }}
                      </p>
                    </div>
                  </div>

                  <div
                    v-if="
                      message.role === 'assistant' &&
                      (message.metadata?.provider || message.metadata?.model)
                    "
                    class="text-right text-[0.72rem] text-text-soft"
                  >
                    <p>{{ message.metadata?.provider || 'modelo' }}</p>
                    <p>{{ message.metadata?.model }}</p>
                  </div>
                </div>

                <div class="mt-4 space-y-4">
                  <template v-for="(part, index) in message.parts" :key="`${message.id}-${index}`">
                    <div v-if="part.type === 'text' && part.text.trim().length">
                      <ChatMarkdownRenderer :content="part.text" />
                    </div>

                    <div
                      v-else-if="
                        part.type === 'tool-searchRepositoryProducts' &&
                        !isDuplicateToolPart(message, index)
                      "
                      class="panel-muted space-y-4 p-4"
                    >
                      <div class="flex items-center justify-between gap-3">
                        <div>
                          <p
                            class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase"
                          >
                            Recuperación grounded
                          </p>
                          <p class="mt-1 text-sm text-text-muted">
                            {{
                              part.state === 'output-available'
                                ? `${part.output.total} coincidencias encontradas con estrategia ${formatSearchStrategy(part.output.strategyUsed).toLowerCase()}`
                                : 'Preparando consulta al repositorio confirmado'
                            }}
                          </p>
                        </div>
                        <div class="flex flex-wrap items-center justify-end gap-2">
                          <SipacBadge
                            v-if="part.state === 'output-available'"
                            color="primary"
                            variant="subtle"
                          >
                            {{ formatSearchStrategy(part.output.strategyUsed) }}
                          </SipacBadge>
                          <SipacBadge color="neutral" variant="outline">
                            {{ part.state }}
                          </SipacBadge>
                        </div>
                      </div>

                      <div v-if="part.state === 'output-available'" class="space-y-4">
                        <div
                          v-if="visibleFilterEntries(part.output.normalizedFilters).length"
                          class="flex flex-wrap gap-2"
                        >
                          <div
                            v-for="[label, value] in visibleFilterEntries(
                              part.output.normalizedFilters,
                            )"
                            :key="`${part.output.toolCallKey}-${label}`"
                            class="rounded-full border border-border/70 bg-white px-3 py-1.5 text-xs text-text-muted"
                          >
                            <span class="font-semibold text-text">{{ label }}:</span> {{ value }}
                          </div>
                        </div>

                        <div
                          v-if="part.output.matchedFields.length"
                          class="flex flex-wrap gap-2 text-xs text-text-soft"
                        >
                          <span
                            v-for="field in part.output.matchedFields"
                            :key="`${part.output.toolCallKey}-${field}`"
                            class="rounded-full border border-earth-200 bg-earth-50 px-3 py-1.5"
                          >
                            Coincidió en {{ formatMatchedField(field) }}
                          </span>
                        </div>

                        <div
                          v-if="part.output.deduplicated"
                          class="rounded-[1.1rem] border border-earth-200 bg-earth-50 px-4 py-3 text-sm text-earth-700"
                        >
                          Se colapsó una búsqueda equivalente en este mismo turno para evitar
                          duplicados.
                        </div>

                        <div
                          v-if="part.output.diagnosticInfo?.notes?.length"
                          class="rounded-[1.1rem] border border-border/70 bg-white px-4 py-3"
                        >
                          <p
                            class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase"
                          >
                            Diagnóstico de recuperación
                          </p>
                          <ul class="mt-3 space-y-2 text-sm text-text-muted">
                            <li
                              v-for="note in part.output.diagnosticInfo.notes"
                              :key="`${part.output.toolCallKey}-${note}`"
                            >
                              {{ note }}
                            </li>
                          </ul>
                        </div>

                        <div v-if="part.output.results.length" class="space-y-4">
                          <article
                            v-for="result in part.output.results"
                            :key="result.productId"
                            class="interactive-card rounded-[1.2rem] border border-border/70 bg-white p-4"
                          >
                            <div class="flex flex-wrap items-start justify-between gap-3">
                              <div class="min-w-0 space-y-2">
                                <div class="flex flex-wrap items-center gap-2">
                                  <SipacBadge color="primary" variant="subtle">
                                    {{ formatProductType(result.productType) }}
                                  </SipacBadge>
                                  <SipacBadge v-if="result.year" color="neutral" variant="outline">
                                    {{ result.year }}
                                  </SipacBadge>
                                </div>
                                <h3 class="text-base font-semibold text-text">
                                  {{ result.title }}
                                </h3>
                                <p class="text-sm text-text-muted">{{ result.summary }}</p>
                                <p v-if="result.authors.length" class="text-sm text-text-soft">
                                  {{ result.authors.join(', ') }}
                                </p>
                                <p
                                  v-if="result.relatedReason"
                                  class="rounded-xl bg-earth-50 px-3 py-2 text-sm text-earth-700"
                                >
                                  {{ result.relatedReason }}
                                </p>
                                <div
                                  v-if="result.matchedFields.length"
                                  class="flex flex-wrap gap-2 text-xs text-text-soft"
                                >
                                  <span
                                    v-for="field in result.matchedFields"
                                    :key="`${result.productId}-${field}`"
                                    class="rounded-full border border-border/70 bg-surface-elevated px-2.5 py-1"
                                  >
                                    {{ formatMatchedField(field) }}
                                  </span>
                                </div>
                                <div v-if="result.evidenceSnippets.length" class="space-y-2">
                                  <div
                                    v-for="snippet in result.evidenceSnippets"
                                    :key="`${result.productId}-${snippet.field}-${snippet.text}`"
                                    class="rounded-[1rem] border border-border/60 bg-surface-elevated/80 px-3 py-3 text-sm text-text-muted"
                                  >
                                    <p
                                      class="text-[0.72rem] font-semibold tracking-[0.16em] text-text-soft uppercase"
                                    >
                                      {{
                                        snippet.source === 'ocr_text'
                                          ? 'Evidencia OCR / nativa'
                                          : formatMatchedField(snippet.field || 'metadata')
                                      }}
                                    </p>
                                    <p class="mt-2 leading-6">{{ snippet.text }}</p>
                                  </div>
                                </div>
                              </div>

                              <div class="flex flex-wrap gap-2">
                                <SipacButton
                                  size="sm"
                                  color="neutral"
                                  variant="soft"
                                  icon="i-lucide-panel-right-open"
                                  @click="openDocument(result)"
                                >
                                  Ver documento
                                </SipacButton>
                                <a :href="result.downloadUrl" target="_blank" rel="noreferrer">
                                  <SipacButton
                                    size="sm"
                                    color="neutral"
                                    variant="ghost"
                                    icon="i-lucide-download"
                                  >
                                    Descargar
                                  </SipacButton>
                                </a>
                              </div>
                            </div>
                          </article>
                        </div>

                        <UEmpty
                          v-else
                          icon="i-lucide-file-search"
                          :title="
                            part.output.strategyUsed === 'diagnostic_broadened'
                              ? 'Sin coincidencias exactas ni ampliadas'
                              : 'Sin coincidencias'
                          "
                          :description="
                            part.output.diagnosticInfo?.notes?.[
                              part.output.diagnosticInfo.notes.length - 1
                            ] ||
                            'No se encontraron productos confirmados para esa combinación de criterios.'
                          "
                        />
                      </div>
                    </div>
                  </template>
                </div>

                <div
                  v-if="message.role === 'assistant' && message.metadata?.totalTokens"
                  class="mt-4 border-t border-border/60 pt-3 text-[0.72rem] text-text-soft"
                >
                  {{ message.metadata.totalTokens }} tokens ·
                  {{ message.metadata.finishReason || 'stream completo' }}
                </div>
              </div>
            </article>
          </div>
        </div>

        <div class="border-t border-border/60 bg-surface-elevated/90 p-4 sm:p-5">
          <form class="space-y-3" @submit.prevent="handleSubmit">
            <UTextarea
              v-model="draftInput"
              color="neutral"
              variant="outline"
              autoresize
              :rows="3"
              :maxrows="8"
              placeholder="Pregunta por documentos, autores, temas, fechas o combinaciones del repositorio confirmado..."
            />

            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-xs leading-5 text-text-soft">
                Ejemplo: "Muéstrame tesis de 2024 sobre educación mediada por IA en la Universidad
                de Córdoba".
              </p>

              <div class="flex items-center gap-2">
                <SipacButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-eraser"
                  :disabled="!draftInput.length"
                  @click="draftInput = ''"
                >
                  Limpiar
                </SipacButton>
                <SipacButton
                  type="submit"
                  icon="i-lucide-send-horizontal"
                  :loading="chatStatus === 'submitted' || chatStatus === 'streaming'"
                  :disabled="!canSend"
                  @click.prevent="handleSubmit"
                >
                  Consultar
                </SipacButton>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>

    <USlideover v-model:open="previewOpen" side="right" :ui="{ content: 'max-w-2xl' }">
      <template #header>
        <div class="space-y-1">
          <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
            Documento asociado
          </p>
          <h3 class="font-display text-2xl text-text">
            {{ selectedDocument?.title || 'Documento del repositorio' }}
          </h3>
        </div>
      </template>

      <template #body>
        <div v-if="selectedDocument" class="space-y-4">
          <div class="panel-muted space-y-3 p-4">
            <div class="flex flex-wrap gap-2">
              <SipacBadge color="primary" variant="subtle">
                {{ formatProductType(selectedDocument.productType) }}
              </SipacBadge>
              <SipacBadge v-if="selectedDocument.year" color="neutral" variant="outline">
                {{ selectedDocument.year }}
              </SipacBadge>
            </div>

            <p class="text-sm text-text-muted">{{ selectedDocument.summary }}</p>
            <p v-if="selectedDocument.authors.length" class="text-sm text-text-soft">
              {{ selectedDocument.authors.join(', ') }}
            </p>

            <div class="flex flex-wrap gap-2">
              <a :href="selectedDocument.viewUrl" target="_blank" rel="noreferrer">
                <SipacButton size="sm" icon="i-lucide-external-link">Abrir aparte</SipacButton>
              </a>
              <a :href="selectedDocument.downloadUrl" target="_blank" rel="noreferrer">
                <SipacButton size="sm" color="neutral" variant="soft" icon="i-lucide-download">
                  Descargar
                </SipacButton>
              </a>
            </div>
          </div>

          <div class="overflow-hidden rounded-[1.4rem] border border-border/70 bg-white">
            <iframe
              :src="selectedDocument.viewUrl"
              title="Vista previa del documento"
              class="h-[68vh] w-full bg-white"
            />
          </div>
        </div>
      </template>
    </USlideover>
  </div>
</template>
