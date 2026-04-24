<script setup lang="ts">
import SipacLogoMarkEasterEgg from '~/components/brand/SipacLogoMarkEasterEgg.vue'

/* Estado vacío compacto: sin tarjetas de ejemplo (las sugerencias viven en el header y el sidebar). */
</script>

<template>
  <div
    class="chat-welcome mx-auto flex max-w-xl flex-col items-center text-center max-[380px]:max-w-[18.5rem]"
  >
    <div class="chat-welcome__logo-wrap mb-4 max-[380px]:mb-3">
      <SipacLogoMarkEasterEgg base-phase="preparing" aria-label="Animar logo de bienvenida" />
    </div>

    <h1
      class="text-balance font-display text-[1.85rem] font-medium leading-[1.18] text-text max-[380px]:text-[1.66rem] sm:text-[2rem]"
    >
      ¿Qué investigaremos hoy?
    </h1>
    <p
      class="mt-2 text-pretty text-[1.02rem] leading-[1.6] text-text-muted max-[380px]:text-[0.95rem] sm:text-lg"
    >
      Escribe abajo: autores, tema, institución, fechas o tipo de documento. El asistente revisa tus
      archivos confirmados y te muestra fragmentos útiles cuando los encuentra.
    </p>
    <p class="mt-3 text-[0.72rem] text-text-soft max-[380px]:text-[0.68rem]">
      Puedes combinar varios criterios en una sola pregunta para acotar mejor.
    </p>
  </div>
</template>

<style scoped>
.chat-welcome__logo-wrap {
  width: clamp(108px, 22vw, 148px);
  height: clamp(108px, 22vw, 148px);
}

@media (prefers-reduced-motion: reduce) {
  .chat-welcome :deep(.fade-up),
  .chat-welcome :deep(.scale-in) {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>
