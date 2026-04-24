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
    class="group/tool my-4 overflow-hidden rounded-2xl border border-sipac-200/50 bg-white/60 shadow-[0_4px_24px_-10px_rgb(20_20_19/0.05)] backdrop-blur-xl transition-all duration-500 ease-out hover:shadow-[0_8px_32px_-12px_rgb(20_20_19/0.1)]"
  >
    <div
      class="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 bg-surface-muted/30 px-3 py-2.5 sm:px-5"
    >
      <div class="flex min-w-0 items-center gap-3">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sipac-50 to-sipac-100/50 text-sipac-700 shadow-inner ring-1 ring-sipac-200/50 transition-transform duration-500 group-hover/tool:scale-105"
          aria-hidden="true"
        >
          <UIcon name="i-lucide-folder-search" class="size-4" />
        </span>
        <p class="font-display text-[0.95rem] font-medium tracking-tight text-text">
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
        class="shrink-0 font-medium tracking-wide shadow-sm"
      >
        {{ formatChatSearchStrategy(toolPart.output.strategyUsed) }}
      </SipacBadge>
    </div>

    <div v-if="toolPart.state === 'output-available'" class="space-y-4 p-3 sm:p-5">
      <div
        v-if="visibleChatFilterEntries(toolPart.output.normalizedFilters).length"
        class="flex flex-wrap gap-2"
      >
        <span
          v-for="[label, value] in visibleChatFilterEntries(toolPart.output.normalizedFilters)"
          :key="`${toolPart.output.toolCallKey}-${label}`"
          class="inline-flex items-center rounded-full border border-border/40 bg-surface-muted/50 px-3 py-1 text-[0.75rem] text-text-muted shadow-sm backdrop-blur-sm"
        >
          <span class="font-medium text-text-soft">{{ label }}</span>
          <span class="mx-1.5 text-border/70" aria-hidden="true">·</span>
          <span class="text-text-muted">{{ value }}</span>
        </span>
      </div>

      <div
        v-if="toolPart.output.results.length"
        class="grid gap-4 sm:grid-cols-1 md:grid-flow-dense md:grid-cols-2"
      >
        <article
          v-for="(result, idx) in toolPart.output.results"
          :key="result.productId"
          class="group/card relative flex flex-col overflow-hidden rounded-[1.25rem] border border-border/40 bg-white p-4 shadow-sm ring-1 ring-transparent transition-all duration-500 hover:-translate-y-1 hover:shadow-md hover:ring-sipac-200/50 sm:p-5"
          :class="idx === 0 && toolPart.output.results.length % 2 !== 0 ? 'md:col-span-2' : ''"
        >
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0 flex-1 space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                <SipacBadge color="primary" variant="subtle" size="sm" class="font-medium">
                  {{ formatChatProductType(result.productType) }}
                </SipacBadge>
                <SipacBadge
                  v-if="result.year"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  class="bg-surface-elevated"
                >
                  {{ result.year }}
                </SipacBadge>
              </div>

              <h3
                class="font-display text-[1.1rem] font-medium leading-snug text-text transition-colors group-hover/card:text-sipac-900 sm:text-lg"
              >
                {{ result.title }}
              </h3>

              <p class="text-[0.95rem] leading-relaxed text-text-muted line-clamp-2">
                {{ result.summary }}
              </p>

              <div class="mt-4 flex flex-wrap items-center gap-3 border-t border-border/30 pt-3">
                <p
                  v-if="result.authors.length"
                  class="flex items-center gap-1.5 text-xs font-medium text-text-soft sm:text-sm"
                >
                  <UIcon
                    name="i-lucide-users"
                    class="size-4 shrink-0 text-sipac-600/70"
                    aria-hidden="true"
                  />
                  <span class="line-clamp-1">{{ result.authors.join(', ') }}</span>
                </p>
              </div>

              <div
                v-if="result.relatedReason"
                class="mt-3 flex items-start gap-2.5 rounded-xl border border-sipac-100 bg-sipac-50/30 p-3 text-sm leading-snug text-text-muted"
              >
                <UIcon
                  name="i-lucide-lightbulb"
                  class="mt-0.5 size-4 shrink-0 text-sipac-600"
                  aria-hidden="true"
                />
                <p class="min-w-0 flex-1 text-sm leading-relaxed">{{ result.relatedReason }}</p>
              </div>

              <div
                v-if="dedupeEvidenceSnippetsForDisplay(result.evidenceSnippets, 3).length"
                class="mt-4 space-y-3 border-l-2 border-sipac-200/50 pl-4"
              >
                <div
                  v-for="(row, evidIdx) in dedupeEvidenceSnippetsForDisplay(
                    result.evidenceSnippets,
                    3,
                  )"
                  :key="`${result.productId}-ev-${evidIdx}`"
                  class="space-y-1"
                >
                  <p class="text-[0.7rem] font-semibold tracking-wider text-sipac-800 uppercase">
                    {{ row.label }}
                  </p>
                  <p class="text-[0.9rem] italic leading-relaxed text-text-muted line-clamp-3">
                    "{{ row.text }}"
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-5 flex shrink-0 items-center gap-2 border-t border-border/20 pt-4">
            <SipacButton
              size="md"
              class="flex-1 justify-center rounded-xl bg-sipac-700 shadow-sm"
              @click="emit('openDocument', result)"
            >
              <UIcon name="i-lucide-eye" class="mr-1.5 size-4" /> Ver documento
            </SipacButton>
            <a :href="result.downloadUrl" target="_blank" rel="noreferrer" class="flex-1">
              <SipacButton
                size="md"
                color="neutral"
                variant="soft"
                class="w-full justify-center rounded-xl shadow-sm"
              >
                <UIcon name="i-lucide-download" class="mr-1.5 size-4" /> Bajar
              </SipacButton>
            </a>
          </div>
        </article>
      </div>

      <div
        v-else
        class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-surface-muted/30 px-6 py-10 text-center transition-colors hover:bg-surface-muted/50"
      >
        <div
          class="flex size-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-border/50"
        >
          <UIcon name="i-lucide-search-x" class="size-5 text-sipac-400" aria-hidden="true" />
        </div>
        <p class="mt-4 font-display text-base font-medium text-text">
          No encontré resultados con esa búsqueda
        </p>
        <p class="mt-1.5 max-w-sm text-sm text-text-muted">
          Prueba con otra palabra clave, un autor, una institución o un rango de fechas más amplio.
        </p>
      </div>
    </div>

    <div
      v-else
      class="flex flex-col items-center justify-center gap-4 px-6 py-8 sm:px-8"
      role="status"
      aria-live="polite"
    >
      <div class="loader-orbit" aria-hidden="true">
        <div class="loader-orbit-dot" />
      </div>
      <p
        class="font-display text-[0.95rem] font-medium tracking-tight text-text-muted animate-pulse"
      >
        Revisando base de datos…
      </p>
    </div>
  </div>
</template>
