<script setup lang="ts">
import SipacLogoMarkEasterEgg from '~/components/brand/SipacLogoMarkEasterEgg.vue'
import type { ChatSearchResult, ChatUiMessage } from '~~/app/types'
import { getChatCopyErrorFeedback, getChatCopySuccessFeedback } from '~~/app/utils/chat-feedback'
import { formatChatTimestamp } from '~~/app/utils/chat-formatters'
import { chatMessagePlainText, isStoppedAssistantMessage } from '~~/app/utils/chat-message-text'

const props = defineProps<{
  messages: ChatUiMessage[]
  initializing: boolean
  isStreaming?: boolean
  activityLabel?: string | null
  activityPhase?: 'preparing' | 'searching' | 'writing' | null
}>()

const emit = defineEmits<{
  openDocument: [result: ChatSearchResult]
}>()

const toast = useToast()
const threadRoot = ref<HTMLElement | null>(null)
const nearBottom = ref(true)
const isAssistantBusy = computed(() => Boolean(props.activityPhase))

const streamLogoPhase = computed<'preparing' | 'searching' | 'writing'>(() => {
  return props.activityPhase ?? 'preparing'
})

const disableEasterEgg = computed(() => {
  return isAssistantBusy.value
})

const showStreamingPlaceholder = computed(() => {
  if (!isAssistantBusy.value) {
    return false
  }

  const last = props.messages[props.messages.length - 1]
  return !last || last.role !== 'assistant'
})

function updateNearBottom() {
  const el = threadRoot.value
  if (!el) {
    return
  }
  const threshold = 100
  nearBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}

function scrollThreadToBottom(behavior: ScrollBehavior = 'smooth') {
  const el = threadRoot.value
  if (!el) {
    return
  }
  el.scrollTo({ top: el.scrollHeight, behavior })
}

async function copyAssistantMessage(message: ChatUiMessage) {
  const text = chatMessagePlainText(message)
  if (!text) {
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    const feedback = getChatCopySuccessFeedback()
    toast.add({
      title: feedback.title,
      description: feedback.description,
      color: 'success',
      icon: 'i-lucide-copy-check',
    })
  } catch {
    const feedback = getChatCopyErrorFeedback()
    toast.add({
      title: feedback.title,
      description: feedback.description,
      color: 'error',
      icon: 'i-lucide-octagon-alert',
    })
  }
}

function buildLastMessageScrollSignature() {
  const last = props.messages[props.messages.length - 1]
  if (!last) {
    return ''
  }

  return JSON.stringify({
    id: last.id,
    role: last.role,
    finishReason: last.metadata?.finishReason ?? null,
    stoppedByUser: last.metadata?.stoppedByUser ?? null,
    parts: last.parts.map((part) => {
      if (part.type === 'text') {
        return {
          type: 'text',
          length: part.text.length,
        }
      }

      if (part.type === 'tool-searchRepositoryProducts') {
        return {
          type: part.type,
          state: part.state,
          toolCallKey: part.state === 'output-available' ? part.output.toolCallKey : null,
          total: part.state === 'output-available' ? part.output.total : null,
          strategy: part.state === 'output-available' ? part.output.strategyUsed : null,
        }
      }

      return {
        type: part.type,
      }
    }),
  })
}

watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    if (nearBottom.value) {
      scrollThreadToBottom()
    }
  },
)

watch(
  () => buildLastMessageScrollSignature(),
  async () => {
    await nextTick()
    if (nearBottom.value && props.isStreaming) {
      scrollThreadToBottom()
      return
    }

    if (nearBottom.value) {
      scrollThreadToBottom()
    }
  },
)

watch(
  () => props.isStreaming,
  async (streaming) => {
    if (streaming) {
      await nextTick()
      if (nearBottom.value) {
        scrollThreadToBottom()
      }
    }
  },
)

onMounted(() => {
  void nextTick(() => scrollThreadToBottom('instant'))
})
</script>

