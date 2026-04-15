<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

interface SidebarItem {
  label: string
  to: string
  icon: string
  match?: string
}

interface SidebarSection {
  label: string
  items: SidebarItem[]
}

const props = defineProps<{
  collapsed?: boolean
  mobile?: boolean
}>()

const route = useRoute()
const { user, isAdmin, logout } = useAuth()
const mobileSidebarOpen = useState<boolean>('sipac-mobile-sidebar-open')
const desktopSidebarCollapsed = useState<boolean>('sipac-desktop-sidebar-collapsed')

const initials = computed(() => {
  if (!user.value?.fullName) return 'SI'

  return user.value.fullName
    .split(' ')
    .slice(0, 2)
    .map((chunk) => chunk[0])
    .join('')
    .toUpperCase()
})

const workspaceLabel = computed(() => 'Sistema Inteligente de Productividad Académica')
const footerMeta = computed(
  () => user.value?.program || (isAdmin.value ? 'Administrador' : 'Docente'),
)

const docenteSections: SidebarSection[] = [
  {
    label: 'Principal',
    items: [
      { label: 'Inicio', to: '/', icon: 'i-lucide-house', match: '/' },
      { label: 'Chat', to: '/chat', icon: 'i-lucide-sparkles', match: '/chat' },
      {
        label: 'Documentos',
        to: '/workspace-documents',
        icon: 'i-lucide-folder-up',
        match: '/workspace-documents',
      },
      {
        label: 'Dashboard',
        to: '/dashboard',
        icon: 'i-lucide-chart-column-big',
        match: '/dashboard',
      },
      {
        label: 'Repositorio',
        to: '/repository',
        icon: 'i-lucide-library-big',
        match: '/repository',
      },
    ],
  },
]

const adminSections: SidebarSection[] = [
  {
    label: 'Principal',
    items: [
      { label: 'Inicio', to: '/', icon: 'i-lucide-house', match: '/' },
      {
        label: 'Dashboard',
        to: '/dashboard',
        icon: 'i-lucide-chart-column-big',
        match: '/dashboard',
      },
      {
        label: 'Repositorio',
        to: '/repository',
        icon: 'i-lucide-library-big',
        match: '/repository',
      },
      { label: 'Chat', to: '/chat', icon: 'i-lucide-sparkles', match: '/chat' },
    ],
  },
  {
    label: 'Gestión',
    items: [
      {
        label: 'Usuarios',
        to: '/admin/users',
        icon: 'i-lucide-users-round',
        match: '/admin/users',
      },
      {
        label: 'Auditoría',
        to: '/admin/audit-logs',
        icon: 'i-lucide-shield-ellipsis',
        match: '/admin/audit-logs',
      },
    ],
  },
]

const sections = computed(() => (isAdmin.value ? adminSections : docenteSections))
const userMenuItems = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: user.value?.fullName || 'Usuario SIPAc',
      type: 'label' as const,
    },
  ],
  [
    {
      label: 'Mi perfil',
      icon: 'i-lucide-user-round',
      to: '/profile',
      onSelect: () => closeMobileSidebar(),
    },
  ],
  [
    {
      label: 'Cerrar sesión',
      icon: 'i-lucide-log-out',
      color: 'error' as const,
      onSelect: () => logout(),
    },
  ],
])

function isItemActive(item: SidebarItem) {
  if (item.to === '/') {
    return route.path === '/' && !route.hash
  }

  return route.path === item.to || (!!item.match && route.path.startsWith(item.match))
}

function closeMobileSidebar() {
  if (props.mobile) {
    mobileSidebarOpen.value = false
  }
}

function toggleDesktopSidebar() {
  if (!props.mobile) {
    desktopSidebarCollapsed.value = !desktopSidebarCollapsed.value
  }
}
</script>

