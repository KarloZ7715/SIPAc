<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    to: string
    icon: string
    label: string
    active?: boolean
    collapsed?: boolean
    secondary?: boolean
  }>(),
  {
    active: false,
    collapsed: false,
    secondary: false,
  },
)
</script>

<template>
  <NuxtLink
    :to="props.to"
    :aria-current="props.active ? 'page' : undefined"
    :aria-label="props.collapsed ? props.label : undefined"
    :title="props.collapsed ? props.label : undefined"
    class="sidebar-nav-item group"
    :class="props.collapsed ? 'mx-auto' : 'w-full'"
    :data-active="props.active ? 'true' : 'false'"
    :data-collapsed="props.collapsed ? 'true' : 'false'"
    :data-secondary="props.secondary ? 'true' : 'false'"
  >
    <span class="sidebar-nav-item__icon" aria-hidden="true">
      <UIcon :name="props.icon" class="size-[1.05rem]" />
    </span>

    <span v-if="!props.collapsed" class="sidebar-nav-item__content">
      <span class="sidebar-nav-item__label">{{ props.label }}</span>
    </span>

    <UIcon
      v-if="!props.collapsed"
      name="i-lucide-arrow-up-right"
      class="sidebar-nav-item__arrow size-4"
      aria-hidden="true"
    />
  </NuxtLink>
</template>
