<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { UserPublic, CreateUserDTO, UpdateUserDTO } from '~~/app/types'
import { createUserSchema, updateUserSchema } from '~~/server/utils/schemas/user'

definePageMeta({ middleware: ['admin'] })

const ALL_ROLES_FILTER = 'all_roles'
const ALL_STATUS_FILTER = 'all_status'

const usersStore = useUsersStore()
const toast = useToast()

const page = ref(1)
const roleFilter = ref<string>(ALL_ROLES_FILTER)
const statusFilter = ref<string>(ALL_STATUS_FILTER)
const search = ref('')

const showCreate = ref(false)
const showEdit = ref(false)
const editingUser = ref<UserPublic | null>(null)
const createSubmitting = ref(false)
const editSubmitting = ref(false)

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
    id: 'actions',
    header: 'Acciones',
    cell: ({ row }: { row: { original: UserPublic } }) => {
      return h(resolveComponent('SipacButton'), {
        icon: 'i-lucide-pencil',
        variant: 'ghost',
        color: 'neutral',
        size: 'xs',
        'aria-label': 'Editar usuario',
        onClick: () => openEdit(row.original),
      })
    },
  },
]

async function loadUsers() {
  await usersStore.fetchUsers({
    page: page.value,
    role: roleFilter.value === ALL_ROLES_FILTER ? undefined : roleFilter.value,
    isActive: statusFilter.value === ALL_STATUS_FILTER ? undefined : statusFilter.value,
    search: search.value || undefined,
  })
}

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

const filteredActiveUsers = computed(
  () => usersStore.users.filter((candidate) => candidate.isActive).length,
)
const filteredAdmins = computed(
  () => usersStore.users.filter((candidate) => candidate.role === 'admin').length,
)
const resultCount = computed(() => usersStore.meta?.total ?? usersStore.users.length)

watch([page, roleFilter, statusFilter], () => loadUsers())

let searchTimeout: ReturnType<typeof setTimeout>
watch(search, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    page.value = 1
    loadUsers()
  }, 400)
})

onMounted(() => loadUsers())
</script>

<template>
  <div class="space-y-8">
    <section class="panel-surface hero-wash fade-up p-6 sm:p-8">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-4">
          <div class="section-chip">Administración segura</div>
          <SipacSectionHeader
            title="Gestión de usuarios"
            description="Control operativo de cuentas, roles y estado de acceso institucional."
            size="md"
          />
        </div>

        <SipacButton icon="i-lucide-user-plus" size="lg" @click="showCreate = true"
          >Nuevo usuario</SipacButton
        >
      </div>
    </section>

    <section class="grid gap-4 lg:grid-cols-3">
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
            Activos visibles
          </p>
        </template>
        <p class="text-3xl font-semibold tabular-nums text-text">{{ filteredActiveUsers }}</p>
        <p class="mt-2 text-sm text-text-muted">Cuentas activas dentro del conjunto cargado.</p>
      </SipacCard>

      <SipacCard interactive>
        <template #header>
          <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
            Administradores visibles
          </p>
        </template>
        <p class="text-3xl font-semibold tabular-nums text-text">{{ filteredAdmins }}</p>
        <p class="mt-2 text-sm text-text-muted">
          Ayuda a revisar balance y privilegios en pantalla.
        </p>
      </SipacCard>
    </section>

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <SipacCard>
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

      <div class="space-y-6">
        <SipacCard>
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-11 items-center justify-center rounded-2xl bg-earth-50 text-earth-700"
              >
                <UIcon name="i-lucide-shield-check" class="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 class="font-semibold text-text">Buenas prácticas</h3>
                <p class="text-sm text-text-muted">UX y seguridad alineadas</p>
              </div>
            </div>
          </template>

          <div class="space-y-3 text-sm leading-6 text-text-muted">
            <p>
              Las acciones visibles están organizadas para facilitar decisiones rápidas y reducir
              confusiones.
            </p>
            <p>
              La creación y la edición permanecen separadas para mantener una operación más
              ordenada.
            </p>
          </div>
        </SipacCard>
      </div>
    </section>

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
