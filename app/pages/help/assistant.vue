<script setup lang="ts">
definePageMeta({
  title: 'Cómo preguntarle al asistente IA',
})

useHead({
  title: 'Cómo preguntarle al asistente IA · Ayuda SIPAc',
})
</script>

<template>
  <div class="page-stage space-y-6">
    <NuxtLink
      to="/help"
      class="inline-flex items-center gap-1.5 text-sm font-medium text-sipac-700 hover:gap-2"
    >
      <UIcon name="i-lucide-arrow-left" class="size-4" /> Volver al centro de ayuda
    </NuxtLink>

    <SipacArticle
      eyebrow="Guía · Asistente IA"
      title="Cómo preguntarle al asistente IA"
      description="Buenas prácticas para formular preguntas claras y obtener respuestas con contexto y citas útiles."
      icon="i-lucide-sparkles"
      reading-time="3 min de lectura"
    >
      <h2>Qué puede hacer el asistente</h2>
      <p>
        El asistente de SIPAc usa recuperación híbrida (búsqueda por palabras clave más búsqueda
        semántica) sobre tu repositorio confirmado. Puede resumir documentos, comparar trabajos,
        listar autores o localizar un fragmento específico.
      </p>

      <h2>Formula preguntas efectivas</h2>
      <ul>
        <li>
          <strong>Sé específico:</strong> incluye el tema, el tipo de trabajo y el marco temporal.
        </li>
        <li><strong>Una intención por mensaje:</strong> separa las preguntas grandes en pasos.</li>
        <li>
          <strong>Pide citas:</strong> si necesitas verificar una afirmación, pide la referencia
          exacta al documento.
        </li>
      </ul>

      <h3>Ejemplos</h3>
      <ul>
        <li>
          <em
            >"Resume las tesis de la Facultad de Educación publicadas entre 2022 y 2024 sobre
            aprendizaje autónomo."</em
          >
        </li>
        <li>
          <em
            >"Lista los autores que han trabajado en OCR aplicado a manuscritos históricos y muestra
            la cita completa."</em
          >
        </li>
        <li>
          <em
            >"Compara las conclusiones de estos dos trabajos sobre evaluación por competencias."</em
          >
        </li>
      </ul>

      <h2>Atajos de teclado</h2>
      <p>
        El asistente está diseñado para ser rápido. Usa estos atajos visuales y de teclado para
        navegar sin despegar las manos:
      </p>
      <div class="not-prose my-6 grid gap-3 sm:grid-cols-2">
        <div
          class="flex items-center gap-3 rounded-xl border border-border/50 bg-surface px-4 py-3 shadow-sm"
        >
          <div
            class="flex shrink-0 items-center gap-1 font-mono text-[0.7rem] font-medium text-text-muted"
          >
            <kbd
              class="min-w-[1.5rem] rounded-md border border-border/60 bg-surface-elevated px-1.5 py-0.5 text-center shadow-sm"
              >⌘</kbd
            >
            <span>+</span>
            <kbd
              class="min-w-[1.5rem] rounded-md border border-border/60 bg-surface-elevated px-1.5 py-0.5 text-center shadow-sm"
              >K</kbd
            >
          </div>
          <span class="text-sm font-medium text-text-soft">Nueva conversación</span>
        </div>
        <div
          class="flex items-center gap-3 rounded-xl border border-border/50 bg-surface px-4 py-3 shadow-sm"
        >
          <div
            class="flex shrink-0 items-center gap-1 font-mono text-[0.7rem] font-medium text-text-muted"
          >
            <kbd
              class="min-w-[1.5rem] rounded-md border border-border/60 bg-surface-elevated px-1.5 py-0.5 text-center shadow-sm"
              >⇧</kbd
            >
            <span>+</span>
            <kbd
              class="min-w-[1.5rem] rounded-md border border-border/60 bg-surface-elevated px-1.5 py-0.5 text-center shadow-sm"
              >↵</kbd
            >
          </div>
          <span class="text-sm font-medium text-text-soft">Salto de línea</span>
        </div>
        <div
          class="flex items-center gap-3 rounded-xl border border-border/50 bg-surface px-4 py-3 shadow-sm"
        >
          <div
            class="flex shrink-0 items-center gap-1 font-mono text-[0.7rem] font-medium text-text-muted"
          >
            <kbd
              class="min-w-[1.5rem] rounded-md border border-border/60 bg-surface-elevated px-1.5 py-0.5 text-center shadow-sm"
              >↵</kbd
            >
          </div>
          <span class="text-sm font-medium text-text-soft">Enviar mensaje</span>
        </div>
        <div
          class="flex items-center gap-3 rounded-xl border border-border/50 bg-surface px-4 py-3 shadow-sm"
        >
          <div
            class="flex shrink-0 items-center gap-1 font-mono text-[0.7rem] font-medium text-text-muted"
          >
            <kbd
              class="min-w-[1.5rem] rounded-md border border-border/60 bg-surface-elevated px-1.5 py-0.5 text-center shadow-sm"
              >Esc</kbd
            >
          </div>
          <span class="text-sm font-medium text-text-soft">Detener generación</span>
        </div>
      </div>

      <h2>Qué hacer si la respuesta no convence</h2>
      <ol>
        <li>Revisa las citas enlazadas: si el extracto no corresponde, repórtalo.</li>
        <li>Reformula la pregunta con términos distintos (sinónimos, palabras del título).</li>
        <li>
          Si el asistente no encuentra información, puede que el documento no esté indexado. Súbelo
          desde el workspace.
        </li>
      </ol>

      <h2>Privacidad</h2>
      <p>
        Tus conversaciones con el asistente son privadas y quedan vinculadas a tu cuenta. Puedes
        eliminarlas desde el panel lateral del chat.
      </p>
    </SipacArticle>
  </div>
</template>
