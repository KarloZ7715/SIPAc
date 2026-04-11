<script setup lang="ts">
import type { ProductType } from '~~/app/types'
import type { MetadataFieldConfig } from '~~/app/utils/product-metadata-layout'

const selectedProductType = defineModel<ProductType>('productType', { required: true })

defineProps<{
  productTypeOptions: Array<{ label: string; value: ProductType }>
  groupedSpecificFields: Array<{ group: string; fields: MetadataFieldConfig[] }>
  getSubtypeFieldName: (field: MetadataFieldConfig) => string
  getSubtypeFieldValue: (field: MetadataFieldConfig) => string | boolean
  setSubtypeFieldValue: (field: MetadataFieldConfig, value: string | boolean) => void
  getFieldClass: (field: MetadataFieldConfig) => string
}>()

const emit = defineEmits<{
  fieldFocus: [key: string | null]
}>()

const {
  titleInput,
  authorsInput,
  yearInput,
  institutionInput,
  doiInput,
  keywordsInput,
  notesInput,
} = useWorkspaceMetadataInputs()
</script>

<template>
  <div class="@container/metadata-form grid grid-cols-1 gap-4 @lg/metadata-form:grid-cols-2">
    <div class="@lg/metadata-form:col-span-2">
      <p class="section-chip">Datos generales</p>
      <p class="mt-1 text-sm leading-6 text-text-muted">
        Título, autores y metadatos comunes. Los campos específicos del tipo aparecen más abajo.
      </p>
    </div>

    <UFormField label="Tipo de producto" name="productTypeEditable">
      <USelect
        v-model="selectedProductType"
        :items="productTypeOptions"
        color="neutral"
        variant="outline"
        class="w-full"
      />
    </UFormField>

    <UFormField label="Año" name="year">
      <UInput
        v-model="yearInput"
        color="neutral"
        variant="outline"
        name="year"
        inputmode="numeric"
        placeholder="2026…"
        class="w-full"
        @focus="emit('fieldFocus', 'year')"
      />
    </UFormField>

    <UFormField label="Título" name="title" class="@lg/metadata-form:col-span-2">
      <UInput
        v-model="titleInput"
        color="neutral"
        variant="outline"
        name="title"
        autocomplete="off"
        placeholder="Título del documento…"
        class="w-full"
        @focus="emit('fieldFocus', 'title')"
      />
    </UFormField>

    <UFormField label="Autores" name="authors" class="@lg/metadata-form:col-span-2">
      <UTextarea
        v-model="authorsInput"
        color="neutral"
        variant="outline"
        name="authors"
        autocomplete="off"
        :rows="4"
        placeholder="Separa cada autor con coma o salto de línea…"
        class="w-full"
        @focus="emit('fieldFocus', 'authors')"
      />
    </UFormField>

    <UFormField label="Institución" name="institution">
      <UInput
        v-model="institutionInput"
        color="neutral"
        variant="outline"
        name="institution"
        autocomplete="organization"
        placeholder="Universidad de Córdoba…"
        class="w-full"
        @focus="emit('fieldFocus', 'institution')"
      />
    </UFormField>

    <UFormField label="DOI o referencia" name="doi">
      <UInput
        v-model="doiInput"
        color="neutral"
        variant="outline"
        name="doi"
        autocomplete="off"
        inputmode="url"
        placeholder="10.123/ejemplo.2026.001…"
        class="w-full"
        @focus="emit('fieldFocus', 'doi')"
      />
    </UFormField>

    <UFormField label="Palabras clave" name="keywords" class="@lg/metadata-form:col-span-2">
      <UTextarea
        v-model="keywordsInput"
        color="neutral"
        variant="outline"
        name="keywords"
        autocomplete="off"
        :rows="3"
        placeholder="innovación educativa, investigación, universidad…"
        class="w-full"
        @focus="emit('fieldFocus', 'keywords')"
      />
    </UFormField>

    <UFormField label="Notas" name="notes" class="@lg/metadata-form:col-span-2">
      <UTextarea
        v-model="notesInput"
        color="neutral"
        variant="outline"
        name="notes"
        autocomplete="off"
        :rows="3"
        placeholder="Añade una aclaración útil para la revisión final…"
        class="w-full"
        @focus="emit('fieldFocus', null)"
      />
    </UFormField>

    <template v-if="groupedSpecificFields.length">
      <div class="h-px bg-border/80 @lg/metadata-form:col-span-2" />

      <div class="@lg/metadata-form:col-span-2">
        <p class="section-chip">Según el tipo de producto</p>
      </div>

      <template v-for="group in groupedSpecificFields" :key="group.group">
        <div class="mt-1 @lg/metadata-form:col-span-2">
          <h3 class="text-xs font-semibold tracking-[0.12em] text-text-soft uppercase">
            {{ group.group }}
          </h3>
        </div>

        <UFormField
          v-for="field in group.fields"
          :key="field.id"
          :label="field.label"
          :name="getSubtypeFieldName(field)"
          :class="getFieldClass(field)"
        >
          <UTextarea
            v-if="field.control === 'textarea'"
            :model-value="String(getSubtypeFieldValue(field))"
            color="neutral"
            variant="outline"
            :name="getSubtypeFieldName(field)"
            autocomplete="off"
            :rows="field.rows ?? 2"
            :placeholder="field.placeholder"
            class="w-full"
            @update:model-value="setSubtypeFieldValue(field, $event)"
          />

          <USelect
            v-else-if="field.control === 'select'"
            :model-value="String(getSubtypeFieldValue(field))"
            :items="field.options ?? []"
            color="neutral"
            variant="outline"
            class="w-full"
            @update:model-value="setSubtypeFieldValue(field, $event)"
          />

          <USwitch
            v-else-if="field.control === 'switch'"
            :model-value="Boolean(getSubtypeFieldValue(field))"
            color="primary"
            :name="getSubtypeFieldName(field)"
            @update:model-value="setSubtypeFieldValue(field, $event)"
          />

          <UInput
            v-else
            :model-value="String(getSubtypeFieldValue(field))"
            color="neutral"
            variant="outline"
            :name="getSubtypeFieldName(field)"
            :type="
              field.control === 'date' ? 'date' : field.control === 'number' ? 'number' : 'text'
            "
            :inputmode="field.control === 'number' ? 'numeric' : undefined"
            :placeholder="field.placeholder"
            class="w-full"
            @update:model-value="setSubtypeFieldValue(field, $event)"
          />
        </UFormField>
      </template>
    </template>
  </div>
</template>
