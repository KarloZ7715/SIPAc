<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { UserPublic, CreateUserDTO, UpdateUserDTO, AuditLogPublic } from '~~/app/types'
import { createUserSchema, updateUserSchema } from '~~/server/utils/schemas/user'

interface UserDetailData {
  user: UserPublic
  products: { total: number; confirmed: number; drafts: number; deleted: number }
  recentActivity: AuditLogPublic[]
  lastSession: { lastSeenAt: string | null; ipAddress: string | null } | null
}

definePageMeta({ middleware: ['admin'] })

const ALL_ROLES_FILTER = 'all_roles'
const ALL_STATUS_FILTER = 'all_status'

const usersStore = useUsersStore()
const toast = useToast()
const requestFetch = import.meta.server ? useRequestFetch() : $fetch

const page = ref(1)
const roleFilter = ref<string>(ALL_ROLES_FILTER)
const statusFilter = ref<string>(ALL_STATUS_FILTER)
const search = ref('')

const showCreate = ref(false)
const showEdit = ref(false)
const showDetail = ref(false)
const showBulkConfirm = ref(false)
const editingUser = ref<UserPublic | null>(null)
const detailData = ref<UserDetailData | null>(null)
const detailLoading = ref(false)
const createSubmitting = ref(false)
const editSubmitting = ref(false)
const bulkSubmitting = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const pendingBulkAction = ref<{ action: string; label: string } | null>(null)

const createState = reactive<CreateUserDTO>({
  fullName: '',
  email: '',
  password: '',
  role: 'docente',
  program: '',
})

const editState = reactive<UpdateUserDTO>({
  fullName: '',
  role: undefined,
  isActive: undefined,
  program: '',
})

const roleOptions = [
  { label: 'Todos los roles', value: ALL_ROLES_FILTER },
  { label: 'Administrador', value: 'admin' },
  { label: 'Docente', value: 'docente' },
]

const statusOptions = [
  { label: 'Todos los estados', value: ALL_STATUS_FILTER },
  { label: 'Activo', value: 'true' },
  { label: 'Inactivo', value: 'false' },
]

const columns = [
  { accessorKey: 'fullName' as const, header: 'Nombre' },
  { accessorKey: 'email' as const, header: 'Correo' },
  {
    accessorKey: 'role' as const,
    header: 'Rol',
    cell: ({ row }: { row: { original: UserPublic } }) => {
      const role = row.original.role
      return h(resolveComponent('SipacBadge'), {
        variant: 'subtle',
        color: role === 'admin' ? 'warning' : 'primary',
        label: role === 'admin' ? 'Admin' : 'Docente',
      })
    },
  },
  {
    accessorKey: 'isActive' as const,
    header: 'Estado',
    cell: ({ row }: { row: { original: UserPublic } }) => {
      const active = row.original.isActive
      return h(resolveComponent('SipacBadge'), {
        variant: 'subtle',
        color: active ? 'success' : 'error',
        label: active ? 'Activo' : 'Inactivo',
      })
    },
  },
  {
    accessorKey: 'lastLoginAt' as const,
    header: 'Último login',
    cell: ({ row }: { row: { original: UserPublic } }) => {
      const d = row.original.lastLoginAt
      return d
        ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
        : 'Nunca'
    },
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }: { row: { original: UserPublic } }) => {
      return h('div', { class: 'flex gap-1' }, [
        h(resolveComponent('SipacButton'), {
          icon: 'i-lucide-eye',
          variant: 'ghost',
          color: 'neutral',
          size: 'xs',
          'aria-label': 'Ver detalle',
          onClick: () => openDetail(row.original._id),
        }),
        h(resolveComponent('SipacButton'), {
          icon: 'i-lucide-pencil',
          variant: 'ghost',
          color: 'neutral',
          size: 'xs',
          'aria-label': 'Editar usuario',
          onClick: () => openEdit(row.original),
        }),
      ])
    },
  },
]

