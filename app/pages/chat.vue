<script setup lang="ts">
import { motion } from 'motion-v'

const chatStore = useChatStore()
const requestFetch = import.meta.server ? useRequestFetch() : $fetch
const route = useRoute()

await useAsyncData(
  'chat-page-bootstrap',
  async () => {
    const conversationId =
      typeof route.query.id === 'string' && route.query.id.trim().length > 0 ? route.query.id : null

    await Promise.all([
      chatStore.fetchConversations(20, requestFetch),
      chatStore.fetchProviders(requestFetch),
    ])

    if (!conversationId) {
      chatStore.clearActiveConversation()
      return true
    }

    await chatStore.fetchConversation(conversationId, requestFetch).catch(() => {
      chatStore.clearActiveConversation()
      return null
    })

    return true
  },
  {
    default: () => true,
  },
)

const {
  chatSession,
  draftInput,
  draftQuote,
  handleSetQuote,
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
  handleRegenerate,
} = useChatPageSession()

const hasThread = computed(() => messages.value.length > 0)
const isStreaming = computed(() => chatStatus.value === 'streaming')
const { prefersReducedMotion, prefersMinimalMotion, densityPreference } = useUiPreferences()
const composerLayout = computed(() => (hasThread.value ? 'docked' : 'centered'))
const showWelcomeState = computed(() => !hasThread.value && !initializing.value)
const showSessionBootState = computed(() => !hasThread.value && initializing.value)
const composerShellClass = computed(() =>
  hasThread.value
    ? 'chat-composer-shell--docked border-t border-border/60 bg-[linear-gradient(rgb(255_255_255/0.96),rgb(247_246_240/0.94))] shadow-[0_-18px_36px_-28px_rgb(20_20_19/0.12),inset_0_1px_0_0_rgb(255_255_255/0.65)] backdrop-blur-xl supports-[backdrop-filter]:bg-surface/78'
    : 'chat-composer-shell--centered page-stage-primary px-2.5 pb-4 sm:px-4 sm:pb-10',
)

/** Entrada del compositor al pasar de bienvenida a hilo: resorte (estilo Claude), sin solapar mensajes. */
const composerDockMotion = computed(() => {
  if (prefersMinimalMotion.value) {
    return {
      initial: false,
      animate: {},
      transition: { duration: 0 },
    }
  }
  if (prefersReducedMotion.value) {
    return {
      initial: { opacity: 0.92, y: 8 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
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
          v-if="showSessionBootState"
          key="boot"
          class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
        >
          <div
            class="flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-6 sm:px-4 sm:py-10"
          >
            <div
              class="page-stage-primary chat-boot-state mx-auto flex w-full max-w-2xl flex-col items-center gap-4 rounded-[1.75rem] border border-border/70 bg-white/75 px-4 py-8 text-center shadow-[0_18px_42px_-30px_rgb(20_20_19/0.12)] sm:px-6"
            >
              <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-sipac-700" />
              <div class="space-y-1.5">
                <p class="font-display text-xl font-medium text-text">
                  Preparando el espacio de consulta
                </p>
                <p class="text-sm leading-[1.6] text-text-muted">
                  Cargando conversación, historial y modos de respuesta sin desmontar el compositor.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          v-else-if="showWelcomeState"
          key="welcome"
          class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
        >
          <div
            class="flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-6 sm:px-4 sm:py-10"
          >
            <div class="page-stage-primary w-full">
              <ChatWelcomeState />
            </div>
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
            @regenerate="handleRegenerate"
            @cite="handleSetQuote"
          />
        </div>
      </Transition>

      <!-- Elimino la Transition en el composer para morphing continuo -->
      <component
        :is="hasThread ? motion.div : 'div'"
        v-bind="hasThread ? composerDockMotion : {}"
        class="chat-composer-shell shrink-0"
        :class="composerShellClass"
      >
        <div
          :class="
            hasThread
              ? densityPreference === 'compact'
                ? 'w-full px-2 py-1.5 sm:px-3 sm:py-2 md:px-6 lg:px-8'
                : 'w-full px-2 py-2 sm:px-3 sm:py-3 md:px-6 lg:px-8'
              : 'mx-auto w-full max-w-2xl'
          "
        >
          <ChatComposer
            v-model:selected-model-key="selectedModelKey"
            v-model:quote="draftQuote"
            :model-value="draftInput"
            :layout="composerLayout"
            :can-send="canSend"
            :can-stop="canStop"
            :busy="chatStatus === 'submitted' || chatStatus === 'streaming'"
            @update:model-value="draftInput = $event"
            @submit="handleSubmit"
            @stop="stopConversation"
          />
        </div>
      </component>
    </div>

    <ChatIaFooter />

    <ChatDocumentPreviewSlideover v-model:open="previewOpen" :document="selectedDocument" />
  </div>
</template>

<style scoped>
.chat-toolbar-enter-active,
.chat-toolbar-leave-active {
  transition:
    opacity var(--motion-normal, 220ms) ease,
    transform var(--motion-normal, 220ms) ease;
}

.chat-toolbar-enter-from,
.chat-toolbar-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.chat-phase-enter-active,
.chat-phase-leave-active {
  transition:
    opacity var(--motion-slow, 320ms) var(--ease-sipac, cubic-bezier(0.22, 1, 0.36, 1)),
    transform var(--motion-slow, 320ms) var(--ease-sipac, cubic-bezier(0.22, 1, 0.36, 1));
}

.chat-phase-enter-from,
.chat-phase-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.chat-composer-shell {
  transition:
    padding var(--motion-normal, 220ms) var(--ease-sipac, cubic-bezier(0.22, 1, 0.36, 1)),
    background-color var(--motion-normal, 220ms) ease,
    border-color var(--motion-normal, 220ms) ease,
    box-shadow var(--motion-normal, 220ms) var(--ease-sipac, cubic-bezier(0.22, 1, 0.36, 1)),
    border-radius var(--motion-normal, 220ms) ease,
    max-width var(--motion-normal, 220ms) var(--ease-sipac, cubic-bezier(0.22, 1, 0.36, 1));
}

@media (prefers-reduced-motion: reduce) {
  .chat-toolbar-enter-active,
  .chat-toolbar-leave-active,
  .chat-phase-enter-active,
  .chat-phase-leave-active,
  .chat-composer-shell {
    transition-duration: 1ms;
  }
}

:global(:root[data-motion='minimal']) .chat-toolbar-enter-active,
:global(:root[data-motion='minimal']) .chat-toolbar-leave-active,
:global(:root[data-motion='minimal']) .chat-phase-enter-active,
:global(:root[data-motion='minimal']) .chat-phase-leave-active,
:global(:root[data-motion='minimal']) .chat-composer-shell {
  transition: none;
}

:global(:root[data-motion='minimal']) .chat-toolbar-enter-from,
:global(:root[data-motion='minimal']) .chat-toolbar-leave-to,
:global(:root[data-motion='minimal']) .chat-phase-enter-from,
:global(:root[data-motion='minimal']) .chat-phase-leave-to {
  transform: none;
}
</style>
