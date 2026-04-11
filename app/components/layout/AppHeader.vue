<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const route = useRoute()
const { user, isAdmin, logout } = useAuth()
const notificationsStore = useNotificationsStore()
const mobileSidebarOpen = useState<boolean>('sipac-mobile-sidebar-open')
const isHomeSpecial = computed(() => route.path === '/' && !isAdmin.value)
const isChatSpecial = computed(() => route.path.startsWith('/chat'))
const isWorkspaceDocumentsSpecial = computed(() => route.path === '/workspace-documents')

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

const routeMeta = computed(() => {
  if (route.path === '/profile') {
    return {
      eyebrow: 'Cuenta personal',
      title: 'Mi perfil',
      description: 'Información personal y control de credenciales.',
    }
  }

  if (route.path === '/admin/users') {
    return {
      eyebrow: 'Administración',
      title: 'Gestión de usuarios',
      description: 'Cuentas, roles y estado de acceso institucional.',
    }
  }

  if (route.path === '/dashboard') {
    return {
      eyebrow: 'Analítica',
      title: 'Dashboard académico',
      description: 'Revisa tu avance, detecta patrones y entiende cómo va tu producción.',
    }
  }

  if (route.path === '/repository') {
    return {
      eyebrow: 'Base académica',
      title: 'Repositorio académico',
      description:
        'Explora productos confirmados, revisa filtros y encuentra material útil sin salir del flujo.',
    }
  }

  if (route.path === '/chat') {
    return {
      eyebrow: 'Consulta asistida',
      title: 'Chat con respaldo documental',
      description:
        'Haz preguntas en lenguaje natural y revisa los documentos que sustentan cada respuesta.',
    }
  }

  if (route.path === '/admin/audit-logs') {
    return {
      eyebrow: 'Auditoría',
      title: 'Registro de auditoría',
      description: 'Trazabilidad de accesos y operaciones críticas del sistema.',
    }
  }

  if (route.path === '/') {
    return {
      eyebrow: isAdmin.value ? 'Centro administrativo' : 'Centro de trabajo',
      title: isAdmin.value ? 'Panel institucional' : 'Tu jornada en SIPAc',
      description: isAdmin.value
        ? 'Supervisa usuarios, actividad y operacion sin perder de vista lo importante.'
        : 'Retoma consultas, revisa borradores y mantén tu produccion lista para el siguiente paso.',
    }
  }

  return {
    eyebrow: isAdmin.value ? 'Centro administrativo' : 'Workspace de productividad',
    title: isAdmin.value ? 'Panel institucional' : 'Bienvenido a SIPAc',
    description: isAdmin.value
      ? 'Supervisa usuarios, actividad y operación sin perder de vista lo importante.'
      : 'Continúa tu trabajo, consulta documentos y organiza nuevas evidencias.',
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
  void notificationsStore.fetchNotifications()
}

function openMobileSidebar() {
  mobileSidebarOpen.value = true
}

watch(
  () => user.value?._id,
  (nextUserId) => {
    if (nextUserId) {
      notificationsStore.startPolling()
      stopNotificationsFocusRefresh?.()
      stopNotificationsFocusRefresh = notificationsStore.refreshOnFocus()
      return
    }

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
    class="border-b backdrop-blur-md"
    :class="
      isHomeSpecial || isChatSpecial || isWorkspaceDocumentsSpecial
        ? 'border-border/35 bg-white/68 supports-[backdrop-filter]:bg-white/58'
        : 'border-border/50 bg-white/85'
    "
  >
    <div
      class="mx-auto flex w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
      :class="
        isHomeSpecial || isChatSpecial || isWorkspaceDocumentsSpecial
          ? 'max-w-[96rem] py-3.5 xl:px-10'
          : 'max-w-7xl py-4'
      "
    >
      <div class="flex min-w-0 items-start gap-3">
        <SipacButton
          color="neutral"
          variant="ghost"
          class="mt-1 rounded-full p-2 lg:hidden"
          aria-label="Abrir navegación principal"
          @click="openMobileSidebar"
        >
          <UIcon name="i-lucide-panel-left-open" class="size-5" />
        </SipacButton>

        <div v-if="isHomeSpecial" class="min-w-0">
          <div class="flex flex-wrap items-center gap-3">
            <p class="text-[0.68rem] font-semibold tracking-[0.22em] text-text-soft uppercase">
              Workspace docente
            </p>
            <span class="hidden h-1 w-1 rounded-full bg-border sm:block" />
            <SipacBadge color="neutral" variant="outline" size="sm" class="capitalize">
              {{ todayLabel }}
            </SipacBadge>
          </div>
          <p class="mt-2 text-sm leading-6 text-text-muted">
            Vuelve a lo que importa hoy sin cargar el inicio con chrome innecesario.
          </p>
        </div>

        <div v-else-if="isChatSpecial" class="min-w-0">
          <div class="flex flex-wrap items-center gap-3">
            <p class="text-[0.68rem] font-semibold tracking-[0.22em] text-text-soft uppercase">
              {{ isAdmin ? 'Centro administrativo' : 'Workspace docente' }}
            </p>
            <span class="hidden h-1 w-1 rounded-full bg-border sm:block" />
            <SipacBadge color="primary" variant="subtle" size="sm" class="gap-1">
              <UIcon name="i-lucide-shield-check" class="size-3" />
              Respaldo documental
            </SipacBadge>
            <span class="hidden h-1 w-1 rounded-full bg-border sm:block" />
            <SipacBadge color="neutral" variant="outline" size="sm" class="capitalize">
              {{ todayLabel }}
            </SipacBadge>
          </div>
          <p class="mt-2 text-sm leading-6 text-text-muted">
            Haz preguntas como lo harías con un colega; las respuestas se apoyan en los documentos
            que ya subiste a SIPAc.
          </p>
        </div>

        <div v-else-if="isWorkspaceDocumentsSpecial" class="min-w-0">
          <div class="flex flex-wrap items-center gap-3">
            <p class="text-[0.68rem] font-semibold tracking-[0.22em] text-text-soft uppercase">
              {{ isAdmin ? 'Centro administrativo' : 'Workspace docente' }}
            </p>
            <span class="hidden h-1 w-1 rounded-full bg-border sm:block" />
            <SipacBadge color="primary" variant="subtle" size="sm" class="gap-1">
              <UIcon name="i-lucide-folder-up" class="size-3" />
              Carga y revisión
            </SipacBadge>
            <span class="hidden h-1 w-1 rounded-full bg-border sm:block" />
            <SipacBadge color="neutral" variant="outline" size="sm" class="capitalize">
              {{ todayLabel }}
            </SipacBadge>
          </div>
          <p class="mt-2 text-sm leading-6 text-text-muted">
            Sube un PDF o una imagen, revisa la ficha que te proponemos y confirma cuando esté
            lista.
          </p>
        </div>

        <div v-else class="min-w-0">
          <p class="text-[0.68rem] font-semibold tracking-[0.22em] text-text-soft uppercase">
            {{ routeMeta.eyebrow }}
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <h2 class="font-display text-2xl font-semibold text-text sm:text-[2rem]">
              {{ routeMeta.title }}
            </h2>
            <SipacBadge color="neutral" variant="outline" size="sm" class="capitalize">
              {{ todayLabel }}
            </SipacBadge>
          </div>
          <p class="mt-1 max-w-2xl text-sm leading-6 text-text-muted">
            {{ routeMeta.description }}
          </p>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-2 sm:gap-3">
        <SipacBadge
          :color="isAdmin ? 'warning' : 'primary'"
          variant="outline"
          class="hidden sm:inline-flex"
        >
          {{ isAdmin ? 'Administrador' : 'Docente' }}
        </SipacBadge>

        <div class="relative">
          <SipacButton
            color="neutral"
            variant="ghost"
            class="rounded-full p-2"
            aria-label="Abrir notificaciones"
            @click="openNotifications"
          >
            <UIcon name="i-lucide-bell" class="size-4.5" />
          </SipacButton>
          <span
            v-if="unreadCount"
            class="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-sipac-700 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white"
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

    <UModal v-model:open="showNotifications" title="Notificaciones">
      <template #body>
        <DashboardNotificationsInbox />
      </template>
    </UModal>
  </header>
</template>
