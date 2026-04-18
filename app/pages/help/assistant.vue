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
