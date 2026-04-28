import type {
  ApiSuccessResponse,
  UserPublic,
  CreateUserDTO,
  UpdateUserDTO,
  PaginationMeta,
  AuditLogPublic,
} from '~~/app/types'

type UsersListResponse = ApiSuccessResponse<UserPublic[]>
type UserResponse = ApiSuccessResponse<{ user: UserPublic }>

interface UsersFilters {
  page?: number
  limit?: number
  role?: string
  isActive?: string
  search?: string
}

interface UserStats {
  total: number
  active: number
  inactive: number
  admins: number
  docentes: number
}

interface UserDetail {
  user: UserPublic
  products: { total: number; confirmed: number; drafts: number; deleted: number }
  recentActivity: AuditLogPublic[]
  lastSession: { lastSeenAt: string | null; ipAddress: string | null } | null
}

interface BulkResult {
  matched: number
  modified: number
}

type StoreFetch = <T>(request: string, options?: Parameters<typeof $fetch>[1]) => Promise<T>

export const useUsersStore = defineStore('users', () => {
  const users = ref<UserPublic[]>([])
  const meta = ref<PaginationMeta | null>(null)
  const loading = ref(false)
  const stats = ref<UserStats | null>(null)

  async function fetchUsers(filters: UsersFilters = {}, fetcher: StoreFetch = $fetch) {
    loading.value = true
    try {
      const query = new URLSearchParams()
      if (filters.page) query.set('page', String(filters.page))
      if (filters.limit) query.set('limit', String(filters.limit))
      if (filters.role) query.set('role', filters.role)
      if (filters.isActive) query.set('isActive', filters.isActive)
      if (filters.search) query.set('search', filters.search)

      const data = await fetcher<UsersListResponse>(`/api/users?${query.toString()}` as string)
      users.value = data.data
      meta.value = data.meta ?? null
    } finally {
      loading.value = false
    }
  }

  async function fetchStats() {
    const data = await $fetch<ApiSuccessResponse<UserStats>>('/api/admin/users/stats' as string)
    stats.value = data.data
    return data.data
  }

  async function fetchUserDetail(id: string) {
    const data = await $fetch<ApiSuccessResponse<UserDetail>>(
      `/api/admin/users/${id}/detail` as string,
    )
    return data.data
  }

  async function createUser(payload: CreateUserDTO) {
    const data = await $fetch<UserResponse>('/api/users' as string, {
      method: 'POST',
      body: payload,
    })
    return data.data.user
  }

  async function updateUser(id: string, payload: UpdateUserDTO) {
    const data = await $fetch<UserResponse>(`/api/users/${id}` as string, {
      method: 'PATCH',
      body: payload,
    })
    return data.data.user
  }

  async function fetchUser(id: string) {
    const data = await $fetch<UserResponse>(`/api/users/${id}` as string)
    return data.data.user
  }

  async function bulkUpdate(ids: string[], action: string, role?: string) {
    const data = await $fetch<ApiSuccessResponse<BulkResult>>('/api/admin/users/bulk' as string, {
      method: 'PATCH',
      body: { ids, action, ...(role && { role }) },
    })
    return data.data
  }

  function exportUsersCSV() {
    const headers = ['Nombre', 'Correo', 'Rol', 'Estado', 'Programa', 'Último login', 'Creado']
    const rows = users.value.map((u) => [
      u.fullName,
      u.email,
      u.role === 'admin' ? 'Administrador' : 'Docente',
      u.isActive ? 'Activo' : 'Inactivo',
      u.program || '',
      u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('es-CO') : 'Nunca',
      new Date(u.createdAt).toLocaleString('es-CO'),
    ])

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `usuarios_sipac_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return {
    users,
    meta,
    loading,
    stats,
    fetchUsers,
    fetchStats,
    fetchUserDetail,
    createUser,
    updateUser,
    fetchUser,
    bulkUpdate,
    exportUsersCSV,
  }
})