<template>
  <div class="relative min-h-0 flex-1">
    <div
      ref="threadRoot"
      class="chat-thread-scroll h-full max-h-full overflow-y-auto overscroll-contain px-3 py-4 pb-6 sm:px-8 sm:pb-8"
      tabindex="-1"
      role="log"
      aria-relevant="additions text"
      aria-label="Mensajes de la conversación"
      @scroll.passive="updateNearBottom"
    >
      <Transition name="chat-msg" mode="out-in">
        <div
          v-if="initializing"
          key="initializing"
          class="mx-auto grid max-w-3xl gap-3"
          aria-busy="true"
          aria-label="Cargando conversación"
        >
          <div class="skeleton-shimmer h-16 rounded-xl" />
          <div class="skeleton-shimmer ml-auto h-12 w-4/5 max-w-md rounded-xl" />
          <div class="skeleton-shimmer h-24 rounded-xl" />
        </div>

        <TransitionGroup
          v-else
          name="chat-msg"
          tag="div"
          class="mx-auto max-w-3xl space-y-8"
          appear
        >
          <article v-for="(message, msgIndex) in messages" :key="message.id" class="chat-msg-item">
            <!-- Usuario: pastilla compacta a la derecha -->
            <div v-if="message.role === 'user'" class="flex justify-end">
              <div
                class="user-pill max-w-[min(100%,28rem)] rounded-2xl rounded-br-md border border-sipac-200/50 bg-gradient-to-br from-sipac-50/95 to-earth-50/80 px-4 py-2.5 shadow-sm"
              >
                <template v-for="(part, index) in message.parts" :key="`${message.id}-${index}`">
                  <ChatMarkdownRenderer
                    v-if="part.type === 'text' && part.text.trim().length"
                    tone="user"
                    :content="part.text"
                  />
                </template>
              </div>
            </div>

            <!-- Asistente: lectura tipo documento, sin caja pesada -->
            <div
              v-else
              class="assistant-turn"
              :class="msgIndex > 0 ? 'mt-2 border-t border-border/35 pt-6' : 'pt-0.5'"
            >
              <div class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-text">
                  <UIcon
                    name="i-lucide-sparkles"
                    class="size-3.5 text-sipac-600"
                    aria-hidden="true"
                  />
                  Asistente SIPAc
                </span>
                <span
                  v-if="formatChatTimestamp(message.metadata?.createdAt)"
                  class="text-[0.75rem] text-text-soft sm:text-sm"
                >
                  {{ formatChatTimestamp(message.metadata?.createdAt) }}
                </span>
                <SipacBadge
                  v-if="isStoppedAssistantMessage(message)"
                  color="warning"
                  variant="subtle"
                  size="sm"
                >
                  Respuesta detenida
                </SipacBadge>
                <span
                  v-if="isStoppedAssistantMessage(message) && msgIndex === messages.length - 1"
                  class="sr-only"
                  aria-live="polite"
                >
                  La respuesta fue detenida. Se conservó el texto generado hasta este punto.
                </span>
                <SipacButton
                  v-if="chatMessagePlainText(message)"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-copy"
                  class="ms-auto opacity-80 hover:opacity-100"
                  aria-label="Copiar respuesta"
                  @click="copyAssistantMessage(message)"
                />
              </div>

              <div class="space-y-4">
                <template v-for="(part, index) in message.parts" :key="`${message.id}-${index}`">
                  <div
                    v-if="part.type === 'text' && part.text.trim().length"
                    :class="[
                      isStreaming &&
                        msgIndex === messages.length - 1 &&
                        'chat-text-block--streaming',
                    ]"
                  >
                    <ChatMarkdownRenderer tone="assistant" :content="part.text" />
                  </div>
                  <ChatRepositoryToolBlock
                    v-else-if="part.type === 'tool-searchRepositoryProducts'"
                    :message="message"
                    :part-index="index"
                    @open-document="emit('openDocument', $event)"
                  />
                </template>

                <div v-if="msgIndex === messages.length - 1" class="streaming-tail">
                  <span class="sr-only">
                    {{
                      isAssistantBusy ? (activityLabel ?? 'Generando respuesta') : 'Respuesta lista'
                    }}
                  </span>
                  <div class="streaming-tail__logo">
                    <SipacLogoMarkEasterEgg
                      :base-phase="isAssistantBusy ? streamLogoPhase : 'preparing'"
                      :disabled="disableEasterEgg"
                      aria-label="Animar logo de conversación"
                    />
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article
            v-if="showStreamingPlaceholder"
            key="streaming-placeholder"
            class="chat-msg-item"
          >
            <div class="assistant-turn pt-0.5">
              <div class="streaming-tail streaming-tail--inline">
                <span class="sr-only">{{ activityLabel ?? 'Preparando la respuesta…' }}</span>
                <div class="streaming-tail__logo">
                  <SipacLogoMarkEasterEgg
                    :base-phase="streamLogoPhase"
                    :disabled="disableEasterEgg"
                    aria-label="Animar logo de estado"
                  />
                </div>
              </div>
            </div>
          </article>
        </TransitionGroup>
      </Transition>
    </div>

    <Transition name="chat-fab">
      <div
        v-if="messages.length && !nearBottom"
        class="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center sm:bottom-6"
      >
        <SipacButton
          color="primary"
          variant="solid"
          size="sm"
          icon="i-lucide-arrow-down"
          class="pointer-events-auto shadow-md"
          aria-label="Ir al final de la conversación"
          @click="scrollThreadToBottom()"
        >
          Abajo
        </SipacButton>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.chat-text-block--streaming :deep(.chat-md-root) {
  animation: chat-stream-soft 2.4s ease-in-out infinite;
}

@keyframes chat-stream-soft {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.92;
  }
}

.streaming-tail {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding-top: 0.35rem;
}

.streaming-tail--inline {
  padding-top: 0;
}

.streaming-tail__logo {
  width: 72px;
  height: 72px;
}

@media (min-width: 640px) {
  .streaming-tail__logo {
    width: 88px;
    height: 88px;
  }
}

.chat-msg-enter-active,
.chat-msg-leave-active {
  transition:
    opacity 0.28s var(--ease-sipac, ease-out),
    transform 0.28s var(--ease-sipac, ease-out);
}

.chat-msg-enter-from,
.chat-msg-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.chat-fab-enter-active,
.chat-fab-leave-active {
  transition: opacity 0.2s ease;
}

.chat-fab-enter-from,
.chat-fab-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .chat-text-block--streaming :deep(.chat-md-root) {
    animation: none;
  }

  .streaming-tail__logo {
    opacity: 0.85;
  }

  .chat-msg-item {
    transition: none;
  }

  .chat-msg-enter-active,
  .chat-msg-leave-active,
  .chat-fab-enter-active,
  .chat-fab-leave-active {
    transition: none;
  }
}
</style>
