<script setup lang="ts">
interface ProfileTabItem {
  id: string
  label: string
  icon: string
  description?: string
}

const props = defineProps<{
  tabs: ProfileTabItem[]
  modelValue: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

function select(id: string) {
  if (id !== props.modelValue) {
    emit('update:modelValue', id)
  }
}
</script>

<template>
  <nav
    class="sticky top-[calc(var(--app-header-height,4rem)+0.35rem)] z-10 mx-0 flex gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-parchment/92 px-1.5 py-1.5 scroll-px-2 backdrop-blur-md shadow-[0_12px_32px_-28px_rgb(20_20_19/0.22)] max-[380px]:rounded-xl max-[380px]:px-1.5 max-[380px]:py-1 sm:-mx-3 sm:px-3 sm:py-2 scrollbar-none"
    aria-label="Secciones del perfil"
  >
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      role="tab"
      :aria-selected="modelValue === tab.id"
      :aria-controls="`profile-panel-${tab.id}`"
      class="group relative inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-1.5 text-[0.72rem] font-medium transition-[background-color,color,box-shadow] duration-200 ease-[var(--ease-sipac)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sipac-400 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment max-[380px]:gap-1 max-[380px]:rounded-lg max-[380px]:px-1.5 max-[380px]:py-[0.3125rem] max-[380px]:text-[0.68rem] sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
      :class="
        modelValue === tab.id
          ? 'bg-sipac-600 text-white shadow-[0_10px_24px_-18px_rgb(155_70_40/0.55)]'
          : 'text-text-muted hover:bg-white/70 hover:text-text'
      "
      @click="select(tab.id)"
    >
      <UIcon :name="tab.icon" class="size-3 max-[380px]:size-[0.8rem] sm:size-4" />
      <span class="whitespace-nowrap">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.scrollbar-none {
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
</style>
