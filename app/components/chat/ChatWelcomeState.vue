<script setup lang="ts">
import SipacLogoMarkEasterEgg from '~/components/brand/SipacLogoMarkEasterEgg.vue'

/* Estado vacío compacto: sin tarjetas de ejemplo (las sugerencias viven en el header y el sidebar). */
</script>

<template>
  <div class="chat-welcome mx-auto flex max-w-xl flex-col items-center text-center">
    <div class="chat-welcome__logo-wrap mb-4 scale-in">
      <SipacLogoMarkEasterEgg base-phase="preparing" aria-label="Animar logo de bienvenida" />
    </div>

    <h1
      class="fade-up text-balance font-display text-2xl font-medium leading-[1.2] text-text sm:text-[2rem]"
    >
      ¿Qué investigaremos hoy?
    </h1>
    <p
      class="fade-up stagger-1 mt-2 text-pretty text-base leading-[1.6] text-text-muted sm:text-lg"
    >
      Escribe abajo: autores, tema, institución, fechas o tipo de documento. El asistente revisa tus
      archivos confirmados y te muestra fragmentos útiles cuando los encuentra.
    </p>
    <p class="mt-3 text-[0.75rem] text-text-soft">
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
