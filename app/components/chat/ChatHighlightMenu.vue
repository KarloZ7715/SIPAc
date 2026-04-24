<script setup lang="ts">
import { useTextSelectionMenu } from '~/composables/useTextSelectionMenu'
import { getChatCopyErrorFeedback, getChatCopySuccessFeedback } from '~/utils/chat-feedback'
import { useToast } from '#imports'

const { selectionMenuCoords, selectedText } = useTextSelectionMenu()
const toast = useToast()
const emit = defineEmits<{
  cite: [text: string]
}>()

async function copyText() {
  if (!selectedText.value) return
  try {
    await navigator.clipboard.writeText(selectedText.value)
    const feedback = getChatCopySuccessFeedback()
    toast.add({
      title: feedback.title,
      description: feedback.description,
      color: 'success',
      icon: 'i-lucide-copy-check',
    })

    // Clear selection
    window.getSelection()?.removeAllRanges()
    selectedText.value = ''
  } catch {
    const feedback = getChatCopyErrorFeedback()
    toast.add({
      title: feedback.title,
      description: feedback.description,
      color: 'error',
      icon: 'i-lucide-octagon-alert',
    })
  }
}

function citeText() {
  if (!selectedText.value) return
  emit('cite', selectedText.value)
  // Optionally, you could save it to pinia or global state to inject into composer.
  // chatStore.setCitedContext(selectedText.value) -> Depends on your architecture.

  // Clear selection
  window.getSelection()?.removeAllRanges()
  selectedText.value = ''
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pop-tooltip">
      <div
        v-if="selectedText"
        :style="{
          top: `${selectionMenuCoords.y}px`,
          left: `${selectionMenuCoords.x}px`,
          transform: 'translate(-50%, -100%)',
        }"
        class="absolute z-50 flex items-center gap-1 rounded-xl border border-white/5 bg-gray-900/80 p-1 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.1)] backdrop-blur-md"
        @mousedown.prevent
        @touchstart.prevent
      >
        <button
          class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10"
          @click="copyText"
          @touchend.stop.prevent="copyText"
        >
          Copiar
        </button>
        <button
          class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-sipac-400 transition-colors hover:bg-white/10"
          @click="citeText"
          @touchend.stop.prevent="citeText"
        >
          Citar
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pop-tooltip-enter-active,
.pop-tooltip-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.pop-tooltip-enter-from,
.pop-tooltip-leave-to {
  opacity: 0;
  transform: translate(-50%, -85%) scale(0.95);
}

@media (prefers-reduced-motion: reduce) {
  .pop-tooltip-enter-active,
  .pop-tooltip-leave-active {
    transition: none;
  }
}
</style>
