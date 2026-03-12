<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const route = useRoute()
const { user, isAdmin, logout } = useAuth()
const notificationsStore = useNotificationsStore()

const showNotifications = ref(false)

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

  return {
    eyebrow: isAdmin.value ? 'Centro administrativo' : 'Workspace de productividad',
    title: isAdmin.value ? 'Panel institucional' : 'Bienvenido a SIPAc',
    description: isAdmin.value
      ? 'Supervisión de usuarios y operación del sistema.'
      : 'Consulta con IA y gestión documental académica.',
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

watch(
  () => user.value?._id,
  (nextUserId) => {
    if (nextUserId) {
      notificationsStore.startPolling()
      return
    }

    notificationsStore.stopPolling()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  notificationsStore.stopPolling()
})
</script>

<template>
  <header class="border-b border-border/50 bg-white/85 backdrop-blur-md">
    <div
      class="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8"
    >
      <div class="min-w-0">
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

      <div class="flex shrink-0 items-center gap-2 sm:gap-3">
        <SipacBadge :color="isAdmin ? 'warning' : 'primary'" variant="outline">
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
