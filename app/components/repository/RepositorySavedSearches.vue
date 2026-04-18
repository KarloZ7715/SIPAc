<script setup lang="ts">
import type { SavedSearch } from '~~/app/composables/useRepositorySavedSearches'

defineProps<{
  savedSearches: SavedSearch[]
  canSave: boolean
}>()

const emit = defineEmits<{
  save: [name: string]
  load: [search: SavedSearch]
  remove: [id: string]
}>()

const showSaveInput = ref(false)
const draftName = ref('')

function commitSave() {
  const name = draftName.value.trim()
  if (!name) return
  emit('save', name)
  draftName.value = ''
  showSaveInput.value = false
}

function cancelSave() {
  draftName.value = ''
  showSaveInput.value = false
}
</script>

<template>
  <div
    class="panel-surface flex flex-col gap-3 p-3 sm:p-4"
    aria-label="Búsquedas guardadas del catálogo"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs font-semibold tracking-[0.12em] text-text-soft uppercase">
        Búsquedas guardadas
      </p>
      <UButton
        v-if="!showSaveInput"
        color="neutral"
        variant="soft"
        size="xs"
        icon="i-lucide-bookmark-plus"
        :disabled="!canSave"
        @click="showSaveInput = true"
      >
        Guardar actual
      </UButton>
    </div>

    <div v-if="showSaveInput" class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <UInput
        v-model="draftName"
        placeholder="Ej. Tesis de Ingeniería 2024"
        icon="i-lucide-bookmark"
        class="flex-1"
        autofocus
        @keydown.enter="commitSave"
        @keydown.esc="cancelSave"
      />
      <div class="flex gap-2">
        <UButton color="primary" size="sm" :disabled="!draftName.trim()" @click="commitSave">
          Guardar
        </UButton>
        <UButton color="neutral" variant="soft" size="sm" @click="cancelSave"> Cancelar </UButton>
      </div>
    </div>

    <p v-if="!savedSearches.length" class="text-xs text-text-soft">
      No tienes búsquedas guardadas. Aplica filtros útiles y pulsa
      <span class="font-medium text-text">Guardar actual</span>.
    </p>

    <ul v-else class="flex flex-wrap gap-2" role="list">
      <li
        v-for="search in savedSearches"
        :key="search.id"
        class="flex items-center gap-1 rounded-full border border-border/70 bg-white/70 py-1 pr-1 pl-3"
      >
        <button
          type="button"
          class="text-xs font-medium text-text outline-none hover:text-sipac-700 focus-visible:ring-2 focus-visible:ring-sipac-500/80"
          :aria-label="`Cargar búsqueda guardada ${search.name}`"
          @click="emit('load', search)"
        >
          {{ search.name }}
        </button>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-x"
          :aria-label="`Eliminar búsqueda guardada ${search.name}`"
          @click="emit('remove', search.id)"
        />
      </li>
    </ul>
  </div>
</template>
