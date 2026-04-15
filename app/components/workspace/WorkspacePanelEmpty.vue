<script setup lang="ts">
defineProps<{
  hydratingWorkspace: boolean
}>()
</script>

<template>
  <div class="mx-auto flex max-w-xl flex-col items-center px-4 py-10 text-center sm:py-12">
    <span class="flex size-16 items-center justify-center rounded-3xl bg-sipac-50 text-sipac-700">
      <UIcon name="i-lucide-folder-search" class="size-7" aria-hidden="true" />
    </span>
    <h2
      class="mt-5 font-display text-2xl font-medium leading-[1.2] text-text sm:text-3xl sm:leading-[1.2]"
    >
      {{
        hydratingWorkspace ? 'Buscamos si dejaste algo pendiente…' : 'Sube un archivo para empezar'
      }}
    </h2>
    <p class="mt-3 text-sm leading-7 text-text-muted sm:text-base">
      {{
        hydratingWorkspace
          ? 'Si tenías un borrador, lo cargamos automáticamente en cuanto esté listo.'
          : 'Verás la vista previa, el resumen detectado y la ficha editable en esta misma página.'
      }}
    </p>
    <ul class="mt-8 w-full max-w-md space-y-3 text-left text-sm leading-6 text-text-muted">
      <li class="flex gap-3 rounded-xl border border-border/60 bg-white/80 p-3">
        <UIcon
          name="i-lucide-eye"
          class="mt-0.5 size-4 shrink-0 text-sipac-700"
          aria-hidden="true"
        />
        <span
          ><strong class="text-text">Vista previa</strong> para confirmar que es el archivo
          correcto.</span
        >
      </li>
      <li class="flex gap-3 rounded-xl border border-border/60 bg-white/80 p-3">
        <UIcon
          name="i-lucide-sparkles"
          class="mt-0.5 size-4 shrink-0 text-sipac-700"
          aria-hidden="true"
        />
        <span
          ><strong class="text-text">Datos detectados</strong> que podrás ajustar antes de
          guardar.</span
        >
      </li>
      <li class="flex gap-3 rounded-xl border border-border/60 bg-white/80 p-3">
        <UIcon
          name="i-lucide-pencil"
          class="mt-0.5 size-4 shrink-0 text-sipac-700"
          aria-hidden="true"
        />
        <span
          ><strong class="text-text">Tu corrección</strong> cuando quieras, sin salir del
          flujo.</span
        >
      </li>
    </ul>
  </div>
</template>
