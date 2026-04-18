export function useAuth() {
  const store = useAuthStore()

  const { user, loading, isAuthenticated, isAdmin } = storeToRefs(store)

  return {
    user,
    loading,
    isAuthenticated,
    isAdmin,
    login: store.login,
    verify2FA: store.verify2FA,
    register: store.register,
    logout: store.logout,
    fetchUser: store.fetchUser,
  }
}
