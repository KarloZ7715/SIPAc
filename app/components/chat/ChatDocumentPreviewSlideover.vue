<script setup lang="ts">
import { formatChatProductType } from '~~/app/utils/chat-formatters'
import type { ChatSearchResult } from '~~/app/types'

defineProps<{
  document: ChatSearchResult | null
}>()

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <USlideover v-model:open="open" side="right" :ui="{ content: 'max-w-2xl' }">
    <template #header>
      <div class="flex items-center gap-3">
        <span
          class="flex size-10 items-center justify-center rounded-xl bg-sipac-100 text-sipac-700"
          aria-hidden="true"
        >
          <UIcon name="i-lucide-file-text" class="size-5" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-text-soft">Vista previa</p>
          <h3 class="truncate font-semibold text-text">
            {{ document?.title || 'Documento' }}
          </h3>
        </div>
      </div>
    </template>

    <template #body>
      <div v-if="document" class="space-y-4">
        <div class="rounded-xl border border-border/60 bg-surface-muted/50 p-4 space-y-3">
          <div class="flex flex-wrap gap-2">
            <SipacBadge color="primary" variant="subtle">
              {{ formatChatProductType(document.productType) }}
            </SipacBadge>
            <SipacBadge v-if="document.year" color="neutral" variant="outline">
              {{ document.year }}
            </SipacBadge>
          </div>

          <p class="text-sm text-text-muted">{{ document.summary }}</p>

          <p v-if="document.authors.length" class="text-sm text-text-soft">
            <UIcon name="i-lucide-users" class="mr-1 inline size-3.5" aria-hidden="true" />
            {{ document.authors.join(', ') }}
          </p>

          <div class="flex flex-wrap gap-2 pt-2">
            <a :href="document.viewUrl" target="_blank" rel="noreferrer">
              <SipacButton size="sm" icon="i-lucide-external-link">
                Abrir en nueva pestaña
              </SipacButton>
            </a>
            <a :href="document.downloadUrl" target="_blank" rel="noreferrer">
              <SipacButton size="sm" color="neutral" variant="soft" icon="i-lucide-download">
                Descargar archivo
              </SipacButton>
            </a>
          </div>
        </div>

        <div class="overflow-hidden rounded-xl border border-border/70 bg-white">
          <iframe
            :src="document.viewUrl"
            title="Vista previa del documento"
            class="h-[65vh] w-full bg-white"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
