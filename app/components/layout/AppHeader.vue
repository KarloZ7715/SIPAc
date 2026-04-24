<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const { layoutRoutePath } = usePageMotion()
const { user, isAdmin, logout } = useAuth()
const notificationsStore = useNotificationsStore()
const mobileSidebarOpen = useState<boolean>('sipac-mobile-sidebar-open')
const isHomeSpecial = computed(() => layoutRoutePath.value === '/' && !isAdmin.value)
const isChatSpecial = computed(() => layoutRoutePath.value.startsWith('/chat'))
const isWorkspaceDocumentsSpecial = computed(() => layoutRoutePath.value === '/workspace-documents')
const isDashboardSpecial = computed(() => layoutRoutePath.value === '/dashboard')
const isRepositorySpecial = computed(() => layoutRoutePath.value === '/repository')

const showNotifications = ref(false)
let stopNotificationsFocusRefresh: (() => void) | undefined

const initials = computed(() => {
  if (!user.value?.fullName) return '?'
  return user.value.fullName
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
})

interface RouteMeta {
  chapter: string
  title: string
  description: string
}

const routeMeta = computed<RouteMeta>(() => {
  const path = layoutRoutePath.value

  if (path === '/profile') {
    return {
      chapter: 'Cuenta',
      title: 'Mi perfil',
      description: 'Información personal y control de credenciales.',
    }
  }
  if (path === '/admin/users') {
    return {
      chapter: 'Administración',
      title: 'Usuarios',
      description: 'Cuentas, roles y estado de acceso institucional.',
    }
  }
  if (path === '/dashboard') {
    return {
      chapter: 'Analítica',
      title: 'Dashboard',
      description: 'Avance, patrones y producción, todo en una sola vista.',
    }
  }
  if (path === '/repository') {
    return {
      chapter: 'Catálogo',
      title: 'Repositorio académico',
      description: 'Productos confirmados organizados para consulta rápida.',
    }
  }
  if (path === '/chat') {
    return {
      chapter: 'Consulta',
      title: 'Chat con respaldo documental',
      description: 'Preguntas en lenguaje natural, respuestas fundamentadas.',
    }
  }
  if (path === '/workspace-documents') {
    return {
      chapter: 'Documentos',
      title: 'Carga y revisión',
      description: 'Sube, revisa la ficha propuesta y confirma cuando esté lista.',
    }
  }
  if (path === '/admin/audit-logs') {
    return {
      chapter: 'Auditoría',
      title: 'Registro',
      description: 'Trazabilidad de accesos y operaciones críticas.',
    }
  }
  if (path === '/') {
    return {
      chapter: isAdmin.value ? 'Administración' : 'Inicio',
      title: isAdmin.value ? 'Panel institucional' : 'Tu jornada en SIPAc',
      description: isAdmin.value
        ? 'Supervisión de usuarios, actividad y operación.'
        : 'Retoma consultas, revisa borradores y continúa tu producción.',
    }
  }
  if (path.startsWith('/help')) {
    return {
      chapter: 'Ayuda',
      title: 'Centro de ayuda',
      description: 'Guías prácticas para aprovechar SIPAc al máximo.',
    }
  }

  return {
    chapter: isAdmin.value ? 'Administración' : 'Workspace',
    title: 'SIPAc',
    description: 'Sistema Inteligente de Productividad Académica.',
  }
})

const todayLabel = computed(() =>
  new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date()),
)

