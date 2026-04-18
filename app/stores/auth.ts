import type {
  ApiSuccessResponse,
  UserPublic,
  LoginDTO,
  CreateUserDTO,
  LoginResponse,
} from '~~/app/types'

type AuthUserResponse = ApiSuccessResponse<{ user: UserPublic }>
type AuthSessionResponse = ApiSuccessResponse<LoginResponse>
type TwoFactorChallengeResponse = ApiSuccessResponse<{
  requires2FA: true
  challengeId: string
  email: string
}>
type VerificationPendingResponse = ApiSuccessResponse<{
  requiresVerification: true
  email: string
}>
type LoginApiResponse =
  | AuthSessionResponse
  | TwoFactorChallengeResponse
  | VerificationPendingResponse

export type LoginOutcome =
  | { kind: 'success'; user: UserPublic }
  | { kind: '2fa'; challengeId: string; email: string }
  | { kind: 'verification'; email: string }

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

  async function login(credentials: LoginDTO): Promise<LoginOutcome> {
    loading.value = true
    try {
      const data = await $fetch<LoginApiResponse>('/api/auth/login' as string, {
        method: 'POST',
        body: credentials,
      })
      const payload = data.data as Record<string, unknown>
      if (payload.requires2FA) {
        return {
          kind: '2fa',
          challengeId: payload.challengeId as string,
          email: payload.email as string,
        }
      }
      if (payload.requiresVerification) {
        return { kind: 'verification', email: payload.email as string }
      }
      user.value = (payload.user as UserPublic) ?? null
      return { kind: 'success', user: user.value! }
    } finally {
      loading.value = false
    }
  }

  async function verify2FA(challengeId: string, code: string): Promise<UserPublic> {
    loading.value = true
    try {
      const data = await $fetch<AuthSessionResponse>('/api/auth/2fa/verify' as string, {
        method: 'POST',
        body: { challengeId, code },
      })
      user.value = data.data.user
      return data.data.user
    } finally {
      loading.value = false
    }
  }

  async function register(payload: CreateUserDTO): Promise<{ email: string }> {
    loading.value = true
    try {
      const data = await $fetch<VerificationPendingResponse>('/api/auth/register' as string, {
        method: 'POST',
        body: payload,
      })
      return { email: data.data.email }
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await $fetch('/api/auth/logout' as string, { method: 'POST' })
    user.value = null
    await navigateTo('/login')
  }

  return {
    user,
    loading,
    isAuthenticated,
    isAdmin,
    setUser,
    fetchUser,
    login,
    verify2FA,
    register,
    logout,
  }
})
