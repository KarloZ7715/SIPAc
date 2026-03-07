<script setup lang="ts">
const visible = ref(false)

const props = withDefaults(
  defineProps<{
    modelValue?: string
    name?: string
    placeholder?: string
    autocomplete?: string
    disabled?: boolean
    color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
    variant?: 'outline' | 'soft' | 'subtle' | 'ghost' | 'none'
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    icon?: string
    class?: string
  }>(),
  {
    modelValue: '',
    name: undefined,
    placeholder: undefined,
    autocomplete: undefined,
    disabled: false,
    color: 'neutral',
    variant: 'outline',
    size: undefined,
    icon: undefined,
    class: undefined,
  },
)

defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputType = computed(() => (visible.value ? 'text' : 'password'))
const toggleLabel = computed(() => (visible.value ? 'Ocultar contraseña' : 'Mostrar contraseña'))
const toggleIcon = computed(() => (visible.value ? 'i-lucide-eye-off' : 'i-lucide-eye'))
</script>

<template>
  <UInput
    :model-value="props.modelValue"
    :type="inputType"
    :name="props.name"
    :placeholder="props.placeholder"
    :autocomplete="props.autocomplete"
    :disabled="props.disabled"
    :color="props.color"
    :variant="props.variant"
    :size="props.size"
    :icon="props.icon"
    :class="props.class"
    class="w-full sipac-password-input"
    :ui="{ trailing: 'pe-1' }"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #trailing>
      <button
        type="button"
        class="sipac-password-toggle"
        :aria-label="toggleLabel"
        :aria-pressed="visible"
        @click.prevent="visible = !visible"
      >
        <UIcon :name="toggleIcon" class="sipac-password-toggle-icon" aria-hidden="true" />
      </button>
    </template>
  </UInput>
</template>

<style scoped>
.sipac-password-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  margin-inline-end: 0.125rem;
  border: none;
  background: transparent;
  color: var(--color-text-soft);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.sipac-password-toggle:focus-visible {
  outline: 2px solid var(--color-sipac-400);
  outline-offset: 2px;
}

.sipac-password-toggle-icon {
  width: 1.125rem;
  height: 1.125rem;
}
</style>
