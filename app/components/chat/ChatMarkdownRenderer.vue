<script setup lang="ts">
import { renderChatMarkdown } from '~~/app/utils/chat-markdown'
import { stripPrivateThinkingBlocks } from '~~/app/utils/chat-private-thinking'

const props = withDefaults(
  defineProps<{
    content: string
    /** assistant: lectura tipo documento; user: compacto en burbuja. */
    tone?: 'assistant' | 'user'
  }>(),
  { tone: 'assistant' },
)

const renderedHtml = computed(() => {
  const content =
    props.tone === 'assistant' ? stripPrivateThinkingBlocks(props.content) : props.content
  return renderChatMarkdown(content)
})

const rootClass = computed(() => {
  const base =
    'chat-md-root prose prose-sm max-w-none text-text prose-headings:scroll-mt-4 prose-headings:font-semibold prose-headings:text-sipac-900 prose-h1:text-2xl prose-h1:tracking-tight prose-h2:text-[1.35rem] prose-h2:tracking-tight prose-h2:border-b prose-h2:border-border/40 prose-h2:pb-2 prose-h2:mt-8 prose-h3:text-[1.15rem] prose-h3:mt-6 prose-p:leading-[1.75] prose-p:mb-5 prose-a:font-medium prose-a:text-sipac-700 prose-a:underline-offset-4 hover:prose-a:underline prose-strong:text-sipac-950 prose-strong:font-semibold prose-ul:my-4 prose-ol:my-4 prose-ul:ml-2 prose-ol:ml-2 prose-li:marker:text-sipac-400 prose-blockquote:border-l-4 prose-blockquote:border-sipac-300 prose-blockquote:bg-surface-elevated/30 prose-blockquote:px-5 prose-blockquote:py-2 prose-blockquote:text-text-muted prose-blockquote:not-italic prose-blockquote:rounded-r-xl prose-code:font-mono prose-code:text-[0.85em] prose-code:bg-surface-elevated prose-code:py-0.5 prose-code:px-1.5 prose-code:rounded-md prose-code:text-sipac-800 prose-code:before:content-none prose-code:after:content-none prose-table:border-collapse prose-table:text-sm prose-th:bg-surface-muted/30 prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:font-semibold prose-th:text-sipac-900 prose-td:border-t prose-td:border-border/40 prose-td:px-4 prose-td:py-3 prose-img:rounded-xl prose-img:shadow-sm prose-img:ring-1 prose-img:ring-border/50'
  if (props.tone === 'user') {
    return `${base} prose-p:text-text prose-p:leading-relaxed prose-p:mb-0`
  }
  return `${base} font-display prose-p:text-text/90 prose-p:leading-[1.8] prose-p:text-[1.05rem] md:prose-p:text-[1.1rem]`
})
</script>

<template>
  <!-- eslint-disable vue/no-v-html -->
  <div :class="rootClass" v-html="renderedHtml" />
  <!-- eslint-enable vue/no-v-html -->
</template>
