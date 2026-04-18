<script setup lang="ts">
import { registerSchema } from '~~/server/utils/schemas/auth'

definePageMeta({ layout: false })

const { register, loading } = useAuth()
const toast = useToast()

const { data: googleStatus } = await useAsyncData('google-oauth-status-register', () =>
  $fetch<{ success: boolean; data: { enabled: boolean } }>('/api/auth/google/status'),
)
const googleEnabled = computed(() => googleStatus.value?.data.enabled === true)

const state = reactive({
  firstName: '',
  middleName: '',
  lastName: '',
  secondLastName: '',
  email: '',
  password: '',
  program: '',
})
const errorMsg = ref('')
const pendingEmail = ref('')
const step = ref<'form' | 'sent'>('form')
const resending = ref(false)
const onboardingNotes = [
  'Correo institucional para trazabilidad y contexto académico.',
  'Programa académico opcional para reforzar personalización y perfil.',
  'Contraseña segura desde el primer acceso.',
]

async function onSubmit() {
  errorMsg.value = ''
  try {
    const outcome = await register(state)
    pendingEmail.value = outcome.email
    step.value = 'sent'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg =
      err?.data?.data?.error?.message || err?.data?.statusMessage || 'Error al registrarse'
    errorMsg.value = msg
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  }
}

