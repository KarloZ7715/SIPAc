<script setup lang="ts">
import { motion } from 'motion-v'

const {
  chatSession,
  draftInput,
  selectedDocument,
  previewOpen,
  selectedModelKey,
  initializing,
  messages,
  chatStatus,
  activeConversationTitle,
  latestSearchResults,
  canSend,
  canStop,
  lastResponseStopped,
  assistantActivityLabel,
  assistantActivityPhase,
  handleSubmit,
  stopConversation,
  startNewConversation,
  openDocument,
} = useChatPageSession()

const hasThread = computed(() => messages.value.length > 0)
const isStreaming = computed(() => chatStatus.value === 'streaming')

const prefersReducedMotion = ref(false)

/** Entrada del compositor al pasar de bienvenida a hilo: resorte (estilo Claude), sin solapar mensajes. */
const composerDockMotion = computed(() => {
  if (prefersReducedMotion.value) {
    return {
      initial: false,
      animate: {},
      transition: { duration: 0 },
    }
  }
  return {
    initial: { opacity: 0.82, y: 44, scale: 0.972 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: {
      type: 'spring' as const,
      stiffness: 420,
      damping: 30,
      mass: 0.82,
    },
  }
})

onMounted(() => {
  if (!import.meta.client) {
    return
  }
  const mq = matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion.value = mq.matches
  const onChange = () => {
    prefersReducedMotion.value = mq.matches
  }
  mq.addEventListener('change', onChange)
  onBeforeUnmount(() => mq.removeEventListener('change', onChange))
})
</script>

<template>
  <div class="chat-page flex min-h-0 flex-1 flex-col overflow-hidden">
    <Transition name="chat-toolbar">
      <ChatWorkspaceToolbar
        v-if="hasThread"
        :title="activeConversationTitle"
        :doc-count="latestSearchResults.length"
        :chat-status="chatStatus"
        :last-response-stopped="lastResponseStopped"
      >
        <template #actions>
          <SipacButton
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-lucide-plus"
            class="lg:hidden"
            @click="startNewConversation"
          >
            Nueva
          </SipacButton>
        </template>
      </ChatWorkspaceToolbar>
    </Transition>

    <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <Transition name="chat-phase" mode="out-in">
        <div
          v-if="!hasThread"
          key="welcome"
          class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
        >
          <div
            class="flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-6 sm:px-4 sm:py-10"
          >
            <ChatWelcomeState />
            <div
              v-if="initializing && !chatSession"
              class="mt-8 grid w-full max-w-xl gap-3"
              aria-busy="true"
            >
              <div class="skeleton-shimmer h-20 rounded-2xl" />
              <div class="skeleton-shimmer h-11 rounded-xl" />
            </div>
            <ChatComposer
              v-else
              v-model:selected-model-key="selectedModelKey"
              class="mt-8 w-full max-w-2xl"
              :model-value="draftInput"
              layout="centered"
              :can-send="canSend"
              :can-stop="canStop"
              :busy="chatStatus === 'submitted' || chatStatus === 'streaming'"
              @update:model-value="draftInput = $event"
              @submit="handleSubmit"
              @stop="stopConversation"
            />
          </div>
        </div>

        <div v-else key="thread" class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ChatMessageThread
            v-if="chatSession"
            :messages="messages"
            :initializing="initializing"
            :is-streaming="isStreaming"
            :activity-label="assistantActivityLabel"
            :activity-phase="assistantActivityPhase"
            @open-document="openDocument"
          />
          <motion.div
            v-bind="composerDockMotion"
            class="chat-composer-dock shrink-0 border-t border-border/60 bg-[linear-gradient(rgb(255_255_255/0.96),rgb(247_246_240/0.94))] shadow-[0_-18px_36px_-28px_rgb(20_20_19/0.12),inset_0_1px_0_0_rgb(255_255_255/0.65)] backdrop-blur-xl supports-[backdrop-filter]:bg-surface/78"
          >
            <div class="w-full px-3 py-2 sm:px-8 sm:py-3">
              <ChatComposer
                v-model:selected-model-key="selectedModelKey"
                :model-value="draftInput"
                layout="docked"
                :can-send="canSend"
                :can-stop="canStop"
                :busy="chatStatus === 'submitted' || chatStatus === 'streaming'"
                @update:model-value="draftInput = $event"
                @submit="handleSubmit"
                @stop="stopConversation"
              />
            </div>
          </motion.div>
        </div>
      </Transition>
    </div>

    <ChatIaFooter />

    <ChatDocumentPreviewSlideover v-model:open="previewOpen" :document="selectedDocument" />
  </div>
</template>

<style scoped>
.chat-toolbar-enter-active,
.chat-toolbar-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.chat-toolbar-enter-from,
.chat-toolbar-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.chat-phase-enter-active,
.chat-phase-leave-active {
  transition:
    opacity 0.32s var(--ease-sipac, cubic-bezier(0.22, 1, 0.36, 1)),
    transform 0.32s var(--ease-sipac, cubic-bezier(0.22, 1, 0.36, 1));
}

.chat-phase-enter-from,
.chat-phase-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@media (prefers-reduced-motion: reduce) {
  .chat-toolbar-enter-active,
  .chat-toolbar-leave-active,
  .chat-phase-enter-active,
  .chat-phase-leave-active {
    transition: none;
  }

  .chat-toolbar-enter-from,
  .chat-toolbar-leave-to,
  .chat-phase-enter-from,
  .chat-phase-leave-to {
    transform: none;
  }
}
</style>
