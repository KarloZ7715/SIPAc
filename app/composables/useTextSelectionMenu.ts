import { ref, onMounted, onUnmounted } from 'vue'

export function useTextSelectionMenu() {
  const selectionMenuCoords = ref({ x: 0, y: 0 })
  const selectedText = ref('')

  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const handleSelection = () => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) {
        selectedText.value = ''
        return
      }

      const anchorNode = selection.anchorNode
      if (anchorNode?.parentElement?.closest('input, textarea')) {
        selectedText.value = ''
        return
      }

      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      selectionMenuCoords.value = {
        x: rect.left + rect.width / 2,
        y: Math.max(10, rect.top + window.scrollY - 10),
      }

      selectedText.value = selection.toString().trim()
    }, 150)
  }

  onMounted(() => document.addEventListener('selectionchange', handleSelection))
  onUnmounted(() => {
    if (timeoutId) clearTimeout(timeoutId)
    document.removeEventListener('selectionchange', handleSelection)
  })

  return { selectionMenuCoords, selectedText }
}