<template>
  <aside
    class="sidebar-shell flex h-full flex-col overflow-hidden"
    :data-collapsed="props.collapsed && !props.mobile ? 'true' : 'false'"
    :data-mobile="props.mobile ? 'true' : 'false'"
  >
    <div
      class="flex"
      :class="
        props.collapsed && !props.mobile
          ? 'flex-col items-center gap-2'
          : 'items-start justify-between gap-3'
      "
    >
      <NuxtLink
        to="/"
        class="sidebar-brand group min-w-0 transition-all duration-[260ms]"
        :data-collapsed="props.collapsed && !props.mobile ? 'true' : 'false'"
        :aria-label="props.collapsed && !props.mobile ? 'Ir al inicio' : undefined"
        :title="props.collapsed && !props.mobile ? 'Ir al inicio' : undefined"
        @click="closeMobileSidebar"
      >
        <span class="sidebar-brand__mark" aria-hidden="true">
          <svg
            class="w-12 h-12 lg:w-14 lg:h-14"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 100 100"
          >
            <g stroke-linecap="round" stroke-linejoin="round">
              <polygon fill="#f3a683" points="50 36 37.876 29 37.876 43" />
              <polygon fill="#e08b66" points="50 50 50 36 37.876 43" />
              <polygon fill="#f3a683" points="62.124 43 74.248 50 62.124 57" />
              <polygon fill="#e08b66" points="50 50 62.124 43 62.124 57" />
              <polygon fill="#f3a683" points="37.876 57 37.876 71 50 64" />
              <polygon fill="#e08b66" points="50 50 37.876 57 50 64" />
              <polygon fill="#f3a683" points="37.876 29 50 36 50 22" />
              <polygon fill="#e08b66" points="62.124 29 50 36 50 22" />
              <polygon fill="#f3a683" points="62.124 29 62.124 43 74.248 36" />
              <polygon fill="#e08b66" points="74.248 50 62.124 43 74.248 36" />
              <polygon fill="#f3a683" points="74.248 50 62.124 57 74.248 64" />
              <polygon fill="#e08b66" points="62.124 71 62.124 57 74.248 64" />
              <polygon fill="#f3a683" points="62.124 71 50 64 50 78" />
              <polygon fill="#e08b66" points="37.876 71 50 64 50 78" />
              <polygon fill="#f3a683" points="37.876 71 37.876 57 25.752 64" />
              <polygon fill="#e08b66" points="25.752 50 37.876 57 25.752 64" />
              <polygon fill="#f3a683" points="25.752 50 37.876 43 25.752 36" />
              <polygon fill="#e08b66" points="37.876 29 37.876 43 25.752 36" />
            </g>
          </svg>
        </span>

        <span
          class="sidebar-brand__text"
          :data-collapsed="props.collapsed && !props.mobile ? 'true' : 'false'"
        >
          <span class="sidebar-brand__title">SIPAc</span>
          <span
            class="sidebar-brand__meta"
            title="Sistema Inteligente de Productividad Académica"
            >{{ workspaceLabel }}</span
          >
        </span>
      </NuxtLink>

      <SipacButton
        v-if="!props.mobile"
        color="neutral"
        variant="ghost"
        class="sidebar-toggle hidden shrink-0 lg:inline-flex"
        :aria-label="props.collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'"
        @click="toggleDesktopSidebar"
      >
        <UIcon
          :name="props.collapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
          class="size-[1.05rem]"
        />
      </SipacButton>

      <SipacButton
        v-else
        color="neutral"
        variant="ghost"
        class="sidebar-toggle rounded-full p-2"
        aria-label="Cerrar navegación"
        @click="closeMobileSidebar"
      >
        <UIcon name="i-lucide-x" class="size-4.5" />
      </SipacButton>
    </div>

    <div class="sidebar-divider" />

    <div class="sidebar-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
      <div class="space-y-5">
        <section
          v-for="section in sections"
          :key="section.label"
          class="sidebar-nav-section"
          :class="props.collapsed && !props.mobile ? 'items-center' : ''"
        >
          <p
            class="sidebar-section-label"
            :data-hidden="props.collapsed && !props.mobile ? 'true' : 'false'"
          >
            {{ section.label }}
          </p>

          <nav :aria-label="section.label" class="w-full transition-all duration-[260ms]">
            <ul class="space-y-1.5">
              <li v-for="item in section.items" :key="item.to">
                <LayoutSidebarNavItem
                  :to="item.to"
                  :icon="item.icon"
                  :label="item.label"
                  :collapsed="props.collapsed"
                  :active="isItemActive(item)"
                  :secondary="section.label !== 'Principal'"
                  @click="closeMobileSidebar"
                />
              </li>
            </ul>
          </nav>
        </section>

        <LayoutAppSidebarChatRecents
          v-if="route.path.startsWith('/chat')"
          :collapsed="props.collapsed"
          :mobile="props.mobile"
        />
      </div>
    </div>

    <div class="sidebar-divider mt-5" />

    <div class="pt-4">
      <UDropdownMenu :items="userMenuItems">
        <button
          type="button"
          class="sidebar-user-card w-full text-left transition-all duration-[260ms]"
          :data-collapsed="props.collapsed && !props.mobile ? 'true' : 'false'"
          :aria-label="props.collapsed && !props.mobile ? 'Abrir menú de usuario' : undefined"
          :title="props.collapsed && !props.mobile ? 'Abrir menú de usuario' : undefined"
        >
          <UAvatar
            :text="initials"
            :alt="user?.fullName"
            size="md"
            class="ring-2 ring-sipac-200/90 ring-offset-2 ring-offset-surface"
          />

          <div
            class="sidebar-user-card__text"
            :data-collapsed="props.collapsed && !props.mobile ? 'true' : 'false'"
          >
            <p class="truncate text-sm font-semibold text-text">
              {{ user?.fullName || 'Usuario SIPAc' }}
            </p>
            <p class="truncate text-xs text-text-muted">{{ footerMeta }}</p>
          </div>

          <UIcon
            name="i-lucide-chevrons-up-down"
            class="sidebar-user-card__chevron items-center justify-center shrink-0 size-4 text-text-soft"
            :data-collapsed="props.collapsed && !props.mobile ? 'true' : 'false'"
            aria-hidden="true"
          />
        </button>
      </UDropdownMenu>
    </div>
  </aside>
</template>
