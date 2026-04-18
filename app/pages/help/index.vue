<script setup lang="ts">
definePageMeta({
  title: 'Centro de ayuda',
})

useHead({
  title: 'Ayuda · SIPAc',
  meta: [
    {
      name: 'description',
      content:
        'Guías rápidas, preguntas frecuentes y soporte para sacarle el máximo provecho a SIPAc.',
    },
  ],
})

const guides = [
  {
    to: '/help/upload',
    title: 'Cómo subir y analizar documentos',
    description:
      'Aprende el flujo completo: seleccionar archivos, validarlos y enviarlos al análisis automático.',
    icon: 'i-lucide-upload',
    accent: 'bg-sipac-50 text-sipac-700',
  },
  {
    to: '/help/repository',
    title: 'Cómo organizar tu repositorio',
    description:
      'Filtra, etiqueta y guarda búsquedas para reutilizar consultas frecuentes en tu práctica académica.',
    icon: 'i-lucide-library',
    accent: 'bg-earth-50 text-earth-700',
  },
  {
    to: '/help/assistant',
    title: 'Cómo preguntarle al asistente IA',
    description:
      'Buenas prácticas para formular preguntas que el asistente responda con precisión y citas útiles.',
    icon: 'i-lucide-sparkles',
    accent: 'bg-sipac-50 text-sipac-700',
  },
]

const faqs = [
  {
    q: '¿Qué tipos de archivo puedo subir?',
    a: 'PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT, PNG y JPG. SIPAc detecta texto embebido o usa OCR cuando el documento está escaneado.',
  },
  {
    q: '¿Puedo editar mis datos después de registrarme?',
    a: 'Sí. En tu perfil puedes actualizar nombre, programa académico y correo (con verificación previa).',
  },
  {
    q: '¿Cómo activo el segundo factor?',
    a: 'Entra a Perfil → Seguridad y activa 2FA por correo. Te pediremos un código de 6 dígitos al iniciar sesión.',
  },
  {
    q: '¿Puedo revocar una sesión activa?',
    a: 'En Perfil → Seguridad ves todas tus sesiones abiertas y puedes cerrarlas de forma individual o masiva.',
  },
  {
    q: '¿Qué hago si no llega el correo de verificación?',
    a: 'Revisa la carpeta de spam. En la página de verificación puedes solicitar un nuevo enlace.',
  },
]

const openFaq = ref<string | null>(null)

function toggleFaq(id: string) {
  openFaq.value = openFaq.value === id ? null : id
}
</script>

<template>
  <div class="page-stage space-y-6 sm:space-y-8">
    <PageHero
      eyebrow="Capítulo · Ayuda"
      title="Centro de ayuda SIPAc"
      description="Encuentra guías, atajos y respuestas rápidas para los flujos más comunes de la plataforma."
      icon="i-lucide-life-buoy"
    >
      <template #badges>
        <SipacBadge color="neutral" variant="outline" size="lg">
          <UIcon name="i-lucide-book-open" class="size-3.5" /> 3 guías
        </SipacBadge>
        <SipacBadge color="neutral" variant="outline" size="lg">
          <UIcon name="i-lucide-help-circle" class="size-3.5" /> {{ faqs.length }} FAQ
        </SipacBadge>
      </template>
    </PageHero>

    <section class="space-y-4">
      <SipacSectionHeader
        eyebrow="Guías rápidas"
        title="Aprende los flujos esenciales"
        description="Tutoriales cortos que explican cómo usar las funciones principales de SIPAc."
        size="md"
      />

      <div class="grid gap-4 md:grid-cols-3">
        <NuxtLink
          v-for="guide in guides"
          :key="guide.to"
          :to="guide.to"
          class="group panel-surface card-glow flex h-full flex-col gap-3 p-6 transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span class="flex size-10 items-center justify-center rounded-xl" :class="guide.accent">
            <UIcon :name="guide.icon" class="size-5" />
          </span>
          <h3 class="font-display text-lg font-medium text-text">
            {{ guide.title }}
          </h3>
          <p class="text-sm leading-[1.6] text-text-muted">
            {{ guide.description }}
          </p>
          <span
            class="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-sipac-700 group-hover:gap-2"
          >
            Leer guía
            <UIcon name="i-lucide-arrow-right" class="size-4 transition" />
          </span>
        </NuxtLink>
      </div>
    </section>

    <section class="space-y-4">
      <SipacSectionHeader
        eyebrow="Preguntas frecuentes"
        title="Respuestas rápidas"
        description="Las dudas más comunes sobre SIPAc, resueltas en un párrafo."
        size="md"
      />

      <div class="panel-surface divide-y divide-border/70">
        <div v-for="(faq, index) in faqs" :key="index" class="px-5 py-4 sm:px-6">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-4 text-left"
            :aria-expanded="openFaq === String(index)"
            :aria-controls="`faq-panel-${index}`"
            @click="toggleFaq(String(index))"
          >
            <span class="font-medium text-text">{{ faq.q }}</span>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-4 shrink-0 text-text-muted transition"
              :class="openFaq === String(index) ? 'rotate-180' : ''"
            />
          </button>
          <p
            v-show="openFaq === String(index)"
            :id="`faq-panel-${index}`"
            class="mt-3 text-sm leading-[1.7] text-text-muted"
          >
            {{ faq.a }}
          </p>
        </div>
      </div>
    </section>

    <section class="panel-surface card-glow p-6 sm:p-8">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="max-w-xl space-y-2">
          <h3 class="font-display text-xl font-medium text-text">¿No encuentras lo que buscas?</h3>
          <p class="text-sm leading-[1.6] text-text-muted">
            Escríbenos al correo de soporte institucional con una descripción breve de lo que estás
            intentando hacer. Respondemos en horario académico.
          </p>
        </div>
        <SipacBadge color="neutral" variant="outline" size="lg">
          sipac.manager@gmail.com
        </SipacBadge>
      </div>
    </section>
  </div>
</template>
