<script setup lang="ts">
import { renderChatMarkdown } from '~~/app/utils/chat-markdown'

const props = defineProps<{
  content: string
}>()

const renderedHtml = computed(() => renderChatMarkdown(props.content))
</script>

<template>
  <!-- eslint-disable vue/no-v-html -->
  <div
    class="prose prose-sm max-w-none text-text prose-p:leading-7 prose-headings:mb-3 prose-headings:mt-5 prose-ul:my-3 prose-ol:my-3"
    v-html="renderedHtml"
  />
  <!-- eslint-enable vue/no-v-html -->
</template>
