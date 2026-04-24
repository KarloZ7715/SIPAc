<script setup lang="ts">
import { loginSchema } from '~~/server/utils/schemas/auth'

definePageMeta({ layout: false })

const { login, verify2FA, loading, loginLanding } = useAuth()
const toast = useToast()

const state = reactive({ email: '', password: '' })
const errorMsg = ref('')
const step = ref<'credentials' | 'twofa' | 'verify-email'>('credentials')
const challengeId = ref('')
const challengeEmail = ref('')
const otpCode = ref('')
const valuePillars = [
  {
    title: 'Trabajo académico asistido',
    description:
      'Un punto de entrada pensado para futuros flujos de consulta con IA y trazabilidad documental.',
    icon: 'i-lucide-sparkles',
  },
  {
    title: 'Identidad institucional clara',
    description: 'Una capa visual seria, cercana y coherente con la Universidad de Córdoba.',
    icon: 'i-lucide-building-2',
  },
  {
    title: 'Seguridad desde el acceso',
    description:
      'Acceso confiable, validaciones claras y mensajes que acompañan sin generar ruido innecesario.',
    icon: 'i-lucide-shield-check',
  },
]

// Cookie para evitar redirecciones múltiples en la misma sesión
const lastLoginLanding = useCookie('last-login-landing', {
  maxAge: 60 * 10, // 10 minutos
  sameSite: 'strict',
})