async function loadUsers() {
  await usersStore.fetchUsers(
    {
      page: page.value,
      role: roleFilter.value === ALL_ROLES_FILTER ? undefined : roleFilter.value,
      isActive: statusFilter.value === ALL_STATUS_FILTER ? undefined : statusFilter.value,
      search: search.value || undefined,
    },
    requestFetch,
  )
}

await useAsyncData(
  'admin-users-bootstrap',
  async () => {
    await Promise.all([loadUsers(), usersStore.fetchStats()])
    return true
  },
  {
    default: () => true,
  },
)

function openEdit(user: UserPublic) {
  editingUser.value = user
  editState.fullName = user.fullName
  editState.role = user.role
  editState.isActive = user.isActive
  editState.program = user.program || ''
  showEdit.value = true
}

async function onCreate() {
  createSubmitting.value = true
  try {
    await usersStore.createUser(createState)
    showCreate.value = false
    Object.assign(createState, {
      fullName: '',
      email: '',
      password: '',
      role: 'docente',
      program: '',
    })
    toast.add({ title: 'Usuario creado', icon: 'i-lucide-check-circle', color: 'success' })
    await loadUsers()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg = err?.data?.data?.error?.message || 'Error al crear usuario'
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    createSubmitting.value = false
  }
}

async function onEdit() {
  if (!editingUser.value) return
  editSubmitting.value = true
  try {
    await usersStore.updateUser(editingUser.value._id, editState)
    showEdit.value = false
    editingUser.value = null
    toast.add({ title: 'Usuario actualizado', icon: 'i-lucide-check-circle', color: 'success' })
    await loadUsers()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg = err?.data?.data?.error?.message || 'Error al actualizar usuario'
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    editSubmitting.value = false
  }
}

function resetFilters() {
  search.value = ''
  roleFilter.value = ALL_ROLES_FILTER
  statusFilter.value = ALL_STATUS_FILTER
  page.value = 1
  loadUsers()
}

const resultCount = computed(() => usersStore.meta?.total ?? usersStore.users.length)
const globalStats = computed(() => usersStore.stats)

// --- Bulk selection ---

function requestBulkAction(action: string, label: string) {
  pendingBulkAction.value = { action, label }
  showBulkConfirm.value = true
}

async function executeBulkAction() {
  if (!pendingBulkAction.value || selectedIds.value.size === 0) return
  bulkSubmitting.value = true
  try {
    const result = await usersStore.bulkUpdate(
      Array.from(selectedIds.value),
      pendingBulkAction.value.action,
    )
    toast.add({
      title: `${result.modified} usuario(s) actualizados`,
      icon: 'i-lucide-check-circle',
      color: 'success',
    })
    selectedIds.value.clear()
    showBulkConfirm.value = false
    await Promise.all([loadUsers(), usersStore.fetchStats()])
  } catch (err: unknown) {
    const message =
      err && typeof err === 'object' && 'data' in err
        ? (
            err as {
              data?: { data?: { error?: { message?: string } } }
            }
          ).data?.data?.error?.message
        : undefined
    const msg = message || 'Error en operación masiva'
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    bulkSubmitting.value = false
  }
}

// --- User detail drawer ---
async function openDetail(userId: string) {
  showDetail.value = true
  detailLoading.value = true
  detailData.value = null
  try {
    detailData.value = await usersStore.fetchUserDetail(userId)
  } catch {
    toast.add({ title: 'Error al cargar detalle', icon: 'i-lucide-circle-alert', color: 'error' })
    showDetail.value = false
  } finally {
    detailLoading.value = false
  }
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return 'Nunca'
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

watch([page, roleFilter, statusFilter], () => {
  selectedIds.value.clear()
  loadUsers()
})

let searchTimeout: ReturnType<typeof setTimeout>
watch(search, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    page.value = 1
    selectedIds.value.clear()
    loadUsers()
  }, 400)
})
</script>

