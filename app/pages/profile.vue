<script setup lang="ts">
import type {
  ApiSuccessResponse,
  DefaultLandingRoute,
  ProfileActivityItem,
  ProfileSessionItem,
  ProfileSummaryResponse,
} from '~~/app/types'
import type {
  UiDensityPreference,
  UiFontScale,
  UiMotionPreference,
} from '~~/app/composables/use-ui-preferences'
import { updateProfileSchema, changePasswordSchema } from '~~/server/utils/schemas/auth'

const { user, fetchUser, logout } = useAuth()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const requestFetch = import.meta.server ? useRequestFetch() : $fetch

const {
  motionPreference,
  densityPreference,
  fontScalePreference,
  highContrastPreference,
  underlineLinksPreference,
  initUiPreferences,
  setMotionPreference,
  setDensityPreference,
  setFontScalePreference,
  setHighContrastPreference,
  setUnderlineLinksPreference,
} = useUiPreferences()
const { isMobile } = useResponsive()

// ---------------- Tabs ----------------
const TABS = [
  { id: 'overview', label: 'Resumen', icon: 'i-lucide-layout-dashboard' },
  { id: 'account', label: 'Cuenta', icon: 'i-lucide-user-round' },
  { id: 'security', label: 'Seguridad', icon: 'i-lucide-shield-check' },
  { id: 'preferences', label: 'Preferencias', icon: 'i-lucide-sliders-horizontal' },
  { id: 'accessibility', label: 'Accesibilidad', icon: 'i-lucide-accessibility' },
  { id: 'activity', label: 'Actividad', icon: 'i-lucide-activity' },
  { id: 'privacy', label: 'Privacidad', icon: 'i-lucide-lock' },
  { id: 'help', label: 'Ayuda', icon: 'i-lucide-life-buoy' },
] as const

type ProfileTabId = (typeof TABS)[number]['id']

function isProfileTabId(value: unknown): value is ProfileTabId {
  return typeof value === 'string' && TABS.some((tab) => tab.id === value)
}

const activeTab = ref<ProfileTabId>(isProfileTabId(route.query.tab) ? route.query.tab : 'overview')

watch(
  () => route.query.tab,
  (next) => {
    if (isProfileTabId(next) && next !== activeTab.value) {
      activeTab.value = next
    }
  },
)

function changeTab(next: string) {
  if (!isProfileTabId(next)) return
  activeTab.value = next
  router.replace({ query: { ...route.query, tab: next } })
}

// ---------------- Profile summary ----------------
async function loadProfileSummary() {
  const response = await requestFetch<ApiSuccessResponse<ProfileSummaryResponse>>('/api/profile')
  return response.data
}

const {
  data: profileSummary,
  status: profileSummaryStatus,
  refresh: refreshProfileSummary,
} = await useAsyncData('profile-summary', loadProfileSummary, {
  default: () => null,
})

const summaryLoading = computed(
  () => profileSummaryStatus.value === 'pending' && profileSummary.value === null,
)

const memberSinceLabel = computed(() => {
  const createdAt = profileSummary.value?.user.createdAt ?? user.value?.createdAt
  if (!createdAt) return null
  try {
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: 'long',
    }).format(new Date(createdAt))
  } catch {
    return null
  }
})

const lastLoginLabel = computed(() => {
  const lastLogin = profileSummary.value?.user.lastLoginAt
  if (!lastLogin) return 'Primera sesión'
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(lastLogin))
  } catch {
    return lastLogin
  }
})

// ---------------- Account form ----------------
const profileState = reactive({
  firstName: user.value?.firstName ?? '',
  middleName: user.value?.middleName ?? '',
  lastName: user.value?.lastName ?? '',
  secondLastName: user.value?.secondLastName ?? '',
  program: user.value?.program ?? '',
})
const profileSaving = ref(false)

watch(
  () => user.value,
  (val) => {
    if (!val) return
    profileState.firstName = val.firstName ?? ''
    profileState.middleName = val.middleName ?? ''
    profileState.lastName = val.lastName ?? ''
    profileState.secondLastName = val.secondLastName ?? ''
    profileState.program = val.program ?? ''
  },
  { immediate: true },
)

