<script setup lang="ts">
import type { ApiSuccessResponse } from '~~/app/types'

definePageMeta({ layout: false })

const route = useRoute()

const tokenParam = computed(() => {
  const raw = route.query.token
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
  return ''
})

type State = 'loading' | 'success' | 'invalid' | 'missing'
const state = ref<State>(tokenParam.value ? 'loading' : 'missing')

async function runConfirm() {
  if (!tokenParam.value) {
    state.value = 'missing'
    return
  }
  state.value = 'loading'
  try {
    await $fetch<ApiSuccessResponse<{ message: string; email: string }>>(
      '/api/profile/confirm-email',
      { method: 'POST', body: { token: tokenParam.value } },
    )
    state.value = 'success'
    await navigateTo('/login')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg = err?.data?.data?.error?.message || ''
    if (/expir/i.test(msg)) state.value = 'invalid'
    else state.value = 'invalid'
  }
}

onMounted(() => {
  runConfirm()
})
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <div class="hero-warm absolute inset-0 -z-10" />
    <div class="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-10">
      <SipacCard variant="subtle" class="w-full max-w-lg">
        <template v-if="state === 'loading'">
          <SipacSectionHeader
            eyebrow="Cambio de correo"
            title="Confirmando tu nuevo correo…"
            description="Estamos validando el enlace. Esto toma solo un momento."
            center
          />
          <div class="mt-8 flex justify-center">
            <UIcon name="i-lucide-loader-2" class="size-10 animate-spin text-sipac-600" />
          </div>
        </template>

        <template v-else-if="state === 'success'">
          <SipacSectionHeader
            eyebrow="Listo"
            title="Correo actualizado"
            description="Redirigiendo al inicio de sesión…"
            center
          />
        </template>

        <template v-else-if="state === 'invalid'">
          <SipacSectionHeader
            eyebrow="Enlace inválido"
            title="No pudimos confirmar el cambio"
            description="El enlace puede haber expirado o ya fue usado. Solicita un nuevo cambio desde tu perfil."
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
