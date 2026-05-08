import type { UserPublic } from '~~/app/types'

type AuthMeResponse = { data: { user: UserPublic } }

export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore()
  const auth = useAuth()

  if (!auth.isAuthenticated.value) {
    const requestFetch = useRequestFetch() as (url: string) => Promise<AuthMeResponse>
    const { data } = await useAsyncData('auth:me', async (): Promise<AuthMeResponse | null> => {
      try {
        return await requestFetch('/api/auth/me')
      } catch {
        return null
      }
    })
    authStore.setUser(data.value?.data?.user ?? null)
  }

  const publicRoutes = ['/login', '/register', '/verify-email', '/confirm-email-change']

  /** Rutas de solo invitado: si ya hay sesión, ir al panel (no aplicar a flujos tipo confirm-email-change). */
  const guestOnlyRoutes = ['/login', '/register', '/verify-email']

  if (!auth.isAuthenticated.value && !publicRoutes.includes(to.path)) {
    return navigateTo('/login')
  }

  if (auth.isAuthenticated.value && guestOnlyRoutes.includes(to.path)) {
    return navigateTo('/')
  }
})
