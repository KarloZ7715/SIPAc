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

// Map each lucide icon to a distinct micro-animation keyword.
// The actual keyframes live in main.css under `.sidebar-nav-item__icon[data-anim='…']`.
const iconAnimationMap: Record<string, string> = {
  'i-lucide-house': 'bounce',
  'i-lucide-sparkles': 'twinkle',
  'i-lucide-folder-up': 'lift',
  'i-lucide-chart-column-big': 'rise',
  'i-lucide-library-big': 'flip',
  'i-lucide-users-round': 'orbit',
  'i-lucide-shield-ellipsis': 'scan',
}

const iconAnim = computed(() => iconAnimationMap[props.icon] ?? 'pop')
</script>

<template>
  <NuxtLink
    :to="props.to"
    :aria-current="props.active ? 'page' : undefined"
    :aria-label="props.collapsed ? props.label : undefined"
    :title="props.collapsed ? props.label : undefined"
    class="sidebar-nav-item group"
    :data-active="props.active ? 'true' : 'false'"
    :data-collapsed="props.collapsed ? 'true' : 'false'"
    :data-secondary="props.secondary ? 'true' : 'false'"
  >
    <span class="sidebar-nav-item__icon" :data-anim="iconAnim" aria-hidden="true">
      <UIcon :name="props.icon" class="size-[1.05rem]" />
    </span>

    <span class="sidebar-nav-item__content" aria-hidden="true">
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
