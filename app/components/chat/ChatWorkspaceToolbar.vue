<script setup lang="ts">
import { getChatToolbarFeedback } from '~~/app/utils/chat-feedback'

const props = defineProps<{
  title: string
  docCount: number
  chatStatus: string
  lastResponseStopped?: boolean
}>()

const toolbarFeedback = computed(() =>
  getChatToolbarFeedback(props.chatStatus, props.lastResponseStopped ?? false),
)
</script>

<template>
  <header
    class="shrink-0 border-b border-border/50 bg-surface-elevated/90 px-3 py-2.5 backdrop-blur-md sm:px-5 sm:py-3"
  >
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sipac-50 text-sipac-700 sm:size-10 sm:rounded-2xl"
          aria-hidden="true"
        >
          <UIcon name="i-lucide-messages-square" class="size-[1.15rem] sm:size-5" />
        </span>
        <div class="min-w-0">
          <h2 class="truncate text-sm font-semibold text-text sm:text-base">{{ title }}</h2>
          <p class="text-xs text-text-muted sm:text-sm">
            <template v-if="docCount">
              {{ docCount }} documento{{ docCount === 1 ? '' : 's' }} citado{{
                docCount === 1 ? '' : 's'
              }}
              en esta conversación
            </template>
            <template v-else> Aún no hay citas en esta conversación </template>
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 sm:justify-end">
        <slot name="actions" />
        <SipacBadge :color="toolbarFeedback.color" variant="subtle" size="sm">
          {{ toolbarFeedback.label }}
        </SipacBadge>
      </div>
    </div>
  </header>
</template>
