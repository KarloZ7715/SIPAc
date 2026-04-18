<script setup lang="ts">
definePageMeta({
  title: 'Cómo organizar tu repositorio',
})

useHead({
  title: 'Cómo organizar tu repositorio · Ayuda SIPAc',
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
      eyebrow="Guía · Repositorio"
      title="Cómo organizar tu repositorio"
      description="Aprende a filtrar, etiquetar y guardar búsquedas para reutilizar consultas frecuentes."
      icon="i-lucide-library"
      reading-time="3 min de lectura"
    >
      <h2>La vista del repositorio</h2>
      <p>
        El repositorio concentra todos los documentos confirmados. Cada resultado incluye los campos
        extraídos por NER (título, autor, programa, año) y un enlace al preview con los fragmentos
        destacados.
      </p>

      <h2>Filtros rápidos</h2>
      <ul>
        <li><strong>Tipo de trabajo:</strong> artículos, monografías, tesis, ponencias.</li>
        <li><strong>Rango de años:</strong> útil para acotar por periodo académico.</li>
        <li><strong>Programa:</strong> cruza resultados por facultad o programa académico.</li>
        <li>
          <strong>Texto libre:</strong> busca por palabras clave en título, resumen o contenido.
        </li>
      </ul>

      <h2>Búsquedas guardadas</h2>
      <ol>
        <li>Configura los filtros que quieres reutilizar.</li>
        <li>
          Haz clic en <em>Guardar búsqueda</em> y asígnale un nombre descriptivo (ej.
          <em>"Tesis de Biología 2023-2025"</em>).
        </li>
        <li>
          Accede a la lista de búsquedas guardadas desde el panel lateral derecho. Un clic las
          reaplica al instante.
        </li>
      </ol>

      <h2>Buenas prácticas</h2>
      <ul>
        <li>Usa nombres de búsqueda consistentes para encontrarlas rápido.</li>
        <li>
          Revisa el preview antes de compartir un resultado: los fragmentos destacados te dicen por
          qué coincide.
        </li>
        <li>
          Si un documento tiene metadatos incorrectos, corrígelos desde su tarjeta para que el resto
          del equipo se beneficie.
        </li>
      </ul>
    </SipacArticle>
  </div>
</template>
