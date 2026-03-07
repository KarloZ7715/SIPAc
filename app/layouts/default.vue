<template>
  <div class="app-shell-bg min-h-screen">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:rounded-full focus:bg-sipac-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
    >
      Saltar al contenido principal
    </a>

    <UDashboardGroup storage="local" storage-key="sipac-dashboard-shell">
      <UDashboardSidebar
        collapsible
        resizable
        :min-size="18"
        :default-size="22"
        :max-size="26"
        class="border-r border-border/50 bg-white/84 backdrop-blur-md"
      >
        <template #default="{ collapsed }">
          <LayoutAppSidebar :collapsed="collapsed" />
        </template>
      </UDashboardSidebar>

      <UDashboardPanel class="min-h-screen">
        <template #header>
          <LayoutAppHeader />
        </template>

        <template #body>
          <main id="main-content" class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <slot />
          </main>
        </template>
      </UDashboardPanel>
    </UDashboardGroup>
  </div>
</template>
