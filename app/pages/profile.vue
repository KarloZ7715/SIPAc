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
    <ExperiencePageHero
      eyebrow="Cuenta personal"
      :title="user?.fullName || 'Mi perfil'"
      description="Mantén tus datos al día, revisa tu resumen académico y controla los cambios importantes de tu cuenta."
      icon="i-lucide-user-round"
      compact
    >
      <template #badges>
        <SipacBadge color="primary" variant="subtle" size="lg">
          <UIcon name="i-lucide-shield-check" class="size-3.5" />
          {{ user?.role === 'admin' ? 'Administrador' : 'Docente' }}
        </SipacBadge>
        <SipacBadge color="neutral" variant="outline" size="lg">
          {{ user?.program || 'Universidad de Córdoba' }}
        </SipacBadge>
      </template>

      <template #aside>
        <ExperienceContextPanel
          eyebrow="Estado de la cuenta"
          title="Tu acceso está activo y listo para seguir trabajando."
          description="Aquí puedes confirmar tus datos principales antes de editar nombre o cambiar contraseña."
          icon="i-lucide-badge-check"
          tone="neutral"
        >
          <div class="space-y-3">
            <div class="rounded-xl bg-white/78 p-3">
              <p class="text-xs font-semibold tracking-[0.12em] text-text-soft uppercase">Correo</p>
              <p class="mt-1 text-sm font-semibold text-text">{{ user?.email }}</p>
            </div>
            <div class="rounded-xl bg-white/78 p-3">
              <p class="text-xs font-semibold tracking-[0.12em] text-text-soft uppercase">Estado</p>
              <p class="mt-1 text-sm font-semibold text-text">Cuenta activa y verificada</p>
            </div>
          </div>
        </ExperienceContextPanel>
      </template>
    </ExperiencePageHero>

    <!-- Main Content -->
    <section class="grid gap-6 xl:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1fr)]">
      <!-- Info Card -->
      <SipacCard class="card-glow">
        <template #header>
          <div class="flex items-center gap-3">
            <span
              class="flex size-10 items-center justify-center rounded-xl bg-sipac-50 text-sipac-700"
            >
              <UIcon name="i-lucide-id-card" class="size-5" />
            </span>
            <div>
              <h2 class="font-display text-xl font-medium text-text">Datos de la cuenta</h2>
              <p class="text-sm leading-[1.6] text-text-muted">Información registrada</p>
            </div>
          </div>
        </template>

        <div class="space-y-3">
          <div
            class="rounded-xl border border-border/60 bg-surface-muted/50 p-4 transition-[border-color,box-shadow,background-color] duration-200 ease-[var(--ease-sipac)] hover:border-border hover:bg-surface-muted/70 hover:shadow-[0_18px_32px_-30px_rgb(20_20_19/0.12)]"
          >
            <p class="text-sm font-medium text-text-soft">Correo institucional</p>
            <p class="mt-1 truncate font-semibold text-text">{{ user?.email }}</p>
          </div>
          <div
            class="rounded-xl border border-border/60 bg-surface-muted/50 p-4 transition-[border-color,box-shadow,background-color] duration-200 ease-[var(--ease-sipac)] hover:border-border hover:bg-surface-muted/70 hover:shadow-[0_18px_32px_-30px_rgb(20_20_19/0.12)]"
          >
            <p class="text-sm font-medium text-text-soft">Rol en el sistema</p>
            <p class="mt-1 font-semibold text-text">
              {{ user?.role === 'admin' ? 'Administrador' : 'Docente' }}
            </p>
          </div>
          <div
            class="rounded-xl border border-border/60 bg-surface-muted/50 p-4 transition-[border-color,box-shadow,background-color] duration-200 ease-[var(--ease-sipac)] hover:border-border hover:bg-surface-muted/70 hover:shadow-[0_18px_32px_-30px_rgb(20_20_19/0.12)]"
          >
            <p class="text-sm font-medium text-text-soft">Programa</p>
            <p class="mt-1 font-semibold text-text">{{ user?.program || 'No asignado' }}</p>
          </div>
        </div>

        <template #footer>
          <div class="flex items-start gap-2 rounded-xl bg-surface-muted/50 p-3">
            <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0 text-text-soft" />
            <p class="text-xs text-text-muted">
              El correo y el rol solo pueden cambiarlos los administradores
            </p>
          </div>
        </template>
      </SipacCard>

      <!-- Right Column -->
      <div class="space-y-6">
        <!-- Academic Summary -->
        <SipacCard class="card-glow">
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 items-center justify-center rounded-xl bg-earth-50 text-earth-700"
              >
                <UIcon name="i-lucide-bar-chart-3" class="size-5" />
              </span>
              <div>
                <h2 class="font-display text-xl font-medium text-text">Tu producción</h2>
                <p class="text-sm leading-[1.6] text-text-muted">Documentos guardados</p>
              </div>
            </div>
          </template>

          <div v-if="summaryLoading" class="grid gap-3 sm:grid-cols-2">
            <div class="skeleton-shimmer h-24 rounded-xl" />
            <div class="skeleton-shimmer h-24 rounded-xl" />
          </div>

          <div v-else class="space-y-4">
            <div class="grid gap-3 sm:grid-cols-2">
              <ExperienceStatCard
                label="Documentos"
                :value="profileSummary?.totalOwnProducts ?? 0"
                icon="i-lucide-file-check"
                caption="documentos guardados"
              />
              <ExperienceStatCard
                label="Borradores"
                :value="profileSummary?.latestDrafts.length ?? 0"
                icon="i-lucide-file-pen-line"
                tone="earth"
                caption="borradores activos"
              />
            </div>

            <div v-if="profileSummary?.productSummaryByType.length" class="space-y-2">
              <p class="text-sm font-medium text-text">Por tipo de documento</p>
              <div class="grid gap-2 sm:grid-cols-2">
                <div
                  v-for="item in profileSummary.productSummaryByType"
                  :key="item.productType"
                  class="interactive-card flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-white/92 px-3 py-2 shadow-[0_4px_24px_rgb(0_0_0/0.04)]"
                >
                  <p class="text-sm text-text-muted">{{ item.productType }}</p>
                  <SipacBadge color="primary" variant="subtle">{{ item.total }}</SipacBadge>
                </div>
              </div>
            </div>

            <ExperienceEmptyState
              v-else
              icon="i-lucide-folder-open"
              title="Sin documentos aún"
              description="Cuando guardes documentos, verás aquí un resumen claro de tu producción."
              compact
            />
          </div>
        </SipacCard>

        <!-- Update Name -->
        <SipacCard class="card-glow">
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 items-center justify-center rounded-xl bg-sipac-50 text-sipac-700"
              >
                <UIcon name="i-lucide-pencil" class="size-5" />
              </span>
              <div>
                <h2 class="font-display text-xl font-medium text-text">Actualizar nombre</h2>
                <p class="text-sm leading-[1.6] text-text-muted">Cómo apareces en el sistema</p>
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
                icon="i-lucide-user"
                placeholder="Tu nombre completo"
                class="w-full"
              />
            </UFormField>

            <SipacButton type="submit" icon="i-lucide-save" :loading="profileSaving">
              Guardar cambios
            </SipacButton>
          </UForm>
        </SipacCard>

        <!-- Change Password -->
        <SipacCard class="card-glow">
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 items-center justify-center rounded-xl bg-earth-50 text-earth-700"
              >
                <UIcon name="i-lucide-key-round" class="size-5" />
              </span>
              <div>
                <h2 class="font-display text-xl font-medium text-text">Cambiar contraseña</h2>
                <p class="text-sm leading-[1.6] text-text-muted">Mantén tu cuenta segura</p>
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
              Cambiar contraseña
            </SipacButton>
          </UForm>
        </SipacCard>
      </div>
    </section>
  </div>
</template>
