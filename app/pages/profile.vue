<script setup lang="ts">
import type { ApiSuccessResponse, ProfileSummaryResponse } from '~~/app/types'
import { updateProfileSchema, changePasswordSchema } from '~~/server/utils/schemas/auth'

const { user, fetchUser } = useAuth()
const toast = useToast()
const profileSummary = ref<ProfileSummaryResponse | null>(null)
const summaryLoading = ref(false)

const profileState = reactive({ fullName: user.value?.fullName || '' })
const passwordState = reactive({ currentPassword: '', newPassword: '' })
const profileSaving = ref(false)
const passwordSaving = ref(false)

watch(
  () => user.value?.fullName,
  (val) => {
    if (val) profileState.fullName = val
  },
)

async function loadProfileSummary() {
  summaryLoading.value = true
  try {
    const response = await $fetch<ApiSuccessResponse<ProfileSummaryResponse>>('/api/profile')
    profileSummary.value = response.data
  } finally {
    summaryLoading.value = false
  }
}

async function onProfileSubmit() {
  profileSaving.value = true
  try {
    await $fetch('/api/profile', {
      method: 'PATCH',
      body: profileState,
    })
    await fetchUser()
    await loadProfileSummary()
    toast.add({ title: 'Perfil actualizado', icon: 'i-lucide-check-circle', color: 'success' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg = err?.data?.data?.error?.message || 'Error al actualizar perfil'
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    profileSaving.value = false
  }
}

async function onPasswordSubmit() {
  passwordSaving.value = true
  try {
    await $fetch('/api/profile/change-password', {
      method: 'POST',
      body: passwordState,
    })
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

onMounted(() => {
  void loadProfileSummary()
})
</script>

<template>
  <div class="space-y-8">
    <section class="panel-surface hero-wash fade-up p-6 sm:p-8">
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_22rem]">
        <div class="space-y-4">
          <div class="section-chip">Cuenta institucional</div>
          <div class="space-y-3">
            <h1 class="font-display text-4xl font-semibold text-text sm:text-5xl">
              Tu perfil institucional.
            </h1>
            <p class="max-w-2xl text-base leading-7 text-text-muted">
              Información personal visible en la plataforma y control de credenciales en un solo
              lugar.
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <SipacBadge color="primary" variant="subtle" size="lg">
              {{ user?.role === 'admin' ? 'Administrador' : 'Docente' }}
            </SipacBadge>
            <SipacBadge color="neutral" variant="outline" size="lg">
              {{ user?.program || 'Programa no especificado' }}
            </SipacBadge>
          </div>
        </div>

        <div class="panel-muted space-y-3 p-5">
          <p class="text-[0.72rem] font-semibold tracking-[0.18em] text-text-soft uppercase">
            Cuenta activa
          </p>
          <div class="space-y-3 text-sm">
            <div>
              <p class="font-semibold text-text">Correo institucional</p>
              <p class="wrap-break-word text-text-muted">{{ user?.email }}</p>
            </div>
            <div>
              <p class="font-semibold text-text">Estado</p>
              <p class="text-text-muted">Sesión activa y credenciales verificadas.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1fr)]">
      <SipacCard>
        <template #header>
          <div class="flex items-center gap-3">
            <span
              class="flex size-11 items-center justify-center rounded-2xl bg-sipac-50 text-sipac-700"
            >
              <UIcon name="i-lucide-user-round" class="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 class="font-semibold text-text">Información visible</h2>
              <p class="text-sm text-text-muted">Datos base de tu cuenta en SIPAc</p>
            </div>
          </div>
        </template>

        <div class="space-y-4 text-sm">
          <div class="panel-muted p-4">
            <p class="font-semibold text-text">Correo</p>
            <p class="mt-1 wrap-break-word text-text-muted">{{ user?.email }}</p>
          </div>
          <div class="panel-muted p-4">
            <p class="font-semibold text-text">Rol</p>
            <p class="mt-1 text-text-muted">
              {{ user?.role === 'admin' ? 'Administrador del sistema' : 'Docente del programa' }}
            </p>
          </div>
          <div class="panel-muted p-4">
            <p class="font-semibold text-text">Programa</p>
            <p class="mt-1 text-text-muted">{{ user?.program || 'No registrado' }}</p>
          </div>
        </div>

        <template #footer>
          <UAlert
            color="neutral"
            variant="solid"
            icon="i-lucide-info"
            title="Solo lectura"
            description="El correo y el rol se gestionan desde administración."
          />
        </template>
      </SipacCard>

      <div class="space-y-6">
        <SipacCard>
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-11 items-center justify-center rounded-2xl bg-earth-50 text-earth-700"
              >
                <UIcon name="i-lucide-chart-column-big" class="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 class="font-semibold text-text">Resumen académico</h2>
                <p class="text-sm text-text-muted">Solo productos confirmados del repositorio</p>
              </div>
            </div>
          </template>

          <div v-if="summaryLoading" class="grid gap-3 sm:grid-cols-2">
            <div class="panel-muted p-4">
              <p class="text-sm text-text-muted">Cargando resumen...</p>
            </div>
          </div>

          <div v-else class="space-y-4">
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="panel-muted p-4">
                <p class="text-xs font-semibold tracking-[0.14em] text-text-soft uppercase">
                  Total confirmado
                </p>
                <p class="mt-2 text-3xl font-semibold text-text">
                  {{ profileSummary?.totalOwnProducts ?? 0 }}
                </p>
              </div>

              <div class="panel-muted p-4">
                <p class="text-xs font-semibold tracking-[0.14em] text-text-soft uppercase">
                  Borradores recientes
                </p>
                <p class="mt-2 text-3xl font-semibold text-text">
                  {{ profileSummary?.latestDrafts.length ?? 0 }}
                </p>
              </div>
            </div>

            <div class="space-y-3">
              <p class="text-sm font-semibold text-text">Productos por tipo</p>
              <div
                v-if="profileSummary?.productSummaryByType.length"
                class="grid gap-3 sm:grid-cols-2"
              >
                <div
                  v-for="item in profileSummary.productSummaryByType"
                  :key="item.productType"
                  class="panel-muted flex items-center justify-between gap-3 p-4"
                >
                  <p class="text-sm text-text-muted">{{ item.productType }}</p>
                  <p class="text-lg font-semibold text-text">{{ item.total }}</p>
                </div>
              </div>
              <UAlert
                v-else
                color="neutral"
                variant="soft"
                icon="i-lucide-info"
                title="Aún no hay productos confirmados"
                description="Cuando confirmes productos en el workspace, el resumen aparecerá aquí."
              />
            </div>
          </div>
        </SipacCard>

        <SipacCard>
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-11 items-center justify-center rounded-2xl bg-sipac-50 text-sipac-700"
              >
                <UIcon name="i-lucide-pencil-line" class="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 class="font-semibold text-text">Actualizar nombre</h2>
                <p class="text-sm text-text-muted">Mantén tu identidad académica al día</p>
              </div>
            </div>
          </template>

          <UForm
            :schema="updateProfileSchema"
            :state="profileState"
            class="space-y-4"
            @submit="onProfileSubmit"
          >
            <UFormField label="Nombre completo" name="fullName">
              <UInput
                v-model="profileState.fullName"
                color="neutral"
                variant="outline"
                name="fullName"
                autocomplete="name"
                icon="i-lucide-user-round"
                class="w-full"
              />
            </UFormField>

            <div class="flex flex-wrap items-center gap-3">
              <SipacButton type="submit" :loading="profileSaving">Guardar cambios</SipacButton>
            </div>
          </UForm>
        </SipacCard>

        <SipacCard>
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-11 items-center justify-center rounded-2xl bg-earth-50 text-earth-700"
              >
                <UIcon name="i-lucide-lock-keyhole" class="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 class="font-semibold text-text">Cambiar contraseña</h2>
                <p class="text-sm text-text-muted">Un flujo separado para tareas sensibles</p>
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
                icon="i-lucide-shield-check"
                class="w-full"
              />
            </UFormField>

            <div class="flex flex-wrap items-center gap-3">
              <SipacButton type="submit" color="neutral" variant="soft" :loading="passwordSaving">
                Cambiar contraseña
              </SipacButton>
            </div>
          </UForm>
        </SipacCard>
      </div>
    </section>
  </div>
</template>
