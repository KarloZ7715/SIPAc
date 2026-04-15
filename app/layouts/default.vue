<script setup lang="ts">
const mobileSidebarOpen = useState<boolean>('sipac-mobile-sidebar-open', () => false)
const desktopSidebarCollapsed = useState<boolean>('sipac-desktop-sidebar-collapsed', () => false)
const layoutHydrated = ref(false)
const route = useRoute()
const isChatRoute = computed(() => route.path.startsWith('/chat'))
const isWorkspaceDocumentsRoute = computed(() => route.path === '/workspace-documents')
const isWideWorkspaceRoute = computed(
  () => route.path === '/' || route.path === '/dashboard' || isWorkspaceDocumentsRoute.value,
)
const contentWidthClass = computed(() => {
  if (isChatRoute.value) {
    return 'max-w-none w-full'
  }
  if (isWideWorkspaceRoute.value) {
    return 'max-w-[96rem] xl:px-10'
  }
  return 'max-w-[75rem]'
})
const contentSpacingClass = computed(() => {
  if (isChatRoute.value) {
    return 'py-0'
  }
  if (isWideWorkspaceRoute.value) {
    return 'py-4 lg:py-5'
  }
  return 'py-5 lg:py-6'
})
const mainHorizontalPaddingClass = computed(() =>
  isChatRoute.value ? 'px-3 sm:px-4 lg:px-5' : 'px-4 sm:px-6 lg:px-8',
)
const chatMainLayoutClass = computed(() =>
  isChatRoute.value ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : '',
)

/** En /chat el shell ocupa el viewport y no añade scroll de página; el hilo hace overflow interno. */
const shellRootClass = computed(() =>
  isChatRoute.value
    ? 'app-shell-bg flex h-dvh max-h-dvh flex-col overflow-hidden'
    : 'app-shell-bg min-h-screen',
)

const mobileStackClass = computed(() =>
  isChatRoute.value ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : '',
)

const desktopDashboardClass = computed(() =>
  isChatRoute.value ? 'hidden min-h-0 flex-1 flex-col overflow-hidden lg:flex' : 'hidden lg:block',
)

const dashboardPanelClass = computed(() =>
  isChatRoute.value ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'min-h-screen',
)

/** Solo en /chat se encadena altura fija y sin scroll del panel; el resto conserva scroll natural del documento. */
const dashboardGroupClass = computed(() =>
  isChatRoute.value ? 'flex h-full min-h-0 min-w-0 flex-1' : '',
)

const dashboardPanelUi = computed(() =>
  isChatRoute.value
    ? {
        root: 'flex min-h-0 flex-1 flex-col overflow-hidden',
        body: 'flex min-h-0 flex-1 flex-col overflow-hidden',
      }
    : {},
)

watch(
  () => route.fullPath,
  () => {
    mobileSidebarOpen.value = false
  },
)

onMounted(() => {
  layoutHydrated.value = true
})
</script>

<template>
  <div :class="shellRootClass">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:rounded-full focus:bg-sipac-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#faf9f5]"
    >
      Saltar al contenido principal
    </a>

    <div class="lg:hidden" :class="mobileStackClass">
      <LayoutAppHeader />
      <main
        id="main-content"
        class="mx-auto w-full"
        :class="[
          mainHorizontalPaddingClass,
          contentWidthClass,
          contentSpacingClass,
          chatMainLayoutClass,
          isChatRoute ? 'min-h-0 flex-1' : '',
        ]"
      >
        <slot />
      </main>

      <USlideover
        v-model:open="mobileSidebarOpen"
        side="left"
        :overlay="true"
        :ui="{
          content: 'max-w-[18.5rem] border-r border-border/80 bg-surface/98 backdrop-blur-xl',
        }"
      >
        <template #body>
          <div class="h-full overflow-y-auto">
            <LayoutAppSidebar mobile />
          </div>
        </template>
      </USlideover>
    </div>

    <div :class="desktopDashboardClass">
      <UDashboardGroup
        v-if="layoutHydrated"
        storage="local"
        storage-key="sipac-dashboard-shell"
        unit="rem"
        :class="dashboardGroupClass"
      >
        <UDashboardSidebar
          v-model:collapsed="desktopSidebarCollapsed"
          collapsible
          resizable
          :min-size="16.5"
          :default-size="18.5"
          :max-size="24"
          :collapsed-size="5.75"
          :ui="{
            root: 'relative hidden lg:flex flex-col min-h-svh min-w-16 w-(--width) shrink-0 transition-[width] duration-300 ease-[var(--ease-sipac)]',
            header: 'h-auto shrink-0 px-1.5 pt-1.5',
            body: 'flex flex-col gap-4 flex-1 overflow-x-hidden overflow-y-auto px-1.5 py-1.5',
            footer: 'shrink-0 px-1.5 pb-1.5 pt-0',
          }"
          class="sipac-dashboard-sidebar overflow-hidden border-r border-border/70 bg-surface/90 backdrop-blur-md"
        >
          <template #default="{ collapsed }">
            <LayoutAppSidebar :collapsed="collapsed" />
          </template>
        </UDashboardSidebar>

        <UDashboardPanel :class="dashboardPanelClass" :ui="dashboardPanelUi">
          <template #header>
            <LayoutAppHeader />
          </template>

          <template #body>
            <main
              id="main-content"
              class="mx-auto w-full"
              :class="[
                mainHorizontalPaddingClass,
                contentWidthClass,
                contentSpacingClass,
                chatMainLayoutClass,
                isChatRoute ? 'min-h-0 flex-1' : '',
              ]"
            >
              <slot />
            </main>
          </template>
        </UDashboardPanel>
      </UDashboardGroup>
      <div v-else class="hidden min-h-0 flex-1 lg:flex">
        <aside
          class="sipac-dashboard-sidebar hidden min-h-svh w-[18.5rem] shrink-0 border-r border-border/70 bg-surface/90 backdrop-blur-md lg:flex"
        />
        <div class="flex min-h-0 flex-1 flex-col">
          <LayoutAppHeader />
          <main
            id="main-content"
            class="mx-auto w-full"
            :class="[
              mainHorizontalPaddingClass,
              contentWidthClass,
              contentSpacingClass,
              chatMainLayoutClass,
              isChatRoute ? 'min-h-0 flex-1' : '',
            ]"
          >
            <slot />
          </main>
        </div>
      </div>
    </div>
  </div>
</template>
