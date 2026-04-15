<script setup lang="ts">
import { loginSchema } from '~~/server/utils/schemas/auth'

definePageMeta({ layout: false })

const { login, loading } = useAuth()
const toast = useToast()

const state = reactive({ email: '', password: '' })
const errorMsg = ref('')
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

async function onSubmit() {
  errorMsg.value = ''
  try {
    await login(state)
    await navigateTo('/')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg =
      err?.data?.data?.error?.message || err?.data?.statusMessage || 'Error al iniciar sesión'
    errorMsg.value = msg
    toast.add({ title: 'Error', description: msg, icon: 'i-lucide-circle-alert', color: 'error' })
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
      class="mx-auto grid min-h-screen max-w-[75rem] items-stretch px-4 py-6 lg:grid-cols-[minmax(0,1.1fr)_30rem] lg:px-6 lg:py-8"
    >
      <section class="hidden lg:flex lg:min-h-full lg:flex-col lg:justify-between lg:px-6 lg:py-8">
        <div class="space-y-6 fade-up">
          <div class="section-chip">Universidad de Córdoba</div>
          <div class="max-w-2xl space-y-4">
            <h1 class="font-display text-5xl font-medium leading-[1.1] text-text sm:text-6xl">
              Un acceso claro para un sistema académico inteligente.
            </h1>
            <p class="max-w-xl text-xl leading-[1.6] text-text-muted">
              SIPAc nace para organizar evidencias, preparar acreditación y convertir documentos
              dispersos en conocimiento útil.
            </p>
          </div>
        </div>

        <div class="grid gap-4 fade-up stagger-1">
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

      <section class="flex items-center justify-center py-8 lg:py-0">
        <SipacCard id="login-form" variant="subtle" class="fade-up w-full max-w-md">
          <SipacSectionHeader
            eyebrow="Sistema Inteligente de Productividad Académica"
            title="Iniciar sesión"
            description="Accede con tu cuenta institucional para continuar en el workspace de SIPAc."
            center
          />

          <UForm :schema="loginSchema" :state="state" class="mt-8 space-y-5" @submit="onSubmit">
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
          </UForm>

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
