<script setup lang="ts">
/**
 * Pie de chat: aviso honesto, atajos y enlaces útiles (lenguaje claro para docentes).
 */
</script>

<template>
  <footer
    class="shrink-0 px-2 py-1.5 text-[0.65rem] tracking-tight leading-tight text-text-muted/70 pb-2 flex justify-center text-center opacity-80 hover:opacity-100 transition-opacity"
    role="contentinfo"
  >
    <div
      class="flex flex-col sm:flex-row items-center justify-center gap-x-3 gap-y-1 w-full max-w-4xl mx-auto"
    >
      <span class="inline-flex items-center gap-1">
        <UIcon name="i-lucide-shield-alert" class="size-3 shrink-0" aria-hidden="true" />
        <span> El asistente puede equivocarse. Comprueba siempre la información original. </span>
      </span>
      <span class="hidden h-3 w-px bg-border/40 sm:block" aria-hidden="true" />
      <span class="inline-flex items-center gap-1">
        <span>Enter: enviar · Shift+Enter: salto · Esc: detener</span>
      </span>
    </div>
  </footer>
</template>