<template>
  <div class="space-y-8">
    <section class="page-stage-hero panel-surface hero-wash p-6 sm:p-8">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-4">
          <div class="section-chip">Administración segura</div>
          <SipacSectionHeader
            title="Gestión de usuarios"
            description="Control operativo de cuentas, roles y estado de acceso institucional."
            size="md"
          />
        </div>

        <div class="flex flex-wrap gap-2">
          <SipacButton
            icon="i-lucide-download"
            color="neutral"
            variant="soft"
            size="lg"
            @click="usersStore.exportUsersCSV()"
          >
            Exportar CSV
          </SipacButton>
          <SipacButton icon="i-lucide-user-plus" size="lg" @click="showCreate = true">
            Nuevo usuario
          </SipacButton>
        </div>
      </div>
    </section>

    <!-- Bulk action bar -->
    <Transition name="slide-up">
      <section
        v-if="selectedIds.size > 0"
        class="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sipac-200 bg-sipac-50/95 px-5 py-3 shadow-lg backdrop-blur-sm"
      >
        <p class="text-sm font-semibold text-sipac-800">
          {{ selectedIds.size }} usuario{{ selectedIds.size === 1 ? '' : 's' }} seleccionado{{
            selectedIds.size === 1 ? '' : 's'
          }}
        </p>
        <div class="flex gap-2">
          <SipacButton
            size="sm"
            color="success"
            variant="soft"
            @click="requestBulkAction('activate', 'Activar')"
          >
            Activar
          </SipacButton>
          <SipacButton
            size="sm"
            color="error"
            variant="soft"
            @click="requestBulkAction('deactivate', 'Desactivar')"
          >
            Desactivar
          </SipacButton>
          <SipacButton size="sm" color="neutral" variant="ghost" @click="selectedIds.clear()">
            Cancelar
          </SipacButton>
        </div>
      </section>
    </Transition>

    <section class="page-stage-grid page-stage-grid--tight grid gap-4 lg:grid-cols-3">
      <SipacCard interactive>
        <template #header>
          <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">Resultados</p>
        </template>
        <p class="text-3xl font-semibold tabular-nums text-text">{{ resultCount }}</p>
        <p class="mt-2 text-sm text-text-muted">Total asociado a la consulta actual.</p>
      </SipacCard>

      <SipacCard interactive>
        <template #header>
          <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
            Activos globales
          </p>
        </template>
        <p class="text-3xl font-semibold tabular-nums text-text">
          {{ globalStats?.active ?? '—' }}
        </p>
        <p class="mt-2 text-sm text-text-muted">
          De {{ globalStats?.total ?? 0 }} registrados · {{ globalStats?.inactive ?? 0 }} inactivos
        </p>
      </SipacCard>

      <SipacCard interactive>
        <template #header>
          <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
            Administradores
          </p>
        </template>
        <p class="text-3xl font-semibold tabular-nums text-text">
          {{ globalStats?.admins ?? '—' }}
        </p>
        <p class="mt-2 text-sm text-text-muted">
          {{ globalStats?.docentes ?? 0 }} docentes en el sistema.
        </p>
      </SipacCard>
    </section>

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <SipacCard class="page-stage-primary">
        <template #header>
          <div class="flex flex-wrap items-start justify-between gap-4">
            <SipacSectionHeader
              title="Explorar cuentas"
              description="Busca por nombre o correo y aplica filtros."
              size="md"
            />

            <SipacButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-rotate-ccw"
              @click="resetFilters"
            >
              Limpiar filtros
            </SipacButton>
          </div>
        </template>

        <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <UInput
            v-model="search"
            color="neutral"
            variant="outline"
            name="search"
            autocomplete="off"
            placeholder="Buscar por nombre o correo…"
            icon="i-lucide-search"
            class="w-full"
          />
          <USelect
            v-model="roleFilter"
            color="neutral"
            variant="outline"
            :items="roleOptions"
            class="w-full"
          />
          <USelect
            v-model="statusFilter"
            color="neutral"
            variant="outline"
            :items="statusOptions"
            class="w-full"
          />
        </div>

        <div class="mt-5">
          <UTable
            v-if="usersStore.users.length || usersStore.loading"
            :data="usersStore.users"
            :columns="columns"
            :loading="usersStore.loading"
            class="w-full"
          />

          <UEmpty
            v-else
            icon="i-lucide-users-round"
            title="No se encontraron usuarios"
            description="Ajusta la búsqueda o limpia los filtros para volver a cargar resultados."
          />
        </div>

        <template #footer>
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-sm text-text-muted">
              {{ resultCount }} resultado{{ resultCount === 1 ? '' : 's' }} visibles en la vista
              actual.
            </p>

            <div v-if="usersStore.meta" class="flex justify-center sm:justify-end">
              <UPagination
                v-model:page="page"
                :total="usersStore.meta.total"
                :items-per-page="usersStore.meta.limit"
                show-edges
                :sibling-count="1"
              />
            </div>
          </div>
        </template>
      </SipacCard>
    </section>

    <!-- User detail slideover -->
    <USlideover v-model:open="showDetail" title="Detalle de usuario" side="right">
      <template #body>
        <div v-if="detailLoading" class="space-y-4 p-4">
          <div v-for="i in 5" :key="i" class="h-10 rounded-xl skeleton-shimmer bg-surface-muted" />
        </div>
        <div v-else-if="detailData" class="space-y-5 p-4">
          <div class="flex items-center gap-4">
            <span class="avatar-initials size-14 text-lg">{{
              detailData.user.fullName
                ?.split(' ')
                .map((n: string) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()
            }}</span>
            <div>
              <p class="text-lg font-semibold text-text">{{ detailData.user.fullName }}</p>
              <p class="text-sm text-text-muted">{{ detailData.user.email }}</p>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <SipacBadge
              :color="detailData.user.role === 'admin' ? 'warning' : 'primary'"
              variant="subtle"
            >
              {{ detailData.user.role === 'admin' ? 'Admin' : 'Docente' }}
            </SipacBadge>
            <SipacBadge :color="detailData.user.isActive ? 'success' : 'error'" variant="outline">
              {{ detailData.user.isActive ? 'Activo' : 'Inactivo' }}
            </SipacBadge>
            <SipacBadge v-if="detailData.user.twoFactorEnabled" color="primary" variant="subtle">
              2FA Activo
            </SipacBadge>
          </div>

          <div class="space-y-2 rounded-xl border border-border/60 p-4">
            <h4 class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
              Información
            </h4>
            <div class="grid grid-cols-2 gap-y-2 text-sm">
              <span class="text-text-muted">Programa</span>
              <span class="text-text">{{ detailData.user.program || '—' }}</span>
              <span class="text-text-muted">Último login</span>
              <span class="text-text">{{ formatDate(detailData.user.lastLoginAt) }}</span>
              <span class="text-text-muted">Email verificado</span>
              <span class="text-text">{{ detailData.user.emailVerifiedAt ? 'Sí' : 'No' }}</span>
              <span class="text-text-muted">Registrado</span>
              <span class="text-text">{{ formatDate(detailData.user.createdAt) }}</span>
            </div>
          </div>

          <div class="space-y-2 rounded-xl border border-border/60 p-4">
            <h4 class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
              Producción académica
            </h4>
            <div class="grid grid-cols-2 gap-y-2 text-sm">
              <span class="text-text-muted">Confirmados</span>
              <span class="font-semibold text-text">{{ detailData.products.confirmed }}</span>
              <span class="text-text-muted">Borradores</span>
              <span class="text-text">{{ detailData.products.drafts }}</span>
              <span class="text-text-muted">Eliminados</span>
              <span class="text-text">{{ detailData.products.deleted }}</span>
            </div>
          </div>

          <div v-if="detailData.recentActivity.length" class="space-y-2">
            <h4 class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
              Actividad reciente
            </h4>
            <div
              v-for="log in detailData.recentActivity"
              :key="log._id"
              class="rounded-lg border border-border/40 bg-surface-muted/50 px-3 py-2 text-sm"
            >
              <span class="font-medium text-text">{{ log.action }}</span>
              <span class="text-text-muted"> · {{ log.resource }}</span>
              <p v-if="log.details" class="mt-0.5 truncate text-xs text-text-muted">
                {{ log.details }}
              </p>
            </div>
          </div>

          <div class="flex gap-2 pt-2">
            <SipacButton
              icon="i-lucide-pencil"
              variant="soft"
              size="sm"
              @click="
                showDetail = false
                openEdit(detailData!.user)
              "
            >
              Editar
            </SipacButton>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- Bulk confirmation modal -->
    <UModal v-model:open="showBulkConfirm" title="Confirmar acción masiva">
      <template #body>
        <p class="text-sm text-text-muted">
          ¿{{ pendingBulkAction?.label }} {{ selectedIds.size }} usuario{{
            selectedIds.size === 1 ? '' : 's'
          }}? Esta acción se aplicará de inmediato.
        </p>
        <div class="mt-4 flex justify-end gap-2">
          <SipacButton variant="ghost" color="neutral" @click="showBulkConfirm = false"
            >Cancelar</SipacButton
          >
          <SipacButton
            :color="pendingBulkAction?.action === 'deactivate' ? 'error' : 'primary'"
            :loading="bulkSubmitting"
            @click="executeBulkAction"
          >
            {{ pendingBulkAction?.label }}
          </SipacButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showCreate" title="Nuevo usuario">
      <template #body>
        <UForm :schema="createUserSchema" :state="createState" class="space-y-4" @submit="onCreate">
          <UFormField label="Nombre completo" name="fullName" required>
            <UInput
              v-model="createState.fullName"
              color="neutral"
              variant="outline"
              name="fullName"
              autocomplete="name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Correo electrónico" name="email" required>
            <UInput
              v-model="createState.email"
              type="email"
              color="neutral"
              variant="outline"
              name="email"
              autocomplete="email"
              inputmode="email"
              :spellcheck="false"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Contraseña" name="password" required>
            <SipacPasswordInput
              v-model="createState.password"
              color="neutral"
              variant="outline"
              name="password"
              autocomplete="new-password"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Rol" name="role">
            <USelect
              v-model="createState.role"
              color="neutral"
              variant="outline"
              :items="[
                { label: 'Docente', value: 'docente' },
                { label: 'Administrador', value: 'admin' },
              ]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Programa" name="program" hint="Opcional">
            <UInput
              v-model="createState.program"
              color="neutral"
              variant="outline"
              name="program"
              autocomplete="organization-title"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <SipacButton variant="ghost" color="neutral" @click="showCreate = false"
              >Cancelar</SipacButton
            >
            <SipacButton type="submit" :loading="createSubmitting">Crear</SipacButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <UModal v-model:open="showEdit" title="Editar usuario">
      <template #body>
        <UForm :schema="updateUserSchema" :state="editState" class="space-y-4" @submit="onEdit">
          <UFormField label="Nombre completo" name="fullName">
            <UInput
              v-model="editState.fullName"
              color="neutral"
              variant="outline"
              name="fullName"
              autocomplete="name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Rol" name="role">
            <USelect
              v-model="editState.role"
              color="neutral"
              variant="outline"
              :items="[
                { label: 'Docente', value: 'docente' },
                { label: 'Administrador', value: 'admin' },
              ]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Estado" name="isActive">
            <USelect
              v-model="editState.isActive"
              color="neutral"
              variant="outline"
              :items="[
                { label: 'Activo', value: true },
                { label: 'Inactivo', value: false },
              ]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Programa" name="program">
            <UInput
              v-model="editState.program"
              color="neutral"
              variant="outline"
              name="program"
              autocomplete="organization-title"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <SipacButton variant="ghost" color="neutral" @click="showEdit = false"
              >Cancelar</SipacButton
            >
            <SipacButton type="submit" :loading="editSubmitting">Guardar</SipacButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
