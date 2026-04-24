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
const editingId = ref<string | null>(null)
const editTitleValue = ref('')

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

// Global shortcut para nueva conversación
function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    startNewConversation()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

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

function menuItemsFor(id: string, currentTitle: string): DropdownMenuItem[][] {
  return [
    [
      {
        label: 'Renombrar',
        icon: 'i-lucide-pencil',
        onSelect: () => {
          editingId.value = id
          editTitleValue.value = currentTitle
        },
      },
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

async function saveRename(id: string) {
  if (!editingId.value) return
  if (editTitleValue.value.trim().length > 0) {
    try {
      await chatStore.renameConversation(id, editTitleValue.value.trim())
    } catch {
      console.warn('Rename error ignored')
    }
  }
  editingId.value = null
}

const visibleConversations = computed(() => chatStore.conversations.slice(0, VISIBLE_COUNT))
const hiddenCount = computed(() => Math.max(0, chatStore.conversations.length - VISIBLE_COUNT))
const shouldShowBootLoading = computed(
  () => !chatStore.conversationsResolved && !chatStore.conversations.length,
)
</script>

<template>
  <section
    :data-collapsed="props.collapsed ? 'true' : 'false'"
    class="sidebar-chat-recents overflow-x-hidden mt-5 border-t border-border/50 pt-4 transition-all duration-300"
    aria-labelledby="sidebar-chat-recents-heading"
  >
    <div class="mb-2 flex items-center justify-between gap-2">
      <h2
        id="sidebar-chat-recents-heading"
        class="text-[0.72rem] font-semibold tracking-[0.14em] text-text-soft uppercase"
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

    <SipacButton
      color="primary"
      variant="outline"
      block
      size="sm"
      icon="i-lucide-plus"
      class="mb-3 border-dashed border-sipac-300 hover:border-sipac-400 hover:bg-sipac-50/50"
      @click="startNewConversation"
    >
      Nueva conversación
    </SipacButton>

    <div v-if="shouldShowBootLoading" class="space-y-2" aria-busy="true">
      <div
        v-for="index in 4"
        :key="`chat-recents-skeleton-${index}`"
        class="h-14 rounded-xl bg-surface-muted/80"
      />
    </div>

    <TransitionGroup
      v-else-if="chatStore.conversations.length"
      name="sidebar-recents"
      tag="ul"
      class="space-y-1"
      role="list"
    >
      <li v-for="c in visibleConversations" :key="c.id">
        <div
          class="group flex items-start gap-1 rounded-lg border transition-all duration-200"
          :class="
            c.id === activeId
              ? 'border-sipac-200/60 bg-sipac-50/60 shadow-sm'
              : 'border-transparent hover:bg-surface-muted/50'
          "
        >
          <div v-if="editingId === c.id" class="min-w-0 flex-1 px-2 py-1.5 flex gap-1 items-center">
            <input
              v-model="editTitleValue"
              class="text-sm font-medium border border-border/50 rounded-sm px-1 py-0.5 w-full outline-none focus:ring-1 ring-sipac-500 bg-white"
              @keyup.enter="saveRename(c.id)"
              @blur="saveRename(c.id)"
              @keydown.esc="editingId = null"
            />
          </div>
          <button
            v-else
            type="button"
            class="min-w-0 flex-1 px-2 py-1.5 text-left"
            @click="navigateToConversation(c.id)"
          >
            <span class="line-clamp-2 text-sm font-medium leading-snug text-text">
              {{ c.title }}
            </span>
            <span class="mt-0.5 block text-[0.75rem] text-text-soft">
              {{ formatRelativeShort(c.lastMessageAt) }}
            </span>
          </button>
          <UDropdownMenu :items="menuItemsFor(c.id, c.title)">
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
    </TransitionGroup>

    <p v-else-if="!chatStore.conversationsLoading" class="text-sm text-text-muted">
      Sin conversaciones aún.
    </p>

    <div v-if="hiddenCount > 0" class="mt-2">
      <button
        type="button"
        class="w-full rounded-lg py-1.5 text-center text-sm font-medium text-sipac-700 transition-colors hover:bg-sipac-50"
        @click="showAllModal = true"
      >
        Ver todas ({{ chatStore.conversations.length }})
      </button>
    </div>

    <UModal v-model:open="showAllModal" title="Todas las conversaciones">
      <template #body>
        <div class="sidebar-scroll max-h-[min(70vh,28rem)] space-y-1 overflow-y-auto pe-1">
          <div
            v-for="c in chatStore.conversations"
            :key="`all-${c.id}`"
            class="flex items-start gap-1 rounded-lg border border-border/50 bg-white/80 p-2"
            :class="c.id === activeId ? 'border-sipac-300 bg-sipac-50/80' : ''"
          >
            <div v-if="editingId === c.id" class="min-w-0 flex-1 flex gap-1 items-center">
              <input
                v-model="editTitleValue"
                class="text-sm font-medium border border-border/50 rounded-sm px-1 py-0.5 w-full outline-none focus:ring-1 ring-sipac-500 bg-white"
                @keyup.enter="saveRename(c.id)"
                @blur="saveRename(c.id)"
                @keydown.esc="editingId = null"
              />
            </div>
            <button
              v-else
              type="button"
              class="min-w-0 flex-1 text-left"
              @click="openConversationFromModal(c.id)"
            >
              <span class="line-clamp-2 text-sm font-medium text-text">{{ c.title }}</span>
              <span class="text-xs text-text-soft">
                {{ formatRelativeShort(c.lastMessageAt) }} · {{ c.messageCount }} mensajes
              </span>
            </button>
            <UDropdownMenu :items="menuItemsFor(c.id, c.title)">
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

<style scoped>
.sidebar-recents-enter-active,
.sidebar-recents-leave-active {
  transition:
    opacity var(--motion-normal, 220ms) var(--ease-sipac, cubic-bezier(0.22, 1, 0.36, 1)),
    transform var(--motion-normal, 220ms) var(--ease-sipac, cubic-bezier(0.22, 1, 0.36, 1));
}

.sidebar-recents-leave-active {
  position: absolute;
  width: 100%;
}

.sidebar-recents-enter-from,
.sidebar-recents-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.sidebar-recents-move {
  transition: transform var(--motion-normal, 220ms)
    var(--ease-sipac, cubic-bezier(0.22, 1, 0.36, 1));
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-recents-enter-active,
  .sidebar-recents-leave-active,
  .sidebar-recents-move {
    transition-duration: 1ms;
  }
}

:global(:root[data-motion='minimal']) .sidebar-recents-enter-active,
:global(:root[data-motion='minimal']) .sidebar-recents-leave-active,
:global(:root[data-motion='minimal']) .sidebar-recents-move {
  transition: none;
}
</style>
