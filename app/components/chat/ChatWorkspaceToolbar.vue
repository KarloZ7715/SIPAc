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
    class="shrink-0 sticky top-0 z-10 border-b border-border/30 bg-surface/60 px-3 py-2 backdrop-blur-xl sm:px-5 sm:py-2.5 transition-all duration-300"
  >
    <div class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div class="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sipac-50/50 text-sipac-700 ring-1 ring-sipac-100 sm:size-8 sm:rounded-xl"
          aria-hidden="true"
        >
          <UIcon name="i-lucide-messages-square" class="size-4" />
        </span>
        <div class="min-w-0">
          <h2
            class="truncate font-display text-[0.95rem] font-semibold tracking-tight text-text sm:text-base"
          >
            {{ title }}
          </h2>
          <p class="text-[0.7rem] text-text-muted sm:text-xs">
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