async function onSubmit() {
  errorMsg.value = ''
  try {
    const outcome = await login(state)
    if (outcome.kind === 'success') {
      // Verificar si es un login "fresco" (primera navegación post-login)
      const isFreshLogin = !lastLoginLanding.value

      if (isFreshLogin && loginLanding.value) {
        // Primera navegación: usar preferencia del usuario
        lastLoginLanding.value = loginLanding.value
        await navigateTo(`/${loginLanding.value}`)
      } else {
        // Ya navegado o preferencia no disponible: ir a home
        await navigateTo('/')
      }
      return
    }
    if (outcome.kind === '2fa') {
      challengeId.value = outcome.challengeId
      challengeEmail.value = outcome.email
      step.value = 'twofa'
      toast.add({
        title: 'Verificación en dos pasos',
        description: `Enviamos un código a ${outcome.email}`,
        icon: 'i-lucide-shield-check',
        color: 'info',
      })
      return
    }
    if (outcome.kind === 'verification') {
      challengeEmail.value = outcome.email
      step.value = 'verify-email'
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg =
      err?.data?.data?.error?.message || err?.data?.statusMessage || 'Error al iniciar sesión'
    errorMsg.value = msg
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  }
}

async function onSubmit2FA() {
  errorMsg.value = ''
  try {
    await verify2FA(challengeId.value, otpCode.value)
    // Verificar si es un login "fresco" (primera navegación post-login)
    const isFreshLogin = !lastLoginLanding.value

    if (isFreshLogin && loginLanding.value) {
      // Primera navegación: usar preferencia del usuario
      lastLoginLanding.value = loginLanding.value
      await navigateTo(`/${loginLanding.value}`)
    } else {
      // Ya navegado o preferencia no disponible: ir a home
      await navigateTo('/')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg = err?.data?.data?.error?.message || err?.data?.statusMessage || 'Código inválido'
    errorMsg.value = msg
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
  }
}

function backToCredentials() {
  step.value = 'credentials'
  otpCode.value = ''
  challengeId.value = ''
  errorMsg.value = ''
}

const resending = ref(false)

const { data: googleStatus } = await useAsyncData('google-oauth-status', () =>
  $fetch<{ success: boolean; data: { enabled: boolean } }>('/api/auth/google/status'),
)
const googleEnabled = computed(() => googleStatus.value?.data.enabled === true)
async function resendVerification() {
  if (!challengeEmail.value) return
  resending.value = true
  try {
    await $fetch('/api/auth/resend-verification', {
      method: 'POST',
      body: { email: challengeEmail.value },
    })
    toast.add({
      title: 'Enlace enviado',
      description: 'Revisa tu bandeja de entrada.',
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
      href="#login-form"
      class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-sipac-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#faf9f5]"
    >
      Ir al formulario de acceso
    </a>

    <div class="hero-warm absolute inset-0 -z-10" />

    <div
      class="mx-auto grid min-h-screen max-w-[75rem] items-stretch px-3 py-4 sm:px-4 sm:py-6 lg:grid-cols-[minmax(0,1.1fr)_30rem] lg:px-6 lg:py-8"
    >
      <section class="hidden lg:flex lg:min-h-full lg:flex-col lg:justify-between lg:px-6 lg:py-8">
        <div class="page-stage-hero space-y-6">
          <div class="section-chip">Universidad de Córdoba</div>
          <div class="max-w-2xl space-y-4">
            <h1
              class="font-display text-3xl font-medium leading-[1.1] text-text sm:text-5xl lg:text-6xl"
            >
              Un acceso claro para un sistema académico inteligente.
            </h1>
            <p class="max-w-xl text-xl leading-[1.6] text-text-muted">
              SIPAc nace para organizar evidencias, preparar acreditación y convertir documentos
              dispersos en conocimiento útil.
            </p>
          </div>
        </div>

        <div class="page-stage-grid page-stage-grid--tight grid gap-4">
          <SipacCard
            v-for="pillar in valuePillars"
            :key="pillar.title"
            interactive
            variant="soft"
            class="max-w-xl"
          >
            <div class="flex items-start gap-4 p-1">
              <span
                class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sipac-50 text-sipac-700"
              >
                <UIcon :name="pillar.icon" class="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 class="font-display text-lg font-medium text-text">{{ pillar.title }}</h2>
                <p class="mt-1 text-sm leading-[1.6] text-text-muted">{{ pillar.description }}</p>
              </div>
            </div>
          </SipacCard>
        </div>
      </section>

      <section class="flex items-center justify-center py-4 sm:py-6 lg:py-0">
        <SipacCard
          id="login-form"
          variant="subtle"
          class="page-stage-primary w-full max-w-[calc(100vw-2rem)] sm:max-w-md"
        >
          <SipacSectionHeader
            v-if="step === 'credentials'"
            eyebrow="Sistema Inteligente de Productividad Académica"
            title="Iniciar sesión"
            description="Accede con tu cuenta institucional para continuar en el workspace de SIPAc."
            center
          />
          <SipacSectionHeader
            v-else-if="step === 'twofa'"
            eyebrow="Verificación en dos pasos"
            title="Ingresa el código"
            :description="`Enviamos un código de 6 dígitos a ${challengeEmail}. Vence en 5 minutos.`"
            center
          />
          <SipacSectionHeader
            v-else
            eyebrow="Verificación pendiente"
            title="Confirma tu correo"
            :description="`Para iniciar sesión debes confirmar ${challengeEmail}. Revisa tu bandeja de entrada.`"
            center
          />

          <UForm
            v-if="step === 'credentials'"
            :schema="loginSchema"
            :state="state"
            class="mt-8 space-y-5"
            @submit="onSubmit"
          >
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
                autocomplete="current-password"
                placeholder="Ingresa tu contraseña…"
                icon="i-lucide-lock"
                class="w-full"
              />
            </UFormField>

            <UAlert
              v-if="errorMsg"
              aria-live="polite"
              color="error"
              variant="subtle"
              icon="i-lucide-octagon-alert"
              title="No fue posible iniciar sesión"
              :description="errorMsg"
            />

            <SipacButton type="submit" block size="lg" :loading="loading"
              >Iniciar sesión</SipacButton
            >

            <AuthGoogleAuthButton :enabled="googleEnabled" label="Continuar con Google" />
          </UForm>

          <form v-else-if="step === 'twofa'" class="mt-8 space-y-5" @submit.prevent="onSubmit2FA">
            <UFormField label="Código de 6 dígitos" name="code" required>
              <UInput
                v-model="otpCode"
                color="neutral"
                variant="outline"
                name="otp"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
                pattern="[0-9]{6}"
                placeholder="••••••"
                icon="i-lucide-key-round"
                class="w-full"
              />
            </UFormField>

            <UAlert
              v-if="errorMsg"
              aria-live="polite"
              color="error"
              variant="subtle"
              icon="i-lucide-octagon-alert"
              title="No fue posible verificar"
              :description="errorMsg"
            />

            <SipacButton
              type="submit"
              block
              size="lg"
              :loading="loading"
              :disabled="otpCode.length !== 6"
              >Verificar e ingresar</SipacButton
            >
            <SipacButton type="button" block size="lg" variant="ghost" @click="backToCredentials"
              >Usar otra cuenta</SipacButton
            >
          </form>

          <div v-else class="mt-8 space-y-5">
            <UAlert
              color="warning"
              variant="subtle"
              icon="i-lucide-mail-warning"
              title="Correo no verificado"
              description="Revisa el enlace que te enviamos al registrarte o solicita un reenvío."
            />
            <SipacButton
              type="button"
              block
              size="lg"
              icon="i-lucide-send"
              :loading="resending"
              @click="resendVerification"
              >Reenviar enlace de verificación</SipacButton
            >
            <SipacButton type="button" block size="lg" variant="ghost" @click="backToCredentials"
              >Volver</SipacButton
            >
          </div>

          <div class="mt-6 space-y-4">
            <p class="text-center text-sm text-text-muted">
              ¿No tienes cuenta?
              <NuxtLink
                to="/register"
                class="font-semibold text-sipac-700 transition-colors duration-200 hover:text-sipac-800"
              >
                Regístrate
              </NuxtLink>
            </p>
          </div>
        </SipacCard>
      </section>
    </div>
  </div>
</template>
