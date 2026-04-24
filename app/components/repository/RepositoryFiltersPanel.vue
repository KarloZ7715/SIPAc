<script setup lang="ts">
import type { ProductType } from '~~/app/types'

interface ProductTypeOption {
  value: ProductType | undefined
  label: string
}

defineProps<{
  productTypeOptions: ProductTypeOption[]
  loading: boolean
  authorHistory: string[]
  institutionHistory: string[]
  activeFilterChips: Array<{
    key: string
    label: string
    value: string
    onRemove: () => void
  }>
}>()

const emit = defineEmits<{
  apply: []
  clear: []
}>()

const onlyMine = defineModel<boolean>('onlyMine', { required: true })
const selectedProductType = defineModel<ProductType | undefined>('productType', { required: true })
const filterTitle = defineModel<string>('title', { required: true })
const filterAuthor = defineModel<string>('author', { required: true })
const filterKeyword = defineModel<string>('keyword', { required: true })
const selectedYear = defineModel<string>('year', { required: true })
const filterDateFrom = defineModel<string>('dateFrom', { required: true })
const filterDateTo = defineModel<string>('dateTo', { required: true })
const selectedInstitution = defineModel<string>('institution', { required: true })

const maxYear = new Date().getFullYear() + 1
</script>

<template>
  <section class="panel-surface overflow-hidden p-4 sm:p-6 xl:sticky xl:top-4">
    <h2 class="mb-4 flex items-center gap-2 font-display text-sm font-medium text-text">
      <UIcon name="i-lucide-sliders-horizontal" class="size-4 text-text-soft" aria-hidden="true" />
      Refinar resultados
    </h2>

    <div class="space-y-4">
      <UFormField
        label="Solo mis aportes"
        name="repository-mine"
        class="flex items-center justify-between gap-3"
      >
        <USwitch v-model="onlyMine" aria-label="Mostrar únicamente tus productos" />
      </UFormField>

      <UFormField label="Tipo de producto" name="repository-product-type">
        <USelectMenu
          v-model="selectedProductType"
          :items="productTypeOptions"
          placeholder="Todos los tipos"
          value-key="value"
          icon="i-lucide-shapes"
          class="w-full min-w-0"
        />
      </UFormField>

      <UFormField label="Título contiene" name="repository-title-filter">
        <UInput
          v-model="filterTitle"
          placeholder="Coincidencia en título o campos afines"
          icon="i-lucide-heading"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Autor contiene" name="repository-author-filter">
        <UInput
          v-model="filterAuthor"
          placeholder="Autores, directores, inventores…"
          icon="i-lucide-user-pen"
          list="repository-author-history"
          class="w-full"
        />
        <datalist id="repository-author-history">
          <option v-for="hint in authorHistory" :key="hint" :value="hint" />
        </datalist>
      </UFormField>

      <UFormField label="Palabra clave" name="repository-keyword-filter">
        <UInput
          v-model="filterKeyword"
          placeholder="Palabras clave o áreas temáticas"
          icon="i-lucide-tags"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Año de publicación" name="repository-year">
        <UInput
          v-model="selectedYear"
          placeholder="Ej. 2026"
          type="number"
          min="1900"
          :max="maxYear"
          icon="i-lucide-calendar"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Rango de fechas" name="repository-date-from">
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <UInput v-model="filterDateFrom" type="date" class="w-full" />
          <UInput v-model="filterDateTo" type="date" class="w-full" />
        </div>
      </UFormField>

      <UFormField label="Institución" name="repository-institution">
        <UInput
          v-model="selectedInstitution"
          placeholder="Nombre de la institución"
          icon="i-lucide-building-2"
          list="repository-institution-history"
          class="w-full"
        />
        <datalist id="repository-institution-history">
          <option v-for="hint in institutionHistory" :key="hint" :value="hint" />
        </datalist>
      </UFormField>

      <div
        v-if="activeFilterChips.length"
        class="flex flex-wrap gap-2 border-t border-border/60 pt-4"
      >
        <UButton
          v-for="chip in activeFilterChips"
          :key="chip.key"
          color="neutral"
          variant="soft"
          size="xs"
          trailing-icon="i-lucide-x"
          class="rounded-full"
          @click="chip.onRemove()"
        >
          {{ chip.label }}: {{ chip.value }}
        </UButton>
      </div>

      <div class="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
        <UButton
          color="neutral"
          variant="soft"
          block
          class="sm:block sm:w-auto"
          @click="emit('clear')"
        >
          Limpiar filtros
        </UButton>
        <UButton
          color="primary"
          block
          class="sm:block sm:w-auto"
          :loading="loading"
          @click="emit('apply')"
        >
          Aplicar filtros
        </UButton>
      </div>
    </div>
  </section>
</template>
