<script setup lang="ts">
import type { RepositorySortBy } from '~~/app/stores/documents'
import type { RepositoryViewMode } from '~~/app/composables/useRepositoryQueryState'

interface ViewModeOption {
  value: RepositoryViewMode
  label: string
  icon: string
}

interface SortByOption {
  value: RepositorySortBy
  label: string
}

interface PageSizeOption {
  value: number
  label: string
}

defineProps<{
  viewModeOptions: ViewModeOption[]
  sortByOptions: SortByOption[]
  pageSizeOptions: PageSizeOption[]
}>()

const emit = defineEmits<{
  'change-page-size': [value: unknown]
}>()

const viewMode = defineModel<RepositoryViewMode>('viewMode', { required: true })
const sortBy = defineModel<RepositorySortBy>('sortBy', { required: true })
const pageLimit = defineModel<number>('pageLimit', { required: true })
</script>

<template>
  <div
    class="panel-surface flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:p-4"
  >
    <div
      class="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Modo de presentación de resultados"
    >
      <span class="text-xs font-medium text-text-soft">Vista</span>
      <div class="flex flex-wrap gap-1">
        <UButton
          v-for="opt in viewModeOptions"
          :key="opt.value"
          :color="viewMode === opt.value ? 'primary' : 'neutral'"
          :variant="viewMode === opt.value ? 'soft' : 'ghost'"
          size="sm"
          class="rounded-lg"
          :icon="opt.icon"
          :aria-pressed="viewMode === opt.value"
          @click="viewMode = opt.value"
        >
          {{ opt.label }}
        </UButton>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2 sm:justify-end">
      <label class="text-xs font-medium text-text-soft" for="repository-sort-by">Ordenar por</label>
      <USelectMenu
        id="repository-sort-by"
        v-model="sortBy"
        :items="sortByOptions"
        value-key="value"
        size="sm"
        class="min-w-[12rem]"
      />
      <label class="text-xs font-medium text-text-soft" for="repository-page-size"
        >Por página</label
      >
      <USelectMenu
        id="repository-page-size"
        :model-value="pageLimit"
        :items="pageSizeOptions"
        value-key="value"
        size="sm"
        class="min-w-[5.5rem]"
        @update:model-value="(value) => emit('change-page-size', value)"
      />
    </div>
  </div>
</template>
