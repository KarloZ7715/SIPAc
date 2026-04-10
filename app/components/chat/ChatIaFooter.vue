<script setup lang="ts">
/**
 * Pie de chat: aviso honesto, atajos y enlaces útiles (lenguaje claro para docentes).
 */
</script>

<template>
  <footer
    class="shrink-0 border-t border-border/45 bg-surface-muted/20 px-3 py-2 text-[0.7rem] leading-snug text-text-muted sm:px-4 sm:py-2.5"
    role="contentinfo"
  >
    <div
      class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-1.5"
    >
      <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span class="inline-flex min-w-0 items-center gap-1.5">
          <UIcon
            name="i-lucide-shield-check"
            class="size-3.5 shrink-0 text-sipac-600"
            aria-hidden="true"
          />
          <span class="max-w-prose text-pretty">
            El asistente puede equivocarse. Comprueba siempre la información en el archivo original.
          </span>
        </span>
        <span class="hidden h-3 w-px bg-border/70 sm:block" aria-hidden="true" />
        <span class="inline-flex items-center gap-1 text-text-soft">
          <UIcon name="i-lucide-keyboard" class="size-3.5 shrink-0 opacity-80" aria-hidden="true" />
          <span>Enter envía · Mayús+Enter nueva línea · Esc detiene</span>
        </span>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 sm:justify-end">
        <NuxtLink
          to="/workspace-documents"
          class="font-medium text-sipac-700 underline-offset-2 hover:underline"
        >
          Tus documentos
        </NuxtLink>
        <span class="text-border/80" aria-hidden="true">·</span>
        <NuxtLink to="/" class="text-text-soft underline-offset-2 hover:text-text hover:underline">
          Inicio
        </NuxtLink>
        <span class="text-border/80" aria-hidden="true">·</span>
        <NuxtLink
          to="/profile"
          class="text-text-soft underline-offset-2 hover:text-text hover:underline"
        >
          Perfil
        </NuxtLink>
      </div>
    </div>
  </footer>
</template>
