<script setup lang="ts">
const route = useRoute()
const {
  pageTransition,
  isPageTransitionActive,
  visibleRoutePath,
  syncVisibleRoute,
  syncLayoutRoute,
} = usePageMotion()

function syncPageTransitionRootState(active: boolean) {
  if (!import.meta.client) {
    return
  }

  applyPageTransitionRootState(document.documentElement, active)
  applyPageTransitionRootState(document.body, active)
}

watch(
  isPageTransitionActive,
  (active) => {
    syncPageTransitionRootState(active)
  },
  { immediate: true },
)

// Fallback for route changes that don't trigger a page transition
// (e.g. query parameter changes on the same path)
watch(
  () => route.fullPath,
  () => {
    if (!isPageTransitionActive.value && route.path === visibleRoutePath.value) {
      syncVisibleRoute()
      syncLayoutRoute()
    }
  },
)
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage :transition="pageTransition" />
    </NuxtLayout>
  </UApp>
</template>
