<script setup lang="ts">
defineProps<{
  show: boolean
}>()
</script>

<template>
  <Transition name="dock-pop">
    <div
      v-if="show"
      class="absolute bottom-full left-0 mb-3 ml-2 flex items-center gap-2 overflow-hidden rounded-2xl border border-white/10 bg-earth-50/60 px-3 py-1.5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.02)] backdrop-blur-xl z-10"
    >
      <slot name="indicators" />
    </div>
  </Transition>
</template>

<style scoped>
.dock-pop-enter-active,
.dock-pop-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.dock-pop-enter-from,
.dock-pop-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.95);
}

@media (prefers-reduced-motion: reduce) {
  .dock-pop-enter-active,
  .dock-pop-leave-active {
    transition: none;
  }
}
</style>
