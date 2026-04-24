<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  thinkingText: string
  isStreaming?: boolean
}>()

const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)

// Auto-expand during streaming if it's new
watch(
  () => props.isStreaming,
  (streaming) => {
    if (streaming && !isOpen.value && props.thinkingText.length > 0) {
      isOpen.value = true
    }
  },
  { immediate: true },
)

// Auto-collapse after streaming finishes if user didn't explicitly toggle
watch(
  () => props.isStreaming,
  (streaming, oldStreaming) => {
    if (oldStreaming && !streaming) {
      isOpen.value = false
    }
  },
)

function toggle() {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div
    v-if="thinkingText.length > 0"
    class="group/think mb-4 overflow-hidden rounded-2xl border border-sipac-200/40 bg-surface-muted/20 transition-colors duration-300 hover:bg-surface-muted/30"
  >
    <button
      type="button"
      class="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-sipac-500 focus:ring-offset-2"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <div
        class="flex size-6 items-center justify-center rounded-lg bg-surface-elevated text-text-soft shadow-sm ring-1 ring-border/50 transition-colors group-hover/think:text-text"
      >
        <UIcon
          :name="isStreaming ? 'i-lucide-brain-circuit' : 'i-lucide-brain'"
          class="size-3.5 transition-all duration-300"
          :class="isStreaming ? 'animate-pulse text-sipac-600' : ''"
        />
      </div>
      <div class="flex-1">
        <span
          class="font-display text-sm font-medium text-text-soft transition-colors group-hover/think:text-text"
        >
          {{ isStreaming ? 'Pensando...' : 'Proceso de pensamiento' }}
        </span>
      </div>
      <UIcon
        name="i-lucide-chevron-down"
        class="size-4 text-text-soft transition-transform duration-300"
        :class="isOpen ? 'rotate-180 transform' : ''"
      />
    </button>

    <div
      class="grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
      :class="isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
    >
      <div class="overflow-hidden">
        <div ref="containerRef" class="px-4 pb-4 pt-1">
          <div
            class="prose prose-sm max-w-none text-text-muted prose-p:leading-relaxed prose-p:text-[0.9rem] prose-p:text-text-soft border-l-2 border-sipac-200/60 pl-3 italic"
          >
            <span class="whitespace-pre-wrap">{{ thinkingText.trim() }}</span>
            <span
              v-if="isStreaming"
              class="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-sipac-400 align-middle"
            ></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
