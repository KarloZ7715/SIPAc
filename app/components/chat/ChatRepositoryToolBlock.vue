<script setup lang="ts">
import type { ChatSearchResult, ChatUiMessage } from '~~/app/types'
import {
  dedupeEvidenceSnippetsForDisplay,
  formatChatProductType,
  formatChatSearchStrategy,
  isDuplicateChatToolPart,
  visibleChatFilterEntries,
} from '~~/app/utils/chat-formatters'

const props = defineProps<{
  message: ChatUiMessage
  partIndex: number
}>()

const emit = defineEmits<{
  openDocument: [result: ChatSearchResult]
}>()

const part = computed(() => props.message.parts[props.partIndex])

const isDuplicate = computed(() => isDuplicateChatToolPart(props.message, props.partIndex))

const toolPart = computed(() => {
  const p = part.value
  if (p?.type !== 'tool-searchRepositoryProducts') {
    return null
  }
  return p
})
</script>

<template>
  <div
    v-if="toolPart && !isDuplicate"
    class="my-1 overflow-hidden rounded-xl border border-border/55 bg-surface-elevated/40"
  >
    <div
      class="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-3 py-2 sm:px-4"
    >
      <div class="flex min-w-0 items-center gap-2">
        <span
          class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sipac-100/90 text-sipac-700"
          aria-hidden="true"
        >
          <UIcon name="i-lucide-folder-search" class="size-3.5" />
        </span>
        <p class="text-sm font-medium text-text">
          {{
            toolPart.state === 'output-available'
              ? `${toolPart.output.total} documento${toolPart.output.total === 1 ? '' : 's'} encontrado${toolPart.output.total === 1 ? '' : 's'}`
              : 'Revisando documentos del repositorio…'
          }}
        </p>
      </div>
      <SipacBadge
        v-if="toolPart.state === 'output-available'"
        color="primary"
        variant="subtle"
        size="sm"
        class="shrink-0"
      >
        {{ formatChatSearchStrategy(toolPart.output.strategyUsed) }}
      </SipacBadge>
    </div>

    <div v-if="toolPart.state === 'output-available'" class="space-y-3 p-3 sm:p-4">
      <div
        v-if="visibleChatFilterEntries(toolPart.output.normalizedFilters).length"
        class="flex flex-wrap gap-1.5"
      >
        <span
          v-for="[label, value] in visibleChatFilterEntries(toolPart.output.normalizedFilters)"
          :key="`${toolPart.output.toolCallKey}-${label}`"
          class="inline-flex items-center rounded-full bg-surface-muted/80 px-2.5 py-0.5 text-[0.7rem] text-text-muted"
        >
          <span class="font-medium text-text-soft">{{ label }}</span>
          <span class="mx-1 text-border" aria-hidden="true">·</span>
          {{ value }}
        </span>
      </div>

      <div v-if="toolPart.output.results.length" class="space-y-3">
        <article
          v-for="result in toolPart.output.results"
          :key="result.productId"
          class="rounded-xl border border-border/50 bg-white/90 p-3 sm:p-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <SipacBadge color="primary" variant="subtle" size="sm">
                  {{ formatChatProductType(result.productType) }}
                </SipacBadge>
                <SipacBadge v-if="result.year" color="neutral" variant="outline" size="sm">
                  {{ result.year }}
                </SipacBadge>
              </div>

              <h3
                class="font-display text-[0.95rem] font-medium leading-snug text-text sm:text-base"
              >
                {{ result.title }}
              </h3>

              <p class="text-sm text-text-muted line-clamp-2">
                {{ result.summary }}
              </p>

              <p
                v-if="result.authors.length"
                class="text-xs leading-relaxed text-text-soft sm:text-sm"
              >
                <UIcon
                  name="i-lucide-users"
                  class="mr-1 inline size-3.5 align-text-bottom"
                  aria-hidden="true"
                />
                {{ result.authors.join(', ') }}
              </p>

              <p
                v-if="result.relatedReason"
                class="rounded-lg border border-border/50 bg-surface-muted/50 px-3 py-2 text-sm leading-snug text-text-muted"
              >
                <UIcon
                  name="i-lucide-info"
                  class="mr-1 inline size-3.5 align-text-bottom text-sipac-600"
                  aria-hidden="true"
                />
                {{ result.relatedReason }}
              </p>

              <div
                v-if="dedupeEvidenceSnippetsForDisplay(result.evidenceSnippets, 3).length"
                class="space-y-2 border-t border-border/30 pt-2"
              >
                <div
                  v-for="(row, idx) in dedupeEvidenceSnippetsForDisplay(result.evidenceSnippets, 3)"
                  :key="`${result.productId}-ev-${idx}`"
                  class="text-sm"
                >
                  <p class="text-[0.65rem] font-medium uppercase tracking-wide text-text-soft">
                    {{ row.label }}
                  </p>
                  <p class="mt-0.5 leading-relaxed text-text-muted line-clamp-4">
                    {{ row.text }}
                  </p>
                </div>
              </div>
            </div>

            <div class="flex shrink-0 flex-col gap-2">
              <SipacButton size="sm" icon="i-lucide-eye" @click="emit('openDocument', result)">
                Ver
              </SipacButton>
              <a :href="result.downloadUrl" target="_blank" rel="noreferrer">
                <SipacButton size="sm" color="neutral" variant="soft" icon="i-lucide-download">
                  Bajar
                </SipacButton>
              </a>
            </div>
          </div>
        </article>
      </div>

      <div
        v-else
        class="rounded-xl border border-dashed border-border bg-surface-muted/20 px-4 py-6 text-center"
      >
        <UIcon name="i-lucide-search-x" class="mx-auto size-8 text-text-soft" aria-hidden="true" />
        <p class="mt-2 text-sm font-medium text-text">No encontré resultados con esa búsqueda</p>
        <p class="mt-1 text-xs text-text-muted">
          Prueba con otra palabra clave, un autor, una institución o un rango de fechas más amplio.
        </p>
      </div>
    </div>

    <div v-else class="flex items-center gap-3 px-3 py-4 sm:px-4" role="status" aria-live="polite">
      <div class="loader-orbit" aria-hidden="true">
        <div class="loader-orbit-dot" />
      </div>
      <p class="text-sm text-text-muted">Revisando documentos del repositorio…</p>
    </div>
  </div>
</template>
