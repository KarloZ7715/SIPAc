<script setup lang="ts">
interface SidebarItem {
  label: string
  to: string
  icon: string
  caption: string
  match?: string
  kind?: 'route' | 'anchor'
}

const props = defineProps<{
  collapsed?: boolean
}>()

const route = useRoute()
const { user, isAdmin } = useAuth()

const initials = computed(() => {
  if (!user.value?.fullName) return 'SI'

  return user.value.fullName
    .split(' ')
    .slice(0, 2)
    .map((chunk) => chunk[0])
    .join('')
    .toUpperCase()
})

const docenteItems: SidebarItem[] = [
  {
    label: 'Inicio',
    to: '/',
    icon: 'i-lucide-layout-dashboard',
    caption: 'Vista general del workspace',
    match: '/',
    kind: 'route',
  },
  {
    label: 'Workspace IA',
    to: '/#workspace-ia',
    icon: 'i-lucide-sparkles',
    caption: 'Consultas y apoyo inteligente',
    kind: 'anchor',
  },
  {
    label: 'Documentos',
    to: '/workspace-documents',
    icon: 'i-lucide-folder-up',
    caption: 'Subir, revisar y guardar documentos',
    match: '/workspace-documents',
    kind: 'route',
  },
  {
    label: 'Mi perfil',
    to: '/profile',
    icon: 'i-lucide-user-round',
    caption: 'Cuenta y credenciales',
    match: '/profile',
    kind: 'route',
  },
]

const adminItems: SidebarItem[] = [
  {
    label: 'Inicio',
    to: '/',
    icon: 'i-lucide-layout-dashboard',
    caption: 'Resumen operativo del sistema',
    match: '/',
    kind: 'route',
  },
  {
    label: 'Usuarios',
    to: '/admin/users',
    icon: 'i-lucide-users-round',
    caption: 'Gestión administrativa de cuentas',
    match: '/admin',
    kind: 'route',
  },
  {
    label: 'Mi perfil',
    to: '/profile',
    icon: 'i-lucide-user-round',
    caption: 'Cuenta y credenciales',
    match: '/profile',
    kind: 'route',
  },
]

const items = computed(() => (isAdmin.value ? adminItems : docenteItems))

function isItemActive(item: SidebarItem) {
  if (item.kind === 'anchor') {
    const [, hash] = item.to.split('#')
    return route.path === '/' && route.hash === `#${hash}`
  }

  if (item.to === '/') {
    return route.path === '/' && !route.hash
  }

  return route.path === item.to || (!!item.match && route.path.startsWith(item.match))
}
</script>

<template>
  <div class="flex h-full flex-col justify-between gap-6 p-3">
    <div class="space-y-5">
      <div
        class="rounded-[1.65rem] border border-sipac-200/80 bg-linear-to-br from-white via-sipac-50/60 to-earth-50/50 p-4 shadow-[0_16px_40px_-28px_rgba(18,63,40,0.4)]"
      >
        <div class="flex items-start gap-3">
          <div
            class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sipac-700 text-white"
          >
            <UIcon name="i-lucide-graduation-cap" class="size-6" />
          </div>

          <div v-if="!props.collapsed" class="min-w-0 space-y-2">
            <div class="space-y-1">
              <p class="text-[0.68rem] font-semibold tracking-[0.22em] text-sipac-700 uppercase">
                Universidad de Córdoba
              </p>
              <h1 class="font-display text-xl font-semibold text-text">SIPAc</h1>
              <p class="text-sm leading-5 text-text-muted">Productividad académica inteligente.</p>
            </div>

            <div class="flex flex-wrap gap-2">
              <SipacBadge color="primary" variant="subtle" size="sm">
                {{ isAdmin ? 'Panel administrativo' : 'Workspace docente' }}
              </SipacBadge>
            </div>
          </div>
        </div>
      </div>

      <div
        class="rounded-[1.5rem] border border-border/60 bg-white/78 p-2 backdrop-blur-sm transition-colors duration-200"
      >
        <p
          v-if="!props.collapsed"
          class="px-3 pt-2 pb-3 text-[0.7rem] font-semibold tracking-[0.16em] text-text-soft uppercase"
        >
          Navegación
        </p>

        <nav aria-label="Principal">
          <ul class="space-y-1">
            <li v-for="item in items" :key="item.label">
              <SipacQuickAction
                :to="item.to"
                :icon="item.icon"
                :label="item.label"
                :caption="item.caption"
                :collapsed="props.collapsed"
                :active="isItemActive(item)"
                :emphasis="item.kind === 'anchor' ? 'quick' : 'neutral'"
              />
            </li>
          </ul>
        </nav>
      </div>
    </div>

    <div class="rounded-[1.5rem] border border-border/60 bg-white/78 p-3 backdrop-blur-sm">
      <div class="flex items-center gap-3">
        <UAvatar :text="initials" :alt="user?.fullName" size="md" class="ring-2 ring-sipac-100" />

        <div v-if="!props.collapsed" class="min-w-0">
          <p class="truncate text-sm font-semibold text-text">{{ user?.fullName }}</p>
          <p class="truncate text-xs text-text-muted">
            {{ user?.program || 'Sin programa asignado' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
