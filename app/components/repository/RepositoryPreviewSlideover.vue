<script setup lang="ts">
import type { AcademicProductPublic, ProductType } from '~~/app/types'

const props = defineProps<{
  product: AcademicProductPublic | null
  getProductTitle: (product: AcademicProductPublic) => string
  getProductTypeLabel: (type: ProductType) => string
  getProductTypeColor: (
    type: ProductType,
  ) => 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
}>()

const open = defineModel<boolean>('open', { required: true })

const previewFileUrl = computed(() =>
  props.product ? `/api/upload/${props.product.sourceFile}/file` : '',
)
</script>

<template>
  <USlideover v-model:open="open" side="right" :ui="{ content: 'w-full max-w-lg sm:max-w-3xl' }">
    <template #header>
      <div class="flex min-w-0 items-start gap-3 pr-8">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sipac-100 text-sipac-700"
          aria-hidden="true"
        >
          <UIcon name="i-lucide-file-text" class="size-5" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-text-soft">Vista previa en el catálogo</p>
          <h3
            class="line-clamp-2 font-display text-base font-medium leading-snug text-text sm:text-lg"
          >
            {{ product ? getProductTitle(product) : 'Documento' }}
          </h3>
        </div>
      </div>
    </template>
    <template #body>
      <div v-if="product" class="space-y-4">
        <div class="flex flex-wrap gap-2">
          <UBadge :color="getProductTypeColor(product.productType)" variant="subtle" size="sm">
            {{ getProductTypeLabel(product.productType) }}
          </UBadge>
          <UBadge color="success" variant="subtle" size="sm">Confirmado</UBadge>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            :to="previewFileUrl"
            target="_blank"
            rel="noreferrer"
            size="sm"
            color="neutral"
            variant="soft"
            icon="i-lucide-external-link"
          >
            Abrir archivo en pestaña nueva
          </UButton>
        </div>
        <div class="overflow-hidden rounded-xl border border-border/70 bg-white">
          <iframe
            :src="previewFileUrl"
            title="Vista previa del documento"
            class="h-[min(72vh,560px)] w-full bg-white"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
