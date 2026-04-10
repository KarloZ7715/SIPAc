<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { createChatConversationId } from '~~/app/utils/chat-ids'

const props = defineProps<{
  collapsed?: boolean
  mobile?: boolean
}>()

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const mobileSidebarOpen = useState<boolean>('sipac-mobile-sidebar-open')

const VISIBLE_COUNT = 6
const showAllModal = ref(false)

const activeId = computed(() => {
  const id = route.query.id
  return typeof id === 'string' && id.trim().length > 0 ? id : null
})

function closeMobile() {
  if (props.mobile) {
    mobileSidebarOpen.value = false
  }
}

function startNewConversation() {
  chatStore.clearActiveConversation()
  void router.push({
    path: '/chat',
    query: { id: createChatConversationId() },
  })
  closeMobile()
}

function navigateToConversation(id: string) {
  void router.push({ path: '/chat', query: { id } })
  closeMobile()
}

function openConversationFromModal(id: string) {
  navigateToConversation(id)
  showAllModal.value = false
}

function formatRelativeShort(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) {
    return 'Ahora'
  }
  if (minutes < 60) {
    return `Hace ${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `Hace ${hours}h`
  }
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

function menuItemsFor(id: string): DropdownMenuItem[][] {
  return [
    [
      {
        label: 'Eliminar',
        icon: 'i-lucide-trash-2',
        color: 'error',
        onSelect: async () => {
          await chatStore.deleteConversation(id)
          if (activeId.value === id) {
            startNewConversation()
          }
        },
      },
    ],
  ]
}

const visibleConversations = computed(() => chatStore.conversations.slice(0, VISIBLE_COUNT))
const hiddenCount = computed(() => Math.max(0, chatStore.conversations.length - VISIBLE_COUNT))

onMounted(() => {
  if (route.path.startsWith('/chat')) {
    void chatStore.fetchConversations()
  }
})

watch(
  () => route.path,
  (path) => {
    if (path.startsWith('/chat')) {
      void chatStore.fetchConversations()
    }
  },
)
</script>

<template>
  <section
    v-if="!collapsed"
    class="sidebar-chat-recents mt-5 border-t border-border/50 pt-4"
    aria-labelledby="sidebar-chat-recents-heading"
  >
    <div class="mb-2 flex items-center justify-between gap-2">
      <h2
        id="sidebar-chat-recents-heading"
        class="text-[0.65rem] font-semibold tracking-[0.18em] text-text-soft uppercase"
      >
        Conversaciones
      </h2>
      <SipacButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-refresh-cw"
        class="shrink-0"
        :loading="chatStore.conversationsLoading"
        aria-label="Actualizar conversaciones"
        @click="chatStore.fetchConversations()"
      />
    </div>

    <SipacButton block size="sm" icon="i-lucide-plus" class="mb-3" @click="startNewConversation">
      Nueva conversación
    </SipacButton>

    <ul v-if="chatStore.conversations.length" class="space-y-1" role="list">
      <li v-for="c in visibleConversations" :key="c.id">
        <div
          class="group flex items-start gap-1 rounded-lg border border-transparent transition-colors"
          :class="
            c.id === activeId
              ? 'border-sipac-200/80 bg-sipac-50/90'
              : 'hover:border-border-muted hover:bg-surface-muted/60'
          "
        >
          <button
            type="button"
            class="min-w-0 flex-1 px-2 py-1.5 text-left"
            @click="navigateToConversation(c.id)"
          >
            <span class="line-clamp-2 text-[0.8rem] font-medium leading-snug text-text">
              {{ c.title }}
            </span>
            <span class="mt-0.5 block text-[0.65rem] text-text-soft">
              {{ formatRelativeShort(c.lastMessageAt) }}
            </span>
          </button>
          <UDropdownMenu :items="menuItemsFor(c.id)">
            <SipacButton
              color="neutral"
              variant="ghost"
              size="xs"
              class="mt-0.5 shrink-0 opacity-70 group-hover:opacity-100"
              icon="i-lucide-ellipsis-vertical"
              :loading="chatStore.deletingConversationId === c.id"
              aria-label="Más opciones"
              @click.stop
            />
          </UDropdownMenu>
        </div>
      </li>
    </ul>

    <p v-else-if="!chatStore.conversationsLoading" class="text-[0.75rem] text-text-muted">
      Sin conversaciones aún.
    </p>

    <div v-if="hiddenCount > 0" class="mt-2">
      <button
        type="button"
        class="w-full rounded-lg py-1.5 text-center text-[0.75rem] font-medium text-sipac-700 transition-colors hover:bg-sipac-50"
        @click="showAllModal = true"
      >
        Ver todas ({{ chatStore.conversations.length }})
      </button>
    </div>

    <UModal v-model:open="showAllModal" title="Todas las conversaciones">
      <template #body>
        <div class="max-h-[min(70vh,28rem)] space-y-1 overflow-y-auto pe-1">
          <div
            v-for="c in chatStore.conversations"
            :key="`all-${c.id}`"
            class="flex items-start gap-1 rounded-lg border border-border/50 bg-white/80 p-2"
            :class="c.id === activeId ? 'border-sipac-300 bg-sipac-50/80' : ''"
          >
            <button
              type="button"
              class="min-w-0 flex-1 text-left"
              @click="openConversationFromModal(c.id)"
            >
              <span class="line-clamp-2 text-sm font-medium text-text">{{ c.title }}</span>
              <span class="text-xs text-text-soft">
                {{ formatRelativeShort(c.lastMessageAt) }} · {{ c.messageCount }} mensajes
              </span>
            </button>
            <UDropdownMenu :items="menuItemsFor(c.id)">
              <SipacButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-ellipsis-vertical"
                aria-label="Más opciones"
                @click.stop
              />
            </UDropdownMenu>
          </div>
        </div>
      </template>
    </UModal>
  </section>
</template>