async function resend() {
  if (!pendingEmail.value) return
  resending.value = true
  try {
    await $fetch('/api/auth/resend-verification', {
      method: 'POST',
      body: { email: pendingEmail.value },
    })
    toast.add({
      title: 'Enlace reenviado',
      description: 'Revisa tu correo.',
      icon: 'i-lucide-mail-check',
      color: 'success',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg = err?.data?.data?.error?.message || 'No se pudo reenviar el enlace'
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  } finally {
    resending.value = false
  }
}
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <a
      href="#register-form"
      class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-sipac-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#faf9f5]"
    >
      Ir al formulario de registro
    </a>

    <div class="hero-warm absolute inset-0 -z-10" />

    <div
      class="mx-auto grid min-h-screen max-w-[75rem] items-stretch px-4 py-6 lg:grid-cols-[28rem_minmax(0,1.05fr)] lg:px-6 lg:py-8"
    >
      <section class="order-2 hidden items-center justify-center lg:order-1 lg:flex">
        <SipacCard id="register-form" variant="subtle" class="page-stage-primary w-full max-w-md">
          <SipacSectionHeader
            v-if="step === 'form'"
            eyebrow="Crear cuenta institucional"
            title="Registro"
            description="Completa tus datos para acceder al workspace de productividad académica."
          />
          <SipacSectionHeader
            v-else
            eyebrow="Revisa tu correo"
            title="Confirma tu cuenta"
            :description="`Enviamos un enlace a ${pendingEmail}. Tiene vigencia por 24 horas.`"
          />

          <div v-if="step === 'sent'" class="mt-8 space-y-5">
            <UAlert
              color="info"
              variant="subtle"
              icon="i-lucide-mail"
              title="Enlace enviado"
              description="Haz clic en el enlace del correo para activar tu cuenta. Después podrás iniciar sesión."
            />
            <SipacButton
              type="button"
              block
              size="lg"
              icon="i-lucide-send"
              :loading="resending"
              @click="resend"
              >Reenviar enlace</SipacButton
            >
            <SipacButton type="button" block size="lg" variant="ghost" to="/login"
              >Ir al inicio de sesión</SipacButton
            >
          </div>

          <UForm
            v-else
            :schema="registerSchema"
            :state="state"
            class="mt-8 space-y-5"
            @submit="onSubmit"
          >
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Primer nombre" name="firstName" required>
                <UInput
                  v-model="state.firstName"
                  color="neutral"
                  variant="outline"
                  autocomplete="given-name"
                  placeholder="Ej. María"
                  icon="i-lucide-user"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Segundo nombre" name="middleName">
                <UInput
                  v-model="state.middleName"
                  color="neutral"
                  variant="outline"
                  autocomplete="additional-name"
                  placeholder="Opcional"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Primer apellido" name="lastName" required>
                <UInput
                  v-model="state.lastName"
                  color="neutral"
                  variant="outline"
                  autocomplete="family-name"
                  placeholder="Ej. Pérez"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Segundo apellido" name="secondLastName">
                <UInput
                  v-model="state.secondLastName"
                  color="neutral"
                  variant="outline"
                  autocomplete="family-name"
                  placeholder="Opcional"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UFormField label="Correo electrónico" name="email" required>
              <UInput
                v-model="state.email"
                type="email"
                color="neutral"
                variant="outline"
                name="email"
                autocomplete="email"
                inputmode="email"
                placeholder="correo@correo.unicordoba.edu.co…"
                icon="i-lucide-mail"
                :spellcheck="false"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Contraseña" name="password" required>
              <SipacPasswordInput
                v-model="state.password"
                color="neutral"
                variant="outline"
                name="password"
                autocomplete="new-password"
                placeholder="Mínimo 8 caracteres…"
                icon="i-lucide-lock"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Programa académico" name="program" hint="Opcional">
              <UInput
                v-model="state.program"
                color="neutral"
                variant="outline"
                name="program"
                autocomplete="organization-title"
                placeholder="Ej.: Ingeniería de Sistemas…"
                icon="i-lucide-graduation-cap"
                class="w-full"
              />
            </UFormField>

            <UAlert
              v-if="errorMsg"
              aria-live="polite"
              color="error"
              variant="subtle"
              icon="i-lucide-octagon-alert"
              title="No fue posible completar el registro"
              :description="errorMsg"
            />

            <SipacButton type="submit" block size="lg" :loading="loading">Crear cuenta</SipacButton>

            <AuthGoogleAuthButton :enabled="googleEnabled" label="Registrarse con Google" />
          </UForm>

          <p class="mt-6 text-center text-sm text-text-muted">
            ¿Ya tienes cuenta?
            <NuxtLink
              to="/login"
              class="font-semibold text-sipac-700 transition-colors duration-200 hover:text-sipac-800"
            >
              Inicia sesión
            </NuxtLink>
          </p>
        </SipacCard>
      </section>

      <section class="order-1 flex flex-col justify-between px-0 py-8 lg:order-2 lg:px-8">
        <div class="page-stage-hero space-y-6">
          <div class="section-chip">Onboarding académico</div>
          <div class="max-w-2xl space-y-4">
            <h2 class="font-display text-5xl font-medium leading-[1.1] text-text sm:text-6xl">
              Crea tu cuenta para gestionar evidencias y productividad académica.
            </h2>
            <p class="max-w-2xl text-xl leading-[1.6] text-text-muted">
              SIPAc organiza tu trabajo docente con apoyo de IA, centraliza documentos probatorios y
              prepara el terreno para procesos de acreditación.
            </p>
          </div>
        </div>

        <div
          class="page-stage-grid page-stage-grid--tight grid gap-4 py-8 md:grid-cols-3 lg:grid-cols-1"
        >
          <SipacCard v-for="note in onboardingNotes" :key="note" interactive variant="soft">
            <div class="flex items-start gap-3 p-1">
              <span
                class="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sipac-50 text-sipac-700"
              >
                <UIcon name="i-lucide-check-check" class="size-4.5" aria-hidden="true" />
              </span>
              <p class="text-sm leading-[1.6] text-text-muted">{{ note }}</p>
            </div>
          </SipacCard>
        </div>

        <div class="page-stage-supporting panel-muted max-w-2xl p-5">
          <div class="flex items-start gap-3">
            <span
              class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-earth-100 text-earth-700"
            >
              <UIcon name="i-lucide-shield-check" class="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 class="font-display text-lg font-medium text-text">
                Seguridad desde el primer paso
              </h3>
              <p class="mt-1 text-sm leading-[1.6] text-text-muted">
                Validaciones claras, control de errores y autenticación segura desde el registro.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
