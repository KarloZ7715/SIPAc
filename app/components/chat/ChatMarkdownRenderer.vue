<script setup lang="ts">
import { renderChatMarkdown } from '~~/app/utils/chat-markdown'

const props = withDefaults(
  defineProps<{
    content: string
    /** assistant: lectura tipo documento; user: compacto en burbuja. */
    tone?: 'assistant' | 'user'
  }>(),
  { tone: 'assistant' },
)

const renderedHtml = computed(() => renderChatMarkdown(props.content))

const rootClass = computed(() => {
  const base =
    'chat-md-root prose prose-sm max-w-none text-text prose-headings:scroll-mt-4 prose-headings:font-semibold prose-headings:text-text prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:leading-7 prose-a:font-medium prose-a:text-sipac-700 prose-a:underline-offset-2 hover:prose-a:underline prose-strong:text-text prose-strong:font-semibold prose-ul:my-3 prose-ol:my-3 prose-li:marker:text-sipac-600 prose-blockquote:border-sipac-300 prose-blockquote:text-text-muted'
  if (props.tone === 'user') {
    return `${base} prose-p:text-text prose-p:leading-relaxed`
  }
  return `${base} font-display prose-p:text-text/92 prose-p:leading-[1.65]`
})
</script>

<template>
  <!-- eslint-disable vue/no-v-html -->
  <div :class="rootClass" v-html="renderedHtml" />
  <!-- eslint-enable vue/no-v-html -->
</template>