async function onProfileSubmit() {
  profileSaving.value = true
  try {
    await $fetch('/api/profile', { method: 'PATCH', body: profileState })
    await fetchUser()
    await refreshProfileSummary()
    toast.add({ title: 'Perfil actualizado', icon: 'i-lucide-check-circle', color: 'success' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg = err?.data?.data?.error?.message || 'Error al actualizar perfil'
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    profileSaving.value = false
  }
}

// ---------------- Password form ----------------
const passwordState = reactive({ currentPassword: '', newPassword: '' })
const passwordSaving = ref(false)

// ---------------- Change email ----------------
const emailModalOpen = ref(false)
const emailState = reactive({ newEmail: '', password: '' })
const emailSaving = ref(false)

function openChangeEmail() {
  emailState.newEmail = ''
  emailState.password = ''
  emailModalOpen.value = true
}

async function onChangeEmail() {
  if (!emailState.newEmail || !emailState.password) return
  emailSaving.value = true
  try {
    await $fetch('/api/profile/change-email', { method: 'POST', body: emailState })
    toast.add({
      title: 'Revisa tu nuevo correo',
      description: 'Enviamos un enlace de confirmación a la dirección indicada.',
      icon: 'i-lucide-mail-check',
      color: 'success',
    })
    emailModalOpen.value = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg = err?.data?.data?.error?.message || 'No se pudo iniciar el cambio de correo'
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    emailSaving.value = false
  }
}

// ---------------- 2FA ----------------
const twoFactorOpen = ref(false)
const twoFactorMode = ref<'enable' | 'disable'>('enable')
const twoFactorCode = ref('')
const twoFactorPassword = ref('')
const twoFactorSaving = ref(false)
const twoFactorChallengeSent = ref(false)
const twoFactorEnabled = computed(() => !!user.value?.twoFactorEnabled)

async function openEnable2FA() {
  twoFactorMode.value = 'enable'
  twoFactorCode.value = ''
  twoFactorPassword.value = ''
  twoFactorChallengeSent.value = false
  twoFactorOpen.value = true
  twoFactorSaving.value = true
  try {
    await $fetch('/api/profile/2fa/enable', { method: 'POST' })
    twoFactorChallengeSent.value = true
    toast.add({
      title: 'Código enviado',
      description: 'Revisa tu correo para confirmar la activación.',
      icon: 'i-lucide-mail',
      color: 'info',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    twoFactorOpen.value = false
    const msg = err?.data?.data?.error?.message || 'No se pudo enviar el código'
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    twoFactorSaving.value = false
  }
}

async function openDisable2FA() {
  twoFactorMode.value = 'disable'
  twoFactorCode.value = ''
  twoFactorPassword.value = ''
  twoFactorChallengeSent.value = false
  twoFactorOpen.value = true
  twoFactorSaving.value = true
  try {
    await $fetch('/api/profile/2fa/disable', { method: 'POST', body: {} })
    twoFactorChallengeSent.value = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    twoFactorOpen.value = false
    const msg = err?.data?.data?.error?.message || 'No se pudo iniciar la desactivación'
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    twoFactorSaving.value = false
  }
}

async function submit2FA() {
  if (!twoFactorCode.value) return
  twoFactorSaving.value = true
  try {
    if (twoFactorMode.value === 'enable') {
      await $fetch('/api/profile/2fa/confirm', {
        method: 'POST',
        body: { code: twoFactorCode.value },
      })
      toast.add({
        title: '2FA activado',
        description: 'Tu cuenta ahora requiere un código al iniciar sesión.',
        icon: 'i-lucide-shield-check',
        color: 'success',
      })
    } else {
      if (!twoFactorPassword.value) return
      await $fetch('/api/profile/2fa/disable', {
        method: 'POST',
        body: { password: twoFactorPassword.value, code: twoFactorCode.value },
      })
      toast.add({
        title: '2FA desactivado',
        icon: 'i-lucide-shield-off',
        color: 'warning',
      })
    }
    await fetchUser()
    twoFactorOpen.value = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg = err?.data?.data?.error?.message || 'Código inválido'
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    twoFactorSaving.value = false
  }
}

// ---------------- Session revocation ----------------
async function revokeSession(id: string) {
  try {
    await $fetch(`/api/profile/sessions/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Sesión cerrada', icon: 'i-lucide-log-out', color: 'success' })
    await refreshSessions()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg = err?.data?.data?.error?.message || 'No se pudo cerrar la sesión'
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  }
}

async function revokeOtherSessions() {
  try {
    await $fetch('/api/profile/sessions', { method: 'DELETE' })
    toast.add({
      title: 'Otras sesiones cerradas',
      icon: 'i-lucide-log-out',
      color: 'success',
    })
    await refreshSessions()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg = err?.data?.data?.error?.message || 'No se pudieron cerrar las sesiones'
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  }
}

async function revokeAllSessions() {
  try {
    await $fetch('/api/profile/sessions/revoke-all', { method: 'POST' })
    toast.add({ title: 'Sesiones cerradas', icon: 'i-lucide-log-out', color: 'warning' })
    await logout()
    await navigateTo('/login')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg = err?.data?.data?.error?.message || 'No se pudieron cerrar todas las sesiones'
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  }
}

async function onPasswordSubmit() {
  passwordSaving.value = true
  try {
    await $fetch('/api/profile/change-password', { method: 'POST', body: passwordState })
    passwordState.currentPassword = ''
    passwordState.newPassword = ''
    toast.add({ title: 'Contraseña actualizada', icon: 'i-lucide-check-circle', color: 'success' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg = err?.data?.data?.error?.message || 'Error al cambiar contraseña'
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    passwordSaving.value = false
  }
}

// ---------------- Preferences ----------------
const motionOptions: Array<{ label: string; value: UiMotionPreference }> = [
  { label: 'Normal', value: 'normal' },
  { label: 'Reducido', value: 'reduced' },
  { label: 'Mínimo', value: 'minimal' },
]
const densityOptions: Array<{ label: string; value: UiDensityPreference }> = [
  { label: 'Cómoda', value: 'comfortable' },
  { label: 'Compacta', value: 'compact' },
]
const landingOptions: Array<{ label: string; value: DefaultLandingRoute }> = [
  { label: 'Panel de control', value: 'dashboard' },
  { label: 'Asistente IA', value: 'chat' },
  { label: 'Repositorio', value: 'repository' },
  { label: 'Mis documentos', value: 'workspace-documents' },
  { label: 'Perfil', value: 'profile' },
]
const fontScaleOptions: Array<{ label: string; value: UiFontScale }> = [
  { label: 'Pequeña', value: 'sm' },
  { label: 'Normal', value: 'md' },
  { label: 'Grande', value: 'lg' },
]

const selectedMotion = computed({
  get: () => motionPreference.value,
  set: (value: UiMotionPreference) => setMotionPreference(value),
})
const selectedDensity = computed({
  get: () => densityPreference.value,
  set: (value: UiDensityPreference) => setDensityPreference(value),
})
const selectedFontScale = computed({
  get: () => fontScalePreference.value,
  set: (value: UiFontScale) => setFontScalePreference(value),
})
const selectedHighContrast = computed({
  get: () => highContrastPreference.value,
  set: (value: boolean) => setHighContrastPreference(value),
})
const selectedUnderlineLinks = computed({
  get: () => underlineLinksPreference.value,
  set: (value: boolean) => setUnderlineLinksPreference(value),
})

const selectedLanding = ref<DefaultLandingRoute>(
  profileSummary.value?.user.preferences?.defaultLanding ?? 'dashboard',
)
const landingSaving = ref(false)

watch(
  () => profileSummary.value?.user.preferences?.defaultLanding,
  (value) => {
    if (value) selectedLanding.value = value
  },
)

async function onLandingChange(value: DefaultLandingRoute) {
  if (!value || value === selectedLanding.value) return
  const previous = selectedLanding.value
  selectedLanding.value = value
  landingSaving.value = true
  try {
    await $fetch('/api/profile/preferences', {
      method: 'PATCH',
      body: { defaultLanding: value },
    })
    await refreshProfileSummary()
    toast.add({
      title: 'Preferencia guardada',
      description: 'Tu página inicial se actualizó.',
      icon: 'i-lucide-check-circle',
      color: 'success',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    selectedLanding.value = previous
    const msg = err?.data?.data?.error?.message || 'No se pudo actualizar la preferencia'
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    landingSaving.value = false
  }
}

// ---------------- Activity & sessions ----------------
const {
  data: activityData,
  status: activityStatus,
  refresh: refreshActivity,
} = await useAsyncData(
  'profile-activity',
  async () => {
    const response = await requestFetch<ApiSuccessResponse<{ items: ProfileActivityItem[] }>>(
      '/api/profile/activity',
      { query: { limit: 20 } },
    )
    return response.data.items
  },
  { default: () => [] as ProfileActivityItem[] },
)

const {
  data: sessionsData,
  status: sessionsStatus,
  refresh: refreshSessions,
} = await useAsyncData(
  'profile-sessions',
  async () => {
    const response =
      await requestFetch<ApiSuccessResponse<{ items: ProfileSessionItem[] }>>(
        '/api/profile/sessions',
      )
    return response.data.items
  },
  { default: () => [] as ProfileSessionItem[] },
)

const activityLoading = computed(() => activityStatus.value === 'pending')
const sessionsLoading = computed(() => sessionsStatus.value === 'pending')

const relativeFormatter = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto' })

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
  ]
  for (const [unit, ms] of units) {
    if (diff >= ms) {
      return relativeFormatter.format(-Math.round(diff / ms), unit)
    }
  }
  return 'hace instantes'
}

function formatAbsolute(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

const ACTIVITY_LABELS: Record<string, { label: string; icon: string }> = {
  create: { label: 'Creó', icon: 'i-lucide-plus-circle' },
  update: { label: 'Actualizó', icon: 'i-lucide-edit-3' },
  delete: { label: 'Eliminó', icon: 'i-lucide-trash-2' },
  login: { label: 'Inició sesión', icon: 'i-lucide-log-in' },
  login_failed: { label: 'Inicio fallido', icon: 'i-lucide-alert-triangle' },
}

const RESOURCE_LABELS: Record<string, string> = {
  academic_product: 'documento',
  uploaded_file: 'archivo',
  user: 'cuenta',
  session: 'sesión',
  chat_conversation: 'conversación',
}

function activityLabel(item: ProfileActivityItem) {
  const action = ACTIVITY_LABELS[item.action] ?? { label: item.action, icon: 'i-lucide-circle' }
  const resource = RESOURCE_LABELS[item.resource] ?? item.resource
  return { ...action, resource }
}

function describeUserAgent(agent?: string): string {
  if (!agent) return 'Dispositivo desconocido'
  if (/mobile/i.test(agent)) return 'Móvil'
  if (/firefox/i.test(agent)) return 'Firefox'
  if (/edg/i.test(agent)) return 'Edge'
  if (/chrome/i.test(agent)) return 'Chrome'
  if (/safari/i.test(agent)) return 'Safari'
  return 'Navegador'
}

// ---------------- Privacy actions ----------------
const deactivateOpen = ref(false)
const deactivatePassword = ref('')
const deactivateLoading = ref(false)
const exporting = ref(false)

async function downloadExport() {
  exporting.value = true
  try {
    const blob = await $fetch<Blob>('/api/profile/export', {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sipac-perfil-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.add({
      title: 'Descarga lista',
      description: 'Tu archivo de datos se generó correctamente.',
      icon: 'i-lucide-download',
      color: 'success',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg = err?.data?.data?.error?.message || 'No se pudo exportar tus datos'
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    exporting.value = false
  }
}

async function confirmDeactivate() {
  if (!deactivatePassword.value) return
  deactivateLoading.value = true
  try {
    await $fetch('/api/profile/deactivate', {
      method: 'POST',
      body: { currentPassword: deactivatePassword.value },
    })
    deactivateOpen.value = false
    toast.add({
      title: 'Cuenta desactivada',
      description: 'Se cerrará tu sesión.',
      icon: 'i-lucide-log-out',
      color: 'warning',
    })
    await logout()
    await navigateTo('/login')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg = err?.data?.data?.error?.message || 'No se pudo desactivar la cuenta'
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    deactivateLoading.value = false
  }
}

onMounted(() => {
  initUiPreferences()
})
</script>

<template>
  <div class="page-stage-grid page-stage-grid--relaxed space-y-8 sm:space-y-10">
    <!-- Hero editorial -->
    <section
      class="page-stage-hero relative overflow-hidden rounded-3xl border border-border/60 bg-parchment px-4 py-7 shadow-[0_30px_60px_-48px_rgb(20_20_19/0.35)] sm:px-6 sm:py-10 md:px-10 md:py-12"
    >
      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,theme(colors.sipac.100/0.6),transparent_70%)]"
        aria-hidden="true"
      />
      <div
        class="relative flex flex-col gap-6 sm:gap-8 md:flex-row md:items-center md:justify-between"
      >
        <div class="flex flex-col items-start gap-4 sm:flex-row sm:gap-5 md:gap-6">
          <ProfileAvatar
            :name="user?.fullName || 'Usuario'"
            :seed="user?.email || ''"
            :size="isMobile ? 'lg' : 'xl'"
          />
          <div class="min-w-0 space-y-2">
            <p class="text-xs font-semibold tracking-[0.22em] text-text-soft uppercase">
              Cuenta personal · SIPAc
            </p>
            <h1
              class="font-display text-2xl leading-[1.08] font-medium text-text sm:text-3xl md:text-[2.5rem]"
            >
              {{ user?.fullName || 'Mi perfil' }}
            </h1>
            <p class="max-w-lg text-sm leading-[1.65] text-text-muted md:text-base">
              Un espacio editorial para revisar tu cuenta, ajustar preferencias y cuidar lo que
              compartes con SIPAc.
            </p>
            <div class="flex flex-wrap items-center gap-1.5 pt-2 sm:gap-2">
              <SipacBadge color="primary" variant="subtle" size="lg" class="text-xs sm:text-sm">
                <UIcon name="i-lucide-shield-check" class="size-3.5" />
                {{ user?.role === 'admin' ? 'Administrador' : 'Docente' }}
              </SipacBadge>
              <SipacBadge
                color="neutral"
                variant="outline"
                size="lg"
                class="max-w-full text-xs sm:text-sm"
              >
                <span class="truncate">{{ user?.program || 'Universidad de Córdoba' }}</span>
              </SipacBadge>
              <SipacBadge
                color="neutral"
                variant="soft"
                size="lg"
                class="max-w-full text-xs sm:text-sm"
              >
                <UIcon name="i-lucide-mail" class="size-3.5" />
                <span class="max-w-[12.5rem] truncate sm:max-w-[17rem]">{{ user?.email }}</span>
              </SipacBadge>
            </div>
          </div>
        </div>

        <aside
          class="grid w-full grid-cols-1 gap-3 rounded-2xl border border-border/50 bg-white/70 p-4 backdrop-blur-sm sm:grid-cols-2 md:max-w-[22rem] md:grid-cols-1"
        >
          <div>
            <p class="text-[11px] font-semibold tracking-[0.14em] text-text-soft uppercase">
              Miembro desde
            </p>
            <p class="mt-1 text-sm font-semibold text-text">
              {{ memberSinceLabel || '—' }}
            </p>
          </div>
          <div>
            <p class="text-[11px] font-semibold tracking-[0.14em] text-text-soft uppercase">
              Última sesión
            </p>
            <p class="mt-1 text-sm font-semibold text-text">
              {{ lastLoginLabel }}
            </p>
          </div>
          <div>
            <p class="text-[11px] font-semibold tracking-[0.14em] text-text-soft uppercase">
              Documentos
            </p>
            <p class="mt-1 text-sm font-semibold text-text">
              {{ profileSummary?.totalOwnProducts ?? 0 }} confirmados
            </p>
          </div>
        </aside>
      </div>
    </section>

    <!-- Tabs -->
    <ProfileTabsNav :tabs="[...TABS]" :model-value="activeTab" @update:model-value="changeTab" />

    <!-- Panels -->
    <!-- Overview -->
    <section
      v-show="activeTab === 'overview'"
      id="profile-panel-overview"
      role="tabpanel"
      aria-labelledby="Resumen"
      class="page-stage-primary space-y-6"
    >
      <ProfileChapterHeading
        chapter="Capítulo 01 · Resumen"
        title="Una mirada general a tu cuenta"
        description="Un vistazo rápido a tu producción académica, tu actividad reciente y los accesos directos para trabajar más cómodo."
      />

      <div class="grid gap-3 sm:gap-5 lg:grid-cols-3">
        <ExperienceStatCard
          label="Documentos confirmados"
          :value="profileSummary?.totalOwnProducts ?? 0"
          icon="i-lucide-file-check"
          caption="total en repositorio"
        />
        <ExperienceStatCard
          label="Borradores activos"
          :value="profileSummary?.latestDrafts.length ?? 0"
          icon="i-lucide-file-pen-line"
          tone="earth"
          caption="en revisión"
        />
        <ExperienceStatCard
          label="Eventos recientes"
          :value="activityData.length"
          icon="i-lucide-activity"
          tone="earth"
          caption="últimas acciones"
        />
      </div>

      <SipacCard class="card-glow">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 items-center justify-center rounded-xl bg-earth-50 text-earth-700"
              >
                <UIcon name="i-lucide-bar-chart-3" class="size-5" />
              </span>
              <div>
                <h3 class="font-display text-lg font-medium text-text">Producción por tipo</h3>
                <p class="text-sm text-text-muted">
                  Cómo se distribuyen tus documentos confirmados
                </p>
              </div>
            </div>
          </div>
        </template>

        <div v-if="summaryLoading" class="grid gap-3 sm:grid-cols-2">
          <div class="skeleton-shimmer h-24 rounded-xl" />
          <div class="skeleton-shimmer h-24 rounded-xl" />
        </div>

        <div
          v-else-if="profileSummary?.productSummaryByType.length"
          class="grid gap-2 sm:grid-cols-2"
        >
          <div
            v-for="item in profileSummary.productSummaryByType"
            :key="item.productType"
            class="interactive-card flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-white/92 px-3 py-2 shadow-[0_4px_24px_rgb(0_0_0/0.04)]"
          >
            <p class="text-sm text-text-muted">{{ item.productType }}</p>
            <SipacBadge color="primary" variant="subtle">{{ item.total }}</SipacBadge>
          </div>
        </div>

        <ExperienceEmptyState
          v-else
          icon="i-lucide-folder-open"
          title="Sin documentos aún"
          description="Cuando guardes documentos, aparecerá aquí un resumen por tipo."
          compact
        />
      </SipacCard>

      <SipacCard class="card-glow">
        <template #header>
          <div class="flex items-center gap-3">
            <span
              class="flex size-10 items-center justify-center rounded-xl bg-sipac-50 text-sipac-700"
            >
              <UIcon name="i-lucide-zap" class="size-5" />
            </span>
            <div>
              <h3 class="font-display text-lg font-medium text-text">Accesos rápidos</h3>
              <p class="text-sm text-text-muted">Continúa tu trabajo desde aquí</p>
            </div>
          </div>
        </template>
        <div class="grid gap-3 sm:grid-cols-2">
          <SipacQuickAction
            to="/workspace-documents"
            icon="i-lucide-upload"
            label="Subir un documento"
            caption="Inicia un nuevo análisis OCR/NER"
            emphasis="quick"
          />
          <SipacQuickAction
            to="/repository"
            icon="i-lucide-library"
            label="Ir al repositorio"
            caption="Revisa y filtra tu producción"
            emphasis="quick"
          />
          <SipacQuickAction
            to="/chat"
            icon="i-lucide-sparkles"
            label="Asistente IA"
            caption="Consulta documentos con lenguaje natural"
            emphasis="quick"
          />
          <SipacQuickAction
            to="/dashboard"
            icon="i-lucide-layout-dashboard"
            label="Panel de control"
            caption="Métricas y alertas de calidad"
            emphasis="quick"
          />
        </div>
      </SipacCard>
    </section>

    <!-- Account -->
    <section
      v-show="activeTab === 'account'"
      id="profile-panel-account"
      role="tabpanel"
      class="page-stage-primary space-y-6"
    >
      <ProfileChapterHeading
        chapter="Capítulo 02 · Cuenta"
        title="Tus datos esenciales"
        description="El nombre que aparece en tus documentos y recursos del sistema. El correo y el rol solo pueden cambiarlos administradores."
      />

      <div class="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
        <SipacCard class="card-glow">
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 items-center justify-center rounded-xl bg-sipac-50 text-sipac-700"
              >
                <UIcon name="i-lucide-pencil" class="size-5" />
              </span>
              <div>
                <h3 class="font-display text-lg font-medium text-text">Editar nombre</h3>
                <p class="text-sm text-text-muted">Así aparecerás en SIPAc</p>
              </div>
            </div>
          </template>

          <UForm
            :schema="updateProfileSchema"
            :state="profileState"
            class="space-y-4"
            @submit="onProfileSubmit"
          >
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Primer nombre" name="firstName" required>
                <UInput
                  v-model="profileState.firstName"
                  color="neutral"
                  variant="outline"
                  name="firstName"
                  autocomplete="given-name"
                  icon="i-lucide-user"
                  placeholder="Ej. María"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Segundo nombre" name="middleName">
                <UInput
                  v-model="profileState.middleName"
                  color="neutral"
                  variant="outline"
                  name="middleName"
                  autocomplete="additional-name"
                  placeholder="Opcional"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Primer apellido" name="lastName" required>
                <UInput
                  v-model="profileState.lastName"
                  color="neutral"
                  variant="outline"
                  name="lastName"
                  autocomplete="family-name"
                  placeholder="Ej. Pérez"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Segundo apellido" name="secondLastName">
                <UInput
                  v-model="profileState.secondLastName"
                  color="neutral"
                  variant="outline"
                  name="secondLastName"
                  autocomplete="family-name"
                  placeholder="Opcional"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UFormField label="Programa" name="program">
              <UInput
                v-model="profileState.program"
                color="neutral"
                variant="outline"
                name="program"
                placeholder="Ej. Ingeniería de Sistemas"
                class="w-full"
              />
            </UFormField>

            <SipacButton type="submit" icon="i-lucide-save" :loading="profileSaving">
              Guardar cambios
            </SipacButton>
          </UForm>
        </SipacCard>

        <SipacCard variant="outline">
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 items-center justify-center rounded-xl bg-earth-50 text-earth-700"
              >
                <UIcon name="i-lucide-id-card" class="size-5" />
              </span>
              <div>
                <h3 class="font-display text-lg font-medium text-text">Datos registrados</h3>
                <p class="text-sm text-text-muted">Información verificada por tu institución</p>
              </div>
            </div>
          </template>

          <dl class="space-y-3">
            <div class="rounded-xl border border-border/60 bg-surface-muted/40 p-3">
              <dt class="text-xs font-semibold tracking-[0.12em] text-text-soft uppercase">
                Correo institucional
              </dt>
              <dd class="mt-1 truncate font-medium text-text">{{ user?.email }}</dd>
            </div>
            <div class="rounded-xl border border-border/60 bg-surface-muted/40 p-3">
              <dt class="text-xs font-semibold tracking-[0.12em] text-text-soft uppercase">Rol</dt>
              <dd class="mt-1 font-medium text-text">
                {{ user?.role === 'admin' ? 'Administrador' : 'Docente' }}
              </dd>
            </div>
            <div class="rounded-xl border border-border/60 bg-surface-muted/40 p-3">
              <dt class="text-xs font-semibold tracking-[0.12em] text-text-soft uppercase">
                Programa
              </dt>
              <dd class="mt-1 font-medium text-text">
                {{ user?.program || 'No asignado' }}
              </dd>
            </div>
          </dl>

          <template #footer>
            <div class="space-y-3">
              <SipacButton
                color="neutral"
                variant="soft"
                icon="i-lucide-mail-plus"
                block
                @click="openChangeEmail"
              >
                Cambiar correo electrónico
              </SipacButton>
              <div class="flex items-start gap-2 rounded-xl bg-surface-muted/50 p-3">
                <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0 text-text-soft" />
                <p class="text-xs text-text-muted">
                  Enviaremos un enlace al nuevo correo para confirmarlo. El rol solo puede cambiarlo
                  un administrador.
                </p>
              </div>
            </div>
          </template>
        </SipacCard>
      </div>

      <!-- Change email modal -->
      <UModal v-model:open="emailModalOpen" title="Cambiar correo electrónico">
        <template #body>
          <form class="space-y-4" @submit.prevent="onChangeEmail">
            <p class="text-sm text-text-muted">
              Te enviaremos un enlace de confirmación al nuevo correo. Tu correo actual seguirá
              siendo válido hasta que confirmes el cambio.
            </p>
            <UFormField label="Nuevo correo" name="newEmail" required>
              <UInput
                v-model="emailState.newEmail"
                type="email"
                color="neutral"
                variant="outline"
                autocomplete="email"
                icon="i-lucide-mail"
                placeholder="nuevo@correo.edu.co"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Contraseña actual" name="password" required>
              <SipacPasswordInput
                v-model="emailState.password"
                color="neutral"
                variant="outline"
                autocomplete="current-password"
                icon="i-lucide-lock"
                placeholder="Tu contraseña actual"
                class="w-full"
              />
            </UFormField>
            <div class="flex justify-end gap-2">
              <SipacButton
                type="button"
                color="neutral"
                variant="ghost"
                @click="emailModalOpen = false"
                >Cancelar</SipacButton
              >
              <SipacButton type="submit" :loading="emailSaving">Enviar enlace</SipacButton>
            </div>
          </form>
        </template>
      </UModal>
    </section>

    <!-- Security -->
    <section
      v-show="activeTab === 'security'"
      id="profile-panel-security"
      role="tabpanel"
      class="page-stage-primary space-y-6"
    >
      <ProfileChapterHeading
        chapter="Capítulo 03 · Seguridad"
        title="Cuida tu acceso"
        description="Actualiza tu contraseña y revisa desde qué dispositivos has iniciado sesión recientemente."
      />

      <div class="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(20rem,1fr)]">
        <SipacCard class="card-glow">
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 items-center justify-center rounded-xl bg-earth-50 text-earth-700"
              >
                <UIcon name="i-lucide-key-round" class="size-5" />
              </span>
              <div>
                <h3 class="font-display text-lg font-medium text-text">Cambiar contraseña</h3>
                <p class="text-sm text-text-muted">Usa al menos 8 caracteres y combínalos</p>
              </div>
            </div>
          </template>

          <UForm
            :schema="changePasswordSchema"
            :state="passwordState"
            class="space-y-4"
            @submit="onPasswordSubmit"
          >
            <UFormField label="Contraseña actual" name="currentPassword" required>
              <SipacPasswordInput
                v-model="passwordState.currentPassword"
                color="neutral"
                variant="outline"
                name="currentPassword"
                autocomplete="current-password"
                icon="i-lucide-lock"
                placeholder="Tu contraseña actual"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Nueva contraseña" name="newPassword" required>
              <SipacPasswordInput
                v-model="passwordState.newPassword"
                color="neutral"
                variant="outline"
                name="newPassword"
                autocomplete="new-password"
                icon="i-lucide-shield"
                placeholder="Tu nueva contraseña"
                class="w-full"
              />
            </UFormField>

            <SipacButton
              type="submit"
              color="neutral"
              variant="soft"
              icon="i-lucide-key-round"
              :loading="passwordSaving"
            >
              Actualizar contraseña
            </SipacButton>
          </UForm>
        </SipacCard>

        <SipacCard class="card-glow">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <span
                  class="flex size-10 items-center justify-center rounded-xl bg-sipac-50 text-sipac-700"
                >
                  <UIcon name="i-lucide-monitor-smartphone" class="size-5" />
                </span>
                <div>
                  <h3 class="font-display text-lg font-medium text-text">Sesiones recientes</h3>
                  <p class="text-sm text-text-muted">
                    Derivadas de tu historial de inicio de sesión
                  </p>
                </div>
              </div>
              <SipacButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-refresh-cw"
                size="sm"
                :loading="sessionsLoading"
                @click="refreshSessions"
              >
                Actualizar
              </SipacButton>
            </div>
          </template>

          <div v-if="sessionsLoading && sessionsData.length === 0" class="space-y-2">
            <div class="skeleton-shimmer h-14 rounded-xl" />
            <div class="skeleton-shimmer h-14 rounded-xl" />
            <div class="skeleton-shimmer h-14 rounded-xl" />
          </div>

          <ul v-else-if="sessionsData.length" class="space-y-2">
            <li
              v-for="session in sessionsData"
              :key="session._id"
              class="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-white/80 px-3 py-2.5"
              :class="session.isCurrent ? 'border-sipac-300/70 bg-sipac-50/70' : ''"
            >
              <div class="flex items-start gap-3">
                <span
                  class="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-sipac-100 text-sipac-700"
                >
                  <UIcon name="i-lucide-log-in" class="size-4" />
                </span>
                <div>
                  <p class="text-sm font-semibold text-text">
                    {{ describeUserAgent(session.userAgent) }}
                    <SipacBadge
                      v-if="session.isCurrent"
                      color="primary"
                      variant="subtle"
                      size="sm"
                      class="ml-1"
                    >
                      Actual
                    </SipacBadge>
                  </p>
                  <p class="text-xs text-text-muted">
                    {{ session.ipAddress }} · {{ formatRelative(session.createdAt) }}
                  </p>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <p class="hidden text-xs text-text-soft sm:block">
                  {{ formatAbsolute(session.createdAt) }}
                </p>
                <SipacButton
                  v-if="!session.isCurrent"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-log-out"
                  aria-label="Cerrar esta sesión"
                  @click="revokeSession(session._id)"
                >
                  Cerrar
                </SipacButton>
              </div>
            </li>
          </ul>

          <ExperienceEmptyState
            v-else
            icon="i-lucide-shield-off"
            title="Sin sesiones registradas"
            description="Cuando inicies sesión aparecerán aquí los últimos accesos."
            compact
          />

          <template #footer>
            <div class="flex flex-wrap gap-2">
              <SipacButton
                color="neutral"
                variant="soft"
                size="sm"
                icon="i-lucide-log-out"
                :disabled="sessionsData.length < 2"
                @click="revokeOtherSessions"
              >
                Cerrar otras sesiones
              </SipacButton>
              <SipacButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-alert-triangle"
                @click="revokeAllSessions"
              >
                Cerrar absolutamente todas
              </SipacButton>
            </div>
          </template>
        </SipacCard>
      </div>

      <!-- 2FA card -->
      <SipacCard class="card-glow">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 items-center justify-center rounded-xl bg-sipac-50 text-sipac-700"
              >
                <UIcon name="i-lucide-shield-check" class="size-5" />
              </span>
              <div>
                <h3 class="font-display text-lg font-medium text-text">
                  Verificación en dos pasos
                </h3>
                <p class="text-sm text-text-muted">
                  Enviamos un código de 6 dígitos al correo cada vez que inicias sesión.
                </p>
              </div>
            </div>
            <SipacBadge
              :color="twoFactorEnabled ? 'primary' : 'neutral'"
              :variant="twoFactorEnabled ? 'subtle' : 'outline'"
            >
              {{ twoFactorEnabled ? 'Activada' : 'Desactivada' }}
            </SipacBadge>
          </div>
        </template>

        <p class="text-sm leading-[1.7] text-text-muted">
          Añade una capa extra de seguridad. Cuando actives esta opción, necesitarás ingresar un
          código enviado a tu correo para completar el inicio de sesión.
        </p>

        <template #footer>
          <SipacButton v-if="!twoFactorEnabled" icon="i-lucide-shield-plus" @click="openEnable2FA">
            Activar 2FA
          </SipacButton>
          <SipacButton
            v-else
            color="neutral"
            variant="soft"
            icon="i-lucide-shield-off"
            @click="openDisable2FA"
          >
            Desactivar 2FA
          </SipacButton>
        </template>
      </SipacCard>

      <UModal
        v-model:open="twoFactorOpen"
        :title="twoFactorMode === 'enable' ? 'Activar 2FA' : 'Desactivar 2FA'"
      >
        <template #body>
          <form class="space-y-4" @submit.prevent="submit2FA">
            <p class="text-sm text-text-muted">
              <template v-if="twoFactorMode === 'enable'">
                Ingresa el código de 6 dígitos que enviamos a tu correo para confirmar la
                activación.
              </template>
              <template v-else>
                Por seguridad, necesitamos tu contraseña y un código de confirmación que enviamos a
                tu correo.
              </template>
            </p>

            <UFormField
              v-if="twoFactorMode === 'disable'"
              label="Contraseña actual"
              name="password"
              required
            >
              <SipacPasswordInput
                v-model="twoFactorPassword"
                color="neutral"
                variant="outline"
                autocomplete="current-password"
                icon="i-lucide-lock"
                placeholder="Tu contraseña actual"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Código" name="code" required>
              <UInput
                v-model="twoFactorCode"
                color="neutral"
                variant="outline"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
                pattern="[0-9]{6}"
                placeholder="••••••"
                icon="i-lucide-key-round"
                class="w-full"
                :disabled="!twoFactorChallengeSent"
              />
            </UFormField>

            <div class="flex justify-end gap-2">
              <SipacButton
                type="button"
                color="neutral"
                variant="ghost"
                @click="twoFactorOpen = false"
                >Cancelar</SipacButton
              >
              <SipacButton
                type="submit"
                :loading="twoFactorSaving"
                :disabled="!twoFactorChallengeSent || twoFactorCode.length !== 6"
              >
                {{
                  twoFactorMode === 'enable' ? 'Confirmar activación' : 'Confirmar desactivación'
                }}
              </SipacButton>
            </div>
          </form>
        </template>
      </UModal>
    </section>

    <!-- Preferences -->
    <section
      v-show="activeTab === 'preferences'"
      id="profile-panel-preferences"
      role="tabpanel"
      class="page-stage-primary space-y-6"
    >
      <ProfileChapterHeading
        chapter="Capítulo 04 · Preferencias"
        title="Ajusta SIPAc a tu ritmo"
        description="Define movimiento, densidad y la página inicial que ves al iniciar sesión."
      />

      <div class="grid gap-6 md:grid-cols-2">
        <SipacCard class="card-glow">
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 items-center justify-center rounded-xl bg-sipac-50 text-sipac-700"
              >
                <UIcon name="i-lucide-wand-sparkles" class="size-5" />
              </span>
              <div>
                <h3 class="font-display text-lg font-medium text-text">Movimiento y densidad</h3>
                <p class="text-sm text-text-muted">Se guardan en tu navegador</p>
              </div>
            </div>
          </template>

          <div class="space-y-4">
            <UFormField
              label="Movimiento"
              name="profile-motion-preference"
              description="Controla cuánto movimiento visual usa la interfaz."
            >
              <USelect
                v-model="selectedMotion"
                color="neutral"
                variant="outline"
                :items="motionOptions"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="Densidad"
              name="profile-density-preference"
              description="Compacta reduce espacios para mostrar más contenido por pantalla."
            >
              <USelect
                v-model="selectedDensity"
                color="neutral"
                variant="outline"
                :items="densityOptions"
                class="w-full"
              />
            </UFormField>
          </div>
        </SipacCard>

        <SipacCard class="card-glow">
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 items-center justify-center rounded-xl bg-earth-50 text-earth-700"
              >
                <UIcon name="i-lucide-door-open" class="size-5" />
              </span>
              <div>
                <h3 class="font-display text-lg font-medium text-text">Página inicial</h3>
                <p class="text-sm text-text-muted">Dónde empezarás cada vez que inicies sesión</p>
              </div>
            </div>
          </template>

          <UFormField
            label="Abrir al ingresar"
            name="profile-default-landing"
            description="Se guarda en tu cuenta y se aplica en todos tus dispositivos."
          >
            <USelect
              :model-value="selectedLanding"
              color="neutral"
              variant="outline"
              :items="landingOptions"
              :disabled="landingSaving"
              class="w-full"
              @update:model-value="(value) => onLandingChange(value as DefaultLandingRoute)"
            />
          </UFormField>

          <template #footer>
            <p class="text-xs text-text-soft">
              <UIcon name="i-lucide-info" class="mr-1 size-3.5 align-[-2px]" />
              Al iniciar sesión, SIPAc te llevará directamente a esta sección.
            </p>
          </template>
        </SipacCard>
      </div>
    </section>

    <!-- Accessibility -->
    <section
      v-show="activeTab === 'accessibility'"
      id="profile-panel-accessibility"
      role="tabpanel"
      class="page-stage-primary space-y-6"
    >
      <ProfileChapterHeading
        chapter="Capítulo 05 · Accesibilidad"
        title="Léelo a tu manera"
        description="Ajustes pensados para leer, navegar e interactuar con mayor comodidad. Se guardan en tu navegador."
      />

      <div class="grid gap-6 md:grid-cols-2">
        <SipacCard class="card-glow">
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 items-center justify-center rounded-xl bg-sipac-50 text-sipac-700"
              >
                <UIcon name="i-lucide-type" class="size-5" />
              </span>
              <div>
                <h3 class="font-display text-lg font-medium text-text">Tamaño de texto</h3>
                <p class="text-sm text-text-muted">Afecta a toda la interfaz</p>
              </div>
            </div>
          </template>

          <UFormField label="Escala" name="profile-font-scale">
            <USelect
              v-model="selectedFontScale"
              color="neutral"
              variant="outline"
              :items="fontScaleOptions"
              class="w-full"
            />
          </UFormField>

          <div class="mt-4 rounded-xl border border-border/60 bg-white/80 p-4">
            <p class="text-sm text-text-muted">Vista previa</p>
            <p class="mt-1 font-display text-lg leading-relaxed text-text">
              La lectura pausada revela detalles que otras velocidades ocultan.
            </p>
          </div>
        </SipacCard>

        <SipacCard class="card-glow">
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 items-center justify-center rounded-xl bg-earth-50 text-earth-700"
              >
                <UIcon name="i-lucide-contrast" class="size-5" />
              </span>
              <div>
                <h3 class="font-display text-lg font-medium text-text">Contraste y enlaces</h3>
                <p class="text-sm text-text-muted">Mejora la legibilidad</p>
              </div>
            </div>
          </template>

          <div class="space-y-4">
            <label
              class="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-white/70 px-3 py-2"
            >
              <span>
                <span class="block text-sm font-semibold text-text">Alto contraste</span>
                <span class="block text-xs text-text-muted">
                  Bordes más definidos y colores más firmes.
                </span>
              </span>
              <USwitch v-model="selectedHighContrast" color="primary" />
            </label>

            <label
              class="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-white/70 px-3 py-2"
            >
              <span>
                <span class="block text-sm font-semibold text-text">Subrayar enlaces</span>
                <span class="block text-xs text-text-muted">
                  Útil si tienes baja visión o lees con mucho texto.
                </span>
              </span>
              <USwitch v-model="selectedUnderlineLinks" color="primary" />
            </label>
          </div>
        </SipacCard>
      </div>
    </section>

    <!-- Activity -->
    <section
      v-show="activeTab === 'activity'"
      id="profile-panel-activity"
      role="tabpanel"
      class="page-stage-primary space-y-6"
    >
      <ProfileChapterHeading
        chapter="Capítulo 06 · Actividad"
        title="Tu historial reciente"
        description="Registros de auditoría generados por tus acciones en SIPAc. Visibles solo para ti."
      />

      <SipacCard class="card-glow">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 items-center justify-center rounded-xl bg-earth-50 text-earth-700"
              >
                <UIcon name="i-lucide-activity" class="size-5" />
              </span>
              <div>
                <h3 class="font-display text-lg font-medium text-text">Últimos eventos</h3>
                <p class="text-sm text-text-muted">{{ activityData.length }} registros guardados</p>
              </div>
            </div>
            <SipacButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-refresh-cw"
              size="sm"
              :loading="activityLoading"
              @click="refreshActivity"
            >
              Actualizar
            </SipacButton>
          </div>
        </template>

        <div v-if="activityLoading && activityData.length === 0" class="space-y-2">
          <div class="skeleton-shimmer h-14 rounded-xl" />
          <div class="skeleton-shimmer h-14 rounded-xl" />
          <div class="skeleton-shimmer h-14 rounded-xl" />
        </div>

        <ol
          v-else-if="activityData.length"
          class="relative ml-3 space-y-4 border-l border-border/60 pl-5"
        >
          <li v-for="item in activityData" :key="item._id" class="relative">
            <span
              class="absolute -left-[10px] top-1 flex size-4 items-center justify-center rounded-full border-2 border-parchment bg-sipac-600"
              aria-hidden="true"
            />
            <div class="flex flex-wrap items-baseline gap-2">
              <UIcon :name="activityLabel(item).icon" class="size-4 text-text-soft" />
              <p class="text-sm text-text">
                <span class="font-semibold">{{ activityLabel(item).label }}</span>
                <span class="text-text-muted"> un(a) {{ activityLabel(item).resource }}</span>
              </p>
              <span class="text-xs text-text-soft">· {{ formatRelative(item.createdAt) }}</span>
            </div>
            <p v-if="item.details" class="mt-1 text-xs text-text-muted">{{ item.details }}</p>
          </li>
        </ol>

        <ExperienceEmptyState
          v-else
          icon="i-lucide-history"
          title="Sin actividad reciente"
          description="Cuando trabajes en SIPAc aparecerán aquí tus movimientos."
          compact
        />
      </SipacCard>
    </section>

    <!-- Privacy -->
    <section
      v-show="activeTab === 'privacy'"
      id="profile-panel-privacy"
      role="tabpanel"
      class="page-stage-primary space-y-6"
    >
      <ProfileChapterHeading
        chapter="Capítulo 07 · Privacidad"
        title="Transparencia y control"
        description="Exporta tus datos personales o desactiva tu cuenta si ya no quieres usar SIPAc."
      />

      <div class="grid gap-6 md:grid-cols-2">
        <SipacCard class="card-glow">
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 items-center justify-center rounded-xl bg-sipac-50 text-sipac-700"
              >
                <UIcon name="i-lucide-download" class="size-5" />
              </span>
              <div>
                <h3 class="font-display text-lg font-medium text-text">Exportar mis datos</h3>
                <p class="text-sm text-text-muted">Un archivo JSON con tu perfil y actividad</p>
              </div>
            </div>
          </template>

          <p class="text-sm leading-[1.7] text-text-muted">
            Recibirás un archivo con la información que SIPAc guarda sobre ti: datos de cuenta,
            documentos que has subido (hasta 500) y los últimos eventos de auditoría.
          </p>

          <template #footer>
            <SipacButton icon="i-lucide-download" :loading="exporting" @click="downloadExport">
              Descargar archivo JSON
            </SipacButton>
          </template>
        </SipacCard>

        <SipacCard class="card-glow">
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 items-center justify-center rounded-xl bg-red-50 text-red-700"
              >
                <UIcon name="i-lucide-user-x" class="size-5" />
              </span>
              <div>
                <h3 class="font-display text-lg font-medium text-text">Desactivar cuenta</h3>
                <p class="text-sm text-text-muted">Revertible por un administrador</p>
              </div>
            </div>
          </template>

          <p class="text-sm leading-[1.7] text-text-muted">
            Tu cuenta quedará inactiva y no podrás iniciar sesión hasta que un administrador la
            reactive. Tus documentos se conservan.
          </p>

          <template #footer>
            <SipacButton
              color="error"
              variant="soft"
              icon="i-lucide-user-x"
              @click="deactivateOpen = true"
            >
              Desactivar mi cuenta
            </SipacButton>
          </template>
        </SipacCard>
      </div>

      <UModal v-model:open="deactivateOpen" title="Confirmar desactivación">
        <template #body>
          <div class="space-y-4">
            <p class="text-sm text-text-muted">
              Para confirmar, ingresa tu contraseña actual. Tu sesión se cerrará inmediatamente.
            </p>
            <UFormField label="Contraseña actual" name="deactivate-password" required>
              <SipacPasswordInput
                v-model="deactivatePassword"
                color="neutral"
                variant="outline"
                autocomplete="current-password"
                placeholder="Tu contraseña"
                class="w-full"
              />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <SipacButton color="neutral" variant="ghost" @click="deactivateOpen = false">
              Cancelar
            </SipacButton>
            <SipacButton
              color="error"
              :loading="deactivateLoading"
              :disabled="!deactivatePassword"
              icon="i-lucide-user-x"
              @click="confirmDeactivate"
            >
              Desactivar ahora
            </SipacButton>
          </div>
        </template>
      </UModal>
    </section>

    <!-- Help -->
    <section
      v-show="activeTab === 'help'"
      id="profile-panel-help"
      role="tabpanel"
      class="page-stage-primary space-y-6"
    >
      <ProfileChapterHeading
        chapter="Capítulo 08 · Ayuda"
        title="Recursos y soporte"
        description="Atajos para resolver dudas rápidas o escribir al equipo SIPAc."
      />

      <div class="grid gap-5 md:grid-cols-2">
        <SipacCard class="card-glow">
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 items-center justify-center rounded-xl bg-sipac-50 text-sipac-700"
              >
                <UIcon name="i-lucide-book-open" class="size-5" />
              </span>
              <div>
                <h3 class="font-display text-lg font-medium text-text">Guías rápidas</h3>
                <p class="text-sm text-text-muted">Aprende a sacarle el máximo a SIPAc</p>
              </div>
            </div>
          </template>

          <ul class="space-y-2 text-sm">
            <li>
              <NuxtLink
                to="/help/upload"
                class="group flex items-center gap-2 rounded-lg px-1 py-1 text-text-muted transition hover:bg-surface-muted hover:text-sipac-700"
              >
                <UIcon name="i-lucide-upload" class="size-4" />
                <span>Cómo subir y analizar documentos</span>
                <UIcon
                  name="i-lucide-arrow-right"
                  class="ml-auto size-3.5 opacity-0 transition group-hover:opacity-100"
                />
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/help/repository"
                class="group flex items-center gap-2 rounded-lg px-1 py-1 text-text-muted transition hover:bg-surface-muted hover:text-sipac-700"
              >
                <UIcon name="i-lucide-library" class="size-4" />
                <span>Cómo organizar tu repositorio</span>
                <UIcon
                  name="i-lucide-arrow-right"
                  class="ml-auto size-3.5 opacity-0 transition group-hover:opacity-100"
                />
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/help/assistant"
                class="group flex items-center gap-2 rounded-lg px-1 py-1 text-text-muted transition hover:bg-surface-muted hover:text-sipac-700"
              >
                <UIcon name="i-lucide-sparkles" class="size-4" />
                <span>Cómo preguntarle al asistente IA</span>
                <UIcon
                  name="i-lucide-arrow-right"
                  class="ml-auto size-3.5 opacity-0 transition group-hover:opacity-100"
                />
              </NuxtLink>
            </li>
          </ul>

          <template #footer>
            <NuxtLink
              to="/help"
              class="inline-flex items-center gap-1.5 text-xs font-medium text-sipac-700 hover:gap-2"
            >
              Ver centro de ayuda completo
              <UIcon name="i-lucide-arrow-right" class="size-3.5 transition" />
            </NuxtLink>
          </template>
        </SipacCard>

        <SipacCard class="card-glow">
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 items-center justify-center rounded-xl bg-earth-50 text-earth-700"
              >
                <UIcon name="i-lucide-mail" class="size-5" />
              </span>
              <div>
                <h3 class="font-display text-lg font-medium text-text">Contactar al equipo</h3>
                <p class="text-sm text-text-muted">¿Algo no funciona como esperabas?</p>
              </div>
            </div>
          </template>
          <p class="text-sm leading-[1.7] text-text-muted">
            Escríbenos al correo de soporte institucional y describe brevemente lo que estás
            intentando hacer. Te respondemos en horario académico.
          </p>
          <template #footer>
            <SipacBadge color="neutral" variant="outline" size="lg">
              sipac.manager@gmail.com
            </SipacBadge>
          </template>
        </SipacCard>
      </div>
    </section>
  </div>
</template>
