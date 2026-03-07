import type {
  ApiSuccessResponse,
  UserPublic,
  LoginDTO,
  CreateUserDTO,
  LoginResponse,
} from '~~/app/types'

type AuthUserResponse = ApiSuccessResponse<{ user: UserPublic }>
type AuthSessionResponse = ApiSuccessResponse<LoginResponse>

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserPublic | null>(null)
  const loading = ref(false)

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  function setUser(value: UserPublic | null) {
    user.value = value
  }

  async function fetchUser() {
    try {
      const data = await $fetch<AuthUserResponse>('/api/auth/me' as string)
      user.value = data.data.user
    } catch {
      user.value = null
    }
  }

  async function login(credentials: LoginDTO) {
    loading.value = true
    try {
      const data = await $fetch<AuthSessionResponse>('/api/auth/login' as string, {
        method: 'POST',
        body: credentials,
      })
      user.value = data.data.user
    } finally {
      loading.value = false
    }
  }

  async function register(payload: CreateUserDTO) {
    loading.value = true
    try {
      const data = await $fetch<AuthSessionResponse>('/api/auth/register' as string, {
        method: 'POST',
        body: payload,
      })
      user.value = data.data.user
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await $fetch('/api/auth/logout' as string, { method: 'POST' })
    user.value = null
    await navigateTo('/login')
  }

  return { user, loading, isAuthenticated, isAdmin, setUser, fetchUser, login, register, logout }
})
