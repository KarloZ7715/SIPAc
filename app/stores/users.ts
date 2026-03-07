import type {
  ApiSuccessResponse,
  UserPublic,
  CreateUserDTO,
  UpdateUserDTO,
  PaginationMeta,
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

export const useUsersStore = defineStore('users', () => {
  const users = ref<UserPublic[]>([])
  const meta = ref<PaginationMeta | null>(null)
  const loading = ref(false)

  async function fetchUsers(filters: UsersFilters = {}) {
    loading.value = true
    try {
      const query = new URLSearchParams()
      if (filters.page) query.set('page', String(filters.page))
      if (filters.limit) query.set('limit', String(filters.limit))
      if (filters.role) query.set('role', filters.role)
      if (filters.isActive) query.set('isActive', filters.isActive)
      if (filters.search) query.set('search', filters.search)

      const data = await $fetch<UsersListResponse>(`/api/users?${query.toString()}` as string)
      users.value = data.data
      meta.value = data.meta ?? null
    } finally {
      loading.value = false
    }
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

  return { users, meta, loading, fetchUsers, createUser, updateUser, fetchUser }
})
