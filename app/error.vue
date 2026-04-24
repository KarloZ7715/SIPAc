<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

// Normalize status into a coarse bucket so we can tell distinct stories
const statusCode = computed(() => Number(props.error?.statusCode) || 500)

const story = computed(() => {
  const code = statusCode.value
  if (code === 404) {
    return {
      chapter: 'Error 404 · Página no encontrada',
      title: 'Aquí no hay documento',
      description:
        'La ruta que intentaste abrir no existe o fue movida. Revisa el enlace o vuelve a una sección conocida.',
      icon: 'i-lucide-compass',
    }
  }
  if (code === 403) {
    return {
      chapter: 'Error 403 · Acceso restringido',
      title: 'No tienes permiso para esta sección',
      description:
        'Tu cuenta no está autorizada para ver este contenido. Si crees que es un error, contacta a un administrador.',
      icon: 'i-lucide-lock',
    }
  }
  if (code === 401) {
    return {
      chapter: 'Error 401 · Sesión requerida',
      title: 'Inicia sesión para continuar',
      description:
        'Tu sesión expiró o no está autenticada. Vuelve a ingresar para retomar tu trabajo.',
      icon: 'i-lucide-key-round',
    }
  }
  if (code === 503) {
    return {
      chapter: 'Error 503 · Servicio no disponible',
      title: 'Estamos fuera de servicio temporalmente',
      description:
        'El sistema está en mantenimiento o sobrecargado. Intenta de nuevo en unos minutos.',
      icon: 'i-lucide-construction',
    }
  }
  return {
    chapter: `Error ${code} · Algo falló`,
    title: 'Ocurrió un problema inesperado',
    description:
      'Nuestro equipo ya puede verlo en los registros. Puedes regresar al inicio o intentar de nuevo.',
    icon: 'i-lucide-triangle-alert',
  }
})

async function goHome() {
  await clearError({ redirect: '/' })
}

function reload() {
  if (import.meta.client) {
    window.location.reload()
  }
}
</script>

<template>
  <div
    class="relative flex min-h-dvh flex-col overflow-hidden bg-parchment text-text"
    role="alert"
    aria-live="polite"
  >
    <!-- Warm atmospheric wash -->
    <div
      class="pointer-events-none absolute inset-0 -z-10"
      aria-hidden="true"
      style="
        background:
          radial-gradient(50rem 30rem at 18% 12%, rgb(201 100 66 / 0.08), transparent 70%),
          radial-gradient(60rem 40rem at 80% 100%, rgb(125 83 54 / 0.06), transparent 72%);
      "
    />

    <header class="px-6 pt-8 sm:px-10">
      <NuxtLink
        to="/"
        class="inline-flex items-center gap-2.5 font-display text-lg font-medium tracking-tight text-text transition-opacity duration-200 hover:opacity-80"
      >
        <svg
          class="size-7"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <g stroke-linecap="round" stroke-linejoin="round">
            <polygon fill="#f3a683" points="50 36 37.876 29 37.876 43" />
            <polygon fill="#e08b66" points="50 50 50 36 37.876 43" />
            <polygon fill="#f3a683" points="62.124 43 74.248 50 62.124 57" />
            <polygon fill="#e08b66" points="50 50 62.124 43 62.124 57" />
            <polygon fill="#f3a683" points="37.876 57 37.876 71 50 64" />
            <polygon fill="#e08b66" points="50 50 37.876 57 50 64" />
          </g>
        </svg>
        SIPAc
      </NuxtLink>
    </header>

    <main class="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
      <div class="page-mast-editorial page-fade-up">
        <p class="page-mast-editorial__chapter">{{ story.chapter }}</p>

        <div
          class="mx-auto mt-6 flex size-16 items-center justify-center rounded-[1rem] border border-border/70 bg-white/80 text-sipac-700 shadow-[0_14px_30px_-22px_rgb(201_100_66/0.35)]"
        >
          <UIcon :name="story.icon" class="size-7" />
        </div>

        <h1 class="page-mast-editorial__title">{{ story.title }}</h1>
        <p class="page-mast-editorial__description">{{ story.description }}</p>

        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <SipacButton color="primary" variant="solid" icon="i-lucide-arrow-left" @click="goHome">
            Volver al inicio
          </SipacButton>
          <SipacButton color="neutral" variant="ghost" icon="i-lucide-rotate-cw" @click="reload">
            Reintentar
          </SipacButton>
        </div>

        <p
          v-if="props.error?.message"
          class="mx-auto mt-10 max-w-md truncate rounded-[0.55rem] border border-border/60 bg-white/70 px-3 py-1.5 font-mono text-[0.7rem] text-text-soft"
          :title="props.error.message"
        >
          {{ props.error.message }}
        </p>
      </div>
    </main>

    <footer
      class="px-6 pb-6 text-center text-[0.7rem] font-medium tracking-[0.22em] text-text-soft uppercase sm:px-10"
    >
      Sistema Inteligente de Productividad Académica
    </footer>
  </div>
</template>