const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: user.value?.fullName || '',
      type: 'label' as const,
    },
  ],
  [
    {
      label: 'Mi perfil',
      icon: 'i-lucide-user',
      to: '/profile',
    },
    ...(isAdmin.value
      ? [
          {
            label: 'Gestión de usuarios',
            icon: 'i-lucide-users',
            to: '/admin/users',
          },
        ]
      : []),
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

const unreadCount = computed(() => notificationsStore.unreadCount)

function openNotifications() {
  showNotifications.value = true
  void notificationsStore.safeFetchNotifications()
}

function openMobileSidebar() {
  mobileSidebarOpen.value = true
}

watch(
  () => user.value?._id,
  (nextUserId, previousUserId) => {
    if (nextUserId) {
      if (previousUserId && previousUserId !== nextUserId) {
        notificationsStore.resetState()
      }

      notificationsStore.startPolling()
      stopNotificationsFocusRefresh?.()
      stopNotificationsFocusRefresh = notificationsStore.refreshOnFocus()
      return
    }

    notificationsStore.resetState()
    notificationsStore.stopPolling()
    stopNotificationsFocusRefresh?.()
    stopNotificationsFocusRefresh = undefined
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  notificationsStore.stopPolling()
  stopNotificationsFocusRefresh?.()
})
</script>

<template>
  <header
    class="app-header app-header-editorial sticky! top-0 z-30 shrink-0 w-full border-b backdrop-blur-xl backdrop-saturate-[1.8] backdrop-brightness-[1.04] transition-[border-color,background-color] duration-300"
    :class="
      isHomeSpecial ||
      isChatSpecial ||
      isWorkspaceDocumentsSpecial ||
      isDashboardSpecial ||
      isRepositorySpecial
        ? 'border-border/35 bg-surface/58 supports-backdrop-filter:bg-surface/48'
        : 'border-border/50 bg-surface/72 supports-backdrop-filter:bg-surface/60'
    "
  >
    <div
      class="mx-auto flex w-full items-start justify-between gap-2.5 px-3 max-[380px]:gap-2 sm:items-center sm:gap-4 sm:px-6 lg:px-8"
      :class="
        isHomeSpecial ||
        isChatSpecial ||
        isWorkspaceDocumentsSpecial ||
        isDashboardSpecial ||
        isRepositorySpecial
          ? 'max-w-384 py-2 sm:py-3.5 xl:px-10'
          : 'max-w-300 py-2.5 sm:py-4'
      "
    >
      <div class="flex min-w-0 items-start gap-2.5 sm:gap-3">
        <SipacButton
          color="neutral"
          variant="ghost"
          class="mt-0.5 rounded-full p-1.5 lg:hidden"
          aria-label="Abrir navegación principal"
          @click="openMobileSidebar"
        >
          <UIcon name="i-lucide-panel-left-open" class="size-4.5" />
        </SipacButton>

        <div class="min-w-0">
          <p class="app-header-eyebrow max-w-full truncate">
            <span>{{ routeMeta.chapter }}</span>
            <span aria-hidden="true" class="hidden opacity-50 sm:inline">·</span>
            <time class="hidden font-normal tracking-normal capitalize sm:inline">{{
              todayLabel
            }}</time>
          </p>
          <h1
            class="mt-0.5 font-display text-[1.1rem] font-medium leading-[1.1] tracking-[-0.01em] text-text max-[380px]:text-[1.02rem] max-[380px]:leading-[1.08] sm:mt-1.5 sm:text-[1.55rem] sm:leading-[1.1] md:text-[2.1rem]"
          >
            {{ routeMeta.title }}
          </h1>
          <p
            class="mt-1 hidden max-w-2xl line-clamp-2 text-sm leading-[1.6] text-text-muted sm:block sm:line-clamp-none sm:text-[0.95rem]"
          >
            {{ routeMeta.description }}
          </p>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <div class="relative">
          <SipacButton
            color="neutral"
            variant="ghost"
            class="rounded-full p-1.5 sm:p-2"
            aria-label="Abrir notificaciones"
            @click="openNotifications"
          >
            <UIcon name="i-lucide-bell" class="size-4" />
          </SipacButton>
          <span
            v-if="unreadCount"
            class="notification-bell-indicator absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-sipac-600 px-1.5 py-0.5 text-[0.7rem] font-semibold text-[#faf9f5] shadow-[0_4px_10px_-4px_rgb(201_100_66/0.5)]"
          >
            {{ unreadCount > 9 ? '9+' : unreadCount }}
          </span>
        </div>

        <UDropdownMenu :items="items">
          <SipacButton
            color="neutral"
            variant="ghost"
            class="rounded-full p-1.5"
            aria-label="Abrir menú de usuario"
          >
            <UAvatar :text="initials" :alt="user?.fullName" size="sm" />
          </SipacButton>
        </UDropdownMenu>
      </div>
    </div>

    <UModal
      v-model:open="showNotifications"
      title="Notificaciones"
      :ui="{ body: 'overflow-y-auto overflow-x-hidden' }"
    >
      <template #body>
        <DashboardNotificationsInbox />
      </template>
    </UModal>
  </header>
</template>
