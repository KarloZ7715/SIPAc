<script setup lang="ts">
definePageMeta({
  title: 'Cómo subir documentos',
})

useHead({
  title: 'Cómo subir documentos · Ayuda SIPAc',
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
      eyebrow="Guía · Subir documentos"
      title="Cómo subir y analizar documentos"
      description="Un recorrido paso a paso por el flujo de carga: qué archivos aceptamos, cómo se procesan y qué hacer si algo falla."
      icon="i-lucide-upload"
      reading-time="4 min de lectura"
    >
      <h2>Antes de empezar</h2>
      <p>
        SIPAc procesa trabajos académicos en formato <strong>PDF</strong>, <strong>PNG</strong>,
        <strong>JPG</strong>, <strong>DOCX</strong>, <strong>XLSX</strong>, <strong>PPTX</strong>,
        entre otros. Para documentos con texto embebido usamos <code>pdfjs-dist</code>; para
        documentos escaneados o imágenes aplicamos OCR automáticamente.
      </p>
      <ul>
        <li>Tamaño máximo recomendado: 20 MB por archivo.</li>
        <li>Resolución mínima para OCR: 200 DPI (texto legible a simple vista).</li>
        <li>Un archivo por trabajo académico; si son capítulos, combínalos antes de subir.</li>
      </ul>

      <h2>Paso a paso</h2>
      <ol>
        <li>
          Abre la sección <NuxtLink to="/workspace-documents" class="underline">Workspace</NuxtLink>
          desde la barra lateral.
        </li>
        <li>Arrastra tu archivo al área de carga o haz clic en <em>Seleccionar archivo</em>.</li>
        <li>
          Espera a que la barra de progreso complete el OCR y el pipeline de extracción de entidades
          (NER).
        </li>
        <li>
          Revisa las tarjetas con los campos detectados: autor, título, programa, fecha. Edita lo
          que sea necesario.
        </li>
        <li>
          Confirma el análisis para que el documento quede indexado en tu
          <NuxtLink to="/repository" class="underline">repositorio</NuxtLink>.
        </li>
      </ol>

      <h2>Qué hacer si algo falla</h2>
      <h3>El archivo no se sube</h3>
      <p>
        Verifica el tamaño y la extensión. Si el navegador bloquea la carga, prueba recargar la
        pestaña o usar una sesión sin extensiones.
      </p>

      <h3>El OCR no reconoce bien el texto</h3>
      <p>
        Suele ocurrir con escaneos oscuros o inclinados. Sube una versión mejor escaneada o
        convierte la imagen a PDF con un escáner que aplique corrección automática.
      </p>

      <h3>Faltan campos después del análisis</h3>
      <p>
        Puedes completarlos manualmente en la tarjeta del documento. SIPAc guarda tus correcciones
        para mejorar futuros análisis.
      </p>
    </SipacArticle>
  </div>
</template>
