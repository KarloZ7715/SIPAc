<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title: string
  description?: string
  icon?: string
  readingTime?: string
}>()
</script>

<template>
  <article
    class="panel-surface paper-texture relative overflow-hidden px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10"
  >
    <header class="max-w-3xl space-y-4">
      <div v-if="eyebrow || readingTime" class="flex flex-wrap items-center gap-3">
        <p
          v-if="eyebrow"
          class="text-[0.72rem] font-semibold tracking-[0.22em] text-sipac-700 uppercase"
        >
          {{ eyebrow }}
        </p>
        <span
          v-if="readingTime"
          class="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-xs text-text-muted"
        >
          <UIcon name="i-lucide-clock" class="size-3.5" />
          {{ readingTime }}
        </span>
      </div>

      <div class="flex items-start gap-4">
        <span
          v-if="icon"
          class="flex size-10 shrink-0 items-center justify-center rounded-3xl bg-white/85 text-sipac-700 shadow-[0_4px_24px_rgba(0,0,0,0.06)] ring-1 ring-border/80 sm:size-12"
        >
          <UIcon :name="icon" class="size-6" />
        </span>
        <div class="min-w-0 space-y-3">
          <h1
            class="font-display text-[1.5rem] font-medium leading-[1.15] text-text sm:text-[1.875rem] md:text-[2.25rem] sm:leading-[1.2]"
          >
            {{ title }}
          </h1>
          <p
            v-if="description"
            class="max-w-3xl text-base leading-[1.6] text-text-muted sm:text-lg"
          >
            {{ description }}
          </p>
        </div>
      </div>
    </header>

    <div
      class="sipac-article-body mt-8 max-w-3xl space-y-5 text-base leading-[1.7] text-text-muted"
    >
      <slot />
    </div>
  </article>
</template>

<style scoped>
.sipac-article-body :deep(h2) {
  margin-top: 2rem;
  font-family: var(--font-display, inherit);
  font-size: 1.5rem;
  font-weight: 500;
  line-height: 1.25;
  color: var(--color-text, inherit);
}

.sipac-article-body :deep(h3) {
  margin-top: 1.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text, inherit);
}

.sipac-article-body :deep(p) {
  margin: 0;
}

.sipac-article-body :deep(ul),
.sipac-article-body :deep(ol) {
  padding-left: 1.25rem;
  list-style-position: outside;
}

.sipac-article-body :deep(ul) {
  list-style: disc;
}

.sipac-article-body :deep(ol) {
  list-style: decimal;
}

.sipac-article-body :deep(li + li) {
  margin-top: 0.35rem;
}

.sipac-article-body :deep(code) {
  padding: 0.1rem 0.4rem;
  border-radius: 0.4rem;
  background: var(--color-surface-muted, #f3efe7);
  font-size: 0.92em;
}
</style>
