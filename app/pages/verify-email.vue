<script setup lang="ts">
import type { ApiSuccessResponse, UserPublic } from '~~/app/types'

definePageMeta({ layout: false })

const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()

const tokenParam = computed(() => {
  const raw = route.query.token
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
  return ''
})

type VerifyState = 'loading' | 'success' | 'expired' | 'invalid' | 'missing'
const state = ref<VerifyState>(tokenParam.value ? 'loading' : 'missing')
const resendEmail = ref('')
const resending = ref(false)

async function runVerification() {
  if (!tokenParam.value) {
    state.value = 'missing'
    return
  }
  state.value = 'loading'
  try {
    const data = await $fetch<ApiSuccessResponse<{ token: string; user: UserPublic }>>(
      '/api/auth/verify-email',
      { method: 'POST', body: { token: tokenParam.value } },
    )
    authStore.setUser(data.data.user)
    await navigateTo('/')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg = err?.data?.data?.error?.message || ''
    if (/expir/i.test(msg)) state.value = 'expired'
    else state.value = 'invalid'
  }
}

async function resend() {
  if (!resendEmail.value) return
  resending.value = true
  try {
    await $fetch('/api/auth/resend-verification', {
      method: 'POST',
      body: { email: resendEmail.value },
    })
    toast.add({
      title: 'Enlace enviado',
      description: 'Si la cuenta existe y está pendiente, recibirás un nuevo correo.',
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

onMounted(() => {
  runVerification()
})
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <div class="hero-warm absolute inset-0 -z-10" />
    <div class="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-10">
      <SipacCard variant="subtle" class="w-full max-w-lg">
        <template v-if="state === 'loading'">
          <SipacSectionHeader
            eyebrow="Verificación de correo"
            title="Confirmando tu cuenta…"
            description="Estamos validando el enlace. Esto toma solo un momento."
            center
          />
          <div class="mt-8 flex justify-center">
            <UIcon name="i-lucide-loader-2" class="size-10 animate-spin text-sipac-600" />
          </div>
        </template>

        <template v-else-if="state === 'success'">
          <SipacSectionHeader
            eyebrow="¡Listo!"
            title="Tu correo fue verificado"
            description="Ya puedes comenzar a trabajar en SIPAc."
            center
          />
          <div class="mt-8 flex justify-center">
            <span
              class="flex size-16 items-center justify-center rounded-full bg-sipac-100 text-sipac-700"
            >
              <UIcon name="i-lucide-check-circle-2" class="size-9" />
            </span>
          </div>
          <SipacButton class="mt-8" block size="lg" to="/">Ir al panel</SipacButton>
        </template>

        <template v-else-if="state === 'expired'">
          <SipacSectionHeader
            eyebrow="Enlace vencido"
            title="Este enlace ya no es válido"
            description="Los enlaces de verificación expiran pasadas 24 horas. Podemos enviarte uno nuevo."
            center
          />
          <form class="mt-6 space-y-4" @submit.prevent="resend">
            <UFormField label="Correo institucional" name="email" required>
              <UInput
                v-model="resendEmail"
                type="email"
                color="neutral"
                variant="outline"
                placeholder="tu@correo.edu.co"
                icon="i-lucide-mail"
                class="w-full"
              />
            </UFormField>
            <SipacButton type="submit" block size="lg" :loading="resending">
              Enviar un nuevo enlace
            </SipacButton>
          </form>
        </template>

        <template v-else-if="state === 'invalid'">
          <SipacSectionHeader
            eyebrow="Enlace inválido"
            title="No pudimos validar este enlace"
            description="Puede haber sido usado ya o copiado parcialmente. Solicita uno nuevo si lo necesitas."
            center
          />
          <SipacButton class="mt-8" block size="lg" to="/login">Ir al inicio de sesión</SipacButton>
        </template>

        <template v-else>
          <SipacSectionHeader
            eyebrow="Enlace ausente"
            title="Falta el token"
            description="Abre el enlace exacto que recibiste en tu correo."
            center
          />
          <SipacButton class="mt-8" block size="lg" to="/login">Ir al inicio de sesión</SipacButton>
        </template>
      </SipacCard>
    </div>
  </div>
</template>
