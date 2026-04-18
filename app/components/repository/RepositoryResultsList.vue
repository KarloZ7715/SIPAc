<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { AcademicProductPublic, ProductType } from '~~/app/types'
import type { RepositoryViewMode } from '~~/app/composables/useRepositoryQueryState'

const props = defineProps<{
  products: AcademicProductPublic[]
  viewMode: RepositoryViewMode
  selectedIds: string[]
  getProductActions: (product: AcademicProductPublic) => DropdownMenuItem[][]
  getProductTypeLabel: (type: ProductType) => string
  getProductTypeColor: (
    type: ProductType,
  ) => 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
  getProductTitle: (product: AcademicProductPublic) => string
  getAuthors: (product: AcademicProductPublic) => string[]
  getInstitution: (product: AcademicProductPublic) => string | undefined
  getDate: (product: AcademicProductPublic) => string | undefined
  formatDate: (dateStr: string) => string
  isOwner: (product: AcademicProductPublic) => boolean
}>()

const emit = defineEmits<{
  preview: [product: AcademicProductPublic]
  'toggle-select': [productId: string]
}>()

function isSelected(product: AcademicProductPublic): boolean {
  return props.selectedIds.includes(product._id)
}
</script>

<template>
  <div v-if="viewMode === 'cards'" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
    <UCard
      v-for="product in products"
      :key="product._id"
      class="interactive-card border-border/90 bg-surface/95 shadow-[var(--shadow-whisper)] ring-1 ring-border/85"
      :ui="{
        root: 'rounded-2xl overflow-hidden h-full flex flex-col',
        body: 'p-0 flex-1 flex flex-col',
      }"
    >
      <template #header>
        <div
          class="flex items-start justify-between gap-3 border-b border-border/50 bg-white/40 px-4 py-4"
        >
          <button
            type="button"
            class="min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-sipac-500/80"
            @click="emit('preview', product)"
          >
            <UBadge :color="getProductTypeColor(product.productType)" variant="subtle" size="xs">
              {{ getProductTypeLabel(product.productType) }}
            </UBadge>
            <h3 class="mt-2 line-clamp-2 font-display text-base font-medium leading-snug text-text">
              {{ getProductTitle(product) }}
            </h3>
          </button>
          <UDropdownMenu :items="getProductActions(product)">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-ellipsis-vertical"
              size="xs"
              :aria-label="`Acciones para ${getProductTitle(product)}`"
            />
          </UDropdownMenu>
        </div>
      </template>

      <div class="flex flex-1 flex-col space-y-3 px-4 pb-4 pt-3">
        <div v-if="getAuthors(product).length" class="flex items-start gap-2">
          <UIcon
            name="i-lucide-users"
            class="mt-0.5 size-4 shrink-0 text-text-soft"
            aria-hidden="true"
          />
          <p class="line-clamp-2 text-xs leading-relaxed text-text-muted">
            {{ getAuthors(product).join(', ') }}
          </p>
        </div>

        <div v-if="getInstitution(product)" class="flex items-start gap-2">
          <UIcon
            name="i-lucide-building-2"
            class="mt-0.5 size-4 shrink-0 text-text-soft"
            aria-hidden="true"
          />
          <p class="line-clamp-1 text-xs text-text-muted">
            {{ getInstitution(product) }}
          </p>
        </div>

        <div v-if="getDate(product)" class="flex items-center gap-2">
          <UIcon
            name="i-lucide-calendar"
            class="size-4 shrink-0 text-text-soft"
            aria-hidden="true"
          />
          <p class="text-xs text-text-muted">
            {{ getDate(product) }}
          </p>
        </div>

        <div class="mt-auto flex items-center justify-between border-t border-border/60 pt-3">
          <UBadge color="success" variant="subtle" size="xs">Confirmado</UBadge>
          <p class="text-xs text-text-soft">
            {{ formatDate(product.createdAt) }}
          </p>
        </div>
      </div>
    </UCard>
  </div>

  <div
    v-else
    class="-mx-1 overflow-x-auto rounded-2xl border border-border/80 bg-surface/95 px-1 shadow-[var(--shadow-whisper)] ring-1 ring-border/70 sm:mx-0 sm:px-0"
  >
    <div
      class="grid min-w-[44rem] grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_6.5rem_6.5rem_2.75rem] gap-3 border-b border-border/70 bg-white/50 px-3 py-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-text-soft sm:min-w-0 sm:px-4"
      role="row"
    >
      <span role="columnheader">Título</span>
      <span role="columnheader">Autores / institución</span>
      <span role="columnheader" class="text-center">Tipo</span>
      <span role="columnheader" class="text-center">Propiedad</span>
      <span class="sr-only">Acciones</span>
    </div>

    <ul class="min-w-[44rem] divide-y divide-border/60 sm:min-w-0" role="list">
      <li v-for="product in products" :key="product._id" role="listitem">
        <div
          class="group grid grid-cols-1 gap-3 px-3 py-3 transition-colors focus-within:bg-sipac-50/60 hover:bg-sipac-50/40 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_6.5rem_6.5rem_2.75rem] sm:items-center sm:gap-3 sm:px-4"
          :class="viewMode === 'compact' ? 'sm:py-2' : 'sm:py-3.5'"
        >
          <div class="min-w-0 sm:col-span-1">
            <div class="flex items-start gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                :icon="isSelected(product) ? 'i-lucide-check-square' : 'i-lucide-square'"
                :aria-label="
                  isSelected(product) ? 'Deseleccionar documento' : 'Seleccionar documento'
                "
                :aria-pressed="isSelected(product)"
                @click.stop="emit('toggle-select', product._id)"
              />
              <button
                type="button"
                class="block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-sipac-500/80"
                @click="emit('preview', product)"
              >
                <p
                  class="font-display font-medium leading-snug text-text group-hover:text-sipac-800"
                  :class="viewMode === 'compact' ? 'text-xs' : 'text-sm'"
                >
                  {{ getProductTitle(product) }}
                </p>
                <p v-if="getDate(product)" class="mt-0.5 text-xs text-text-soft">
                  {{ getDate(product) }}
                </p>
              </button>
            </div>
          </div>

          <div
            class="min-w-0 leading-relaxed text-text-muted sm:col-span-1"
            :class="viewMode === 'compact' ? 'text-[0.7rem]' : 'text-xs'"
          >
            <p v-if="getAuthors(product).length" class="line-clamp-2">
              {{ getAuthors(product).join(', ') }}
            </p>
            <p v-if="getInstitution(product)" class="mt-0.5 line-clamp-1 text-text-soft">
              {{ getInstitution(product) }}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2 sm:justify-center">
            <UBadge :color="getProductTypeColor(product.productType)" variant="subtle" size="xs">
              {{ getProductTypeLabel(product.productType) }}
            </UBadge>
          </div>

          <div class="flex items-center sm:justify-center">
            <UBadge :color="isOwner(product) ? 'primary' : 'neutral'" variant="subtle" size="xs">
              {{ isOwner(product) ? 'Tuyo' : 'Otro autor' }}
            </UBadge>
          </div>

          <div class="flex justify-end sm:justify-center">
            <UDropdownMenu :items="getProductActions(product)">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-ellipsis-vertical"
                size="xs"
                :aria-label="`Acciones para ${getProductTitle(product)}`"
              />
            </UDropdownMenu>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
