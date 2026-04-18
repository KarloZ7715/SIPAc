<script setup lang="ts">
import {
  CHAT_MODEL_PROVIDER_SECTION_ORDER,
  CHAT_PROVIDER_DISPLAY_NAME,
  type ChatModelProvider,
} from '~~/app/types'

const props = withDefaults(
  defineProps<{
    modelValue: string
    canSend: boolean
    canStop?: boolean
    busy: boolean
    layout?: 'centered' | 'floating' | 'docked'
    submitLabel?: string
    stopLabel?: string
    placeholder?: string
    showModelPicker?: boolean
  }>(),
  {
    canStop: false,
    layout: 'floating',
    submitLabel: 'Consultar',
    stopLabel: 'Detener',
    placeholder: 'Pregunta por autores, tema, institución, fechas o tipo de obra académica…',
    showModelPicker: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
  stop: []
}>()

const selectedModelKey = defineModel<string>('selectedModelKey', { default: 'default' })

const chatStore = useChatStore()

type ModelSelectEntry = { type: 'label'; label: string } | { label: string; value: string }

function compareProviderSections(a: ChatModelProvider, b: ChatModelProvider) {
  const ia = CHAT_MODEL_PROVIDER_SECTION_ORDER.indexOf(a)
  const ib = CHAT_MODEL_PROVIDER_SECTION_ORDER.indexOf(b)
  if (ia === -1 && ib === -1) {
    return CHAT_PROVIDER_DISPLAY_NAME[a].localeCompare(CHAT_PROVIDER_DISPLAY_NAME[b], 'es')
  }
  if (ia === -1) {
    return 1
  }
  if (ib === -1) {
    return -1
  }
  return ia - ib
}

/** Grupos para USelect: array de arrays → título de proveedor + modelos con nombre legible (value sigue siendo provider::modelId o default). */
const modelItems = computed((): ModelSelectEntry[][] => {
  const manual = chatStore.providers?.manualOptions.filter((o) => o.enabledForManual) ?? []
  const byProvider = new Map<ChatModelProvider, typeof manual>()
  for (const option of manual) {
    const list = byProvider.get(option.provider) ?? []
    list.push(option)
    byProvider.set(option.provider, list)
  }

  const groups: ModelSelectEntry[][] = [
    [
      { type: 'label', label: 'Recomendación' },
      { label: 'Automático (recomendado)', value: 'default' },
    ],
  ]

  const providers = [...byProvider.keys()].sort(compareProviderSections)
  for (const provider of providers) {
    const options = byProvider.get(provider) ?? []
    groups.push([
      { type: 'label', label: CHAT_PROVIDER_DISPLAY_NAME[provider] },
      ...options.map((o) => ({
        label: o.label,
        value: `${o.provider}::${o.modelId}`,
      })),
    ])
  }

  return groups
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.busy && props.canStop) {
    e.preventDefault()
    emit('stop')
    return
  }

  if (e.key !== 'Enter' || e.shiftKey) {
    return
  }
  if (e.metaKey || e.ctrlKey) {
    return
  }
  e.preventDefault()
  if (props.canSend && !props.busy) {
    emit('submit')
  }
}
</script>

<template>
  <div
    class="chat-composer"
    :class="[
      layout === 'docked'
        ? 'chat-composer--docked'
        : layout === 'floating'
          ? 'chat-composer--floating'
          : 'chat-composer--centered',
      layout === 'centered' ? 'chat-composer--hero' : '',
    ]"
  >
    <div
      v-if="layout === 'centered'"
      class="chat-composer-glow rounded-[1.35rem]"
      aria-hidden="true"
    />
    <div
      v-else-if="layout === 'floating'"
      class="chat-composer-glow chat-composer-glow--dock rounded-2xl"
      aria-hidden="true"
    />

    <form
      class="relative flex min-h-0 flex-col overflow-hidden bg-white/95 shadow-[0_12px_40px_-12px_rgb(17_46_29/0.12)] backdrop-blur-sm transition-all duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
      :class="[
        layout === 'centered'
          ? 'rounded-[1.35rem] ring-1 ring-sipac-200/25 border border-border/55'
          : layout === 'docked'
            ? 'rounded-2xl border border-border/50 shadow-[0_8px_32px_-20px_rgb(17_46_29/0.12)] sm:rounded-[1.25rem]'
            : 'rounded-2xl border border-border/55',
      ]"
      @submit.prevent="emit('submit')"
    >
      <label class="sr-only" for="chat-composer-input">Mensaje para el asistente</label>
      <div class="focus-glow min-h-0 px-2 pt-2 sm:px-3 sm:pt-3">
        <div
          class="composer-textarea-shell max-h-[min(42vh,15.5rem)] overflow-y-auto rounded-xl border border-border-muted/70 bg-surface-elevated/40 sm:max-h-[min(38vh,13.5rem)]"
        >
          <UTextarea
            id="chat-composer-input"
            :model-value="modelValue"
            color="neutral"
            variant="outline"
            autoresize
            :rows="layout === 'centered' ? 4 : 2"
            :maxrows="layout === 'centered' ? 14 : 12"
            :placeholder="placeholder"
            class="w-full resize-none border-0 bg-transparent px-3 py-2.5 text-base leading-relaxed text-text shadow-none ring-0 focus-visible:ring-0 sm:px-3.5 sm:py-3"
            @update:model-value="emit('update:modelValue', $event)"
            @keydown="onKeydown"
          />
        </div>
      </div>

      <div
        class="flex flex-wrap items-center gap-2 border-t border-border-muted/70 px-2 py-2 sm:gap-3 sm:px-3"
      >
        <div
          v-if="showModelPicker"
          class="flex min-w-0 flex-1 items-center gap-2 sm:max-w-[min(100%,20rem)]"
        >
          <UIcon
            name="i-lucide-wand-sparkles"
            class="size-4 shrink-0 text-sipac-600 opacity-80"
            aria-hidden="true"
          />
          <USelect
            v-model="selectedModelKey"
            color="neutral"
            variant="outline"
            size="sm"
            :items="modelItems"
            :loading="chatStore.providersLoading"
            class="min-w-0 flex-1"
            aria-label="Modo de respuesta (opcional)"
          />
        </div>
        <span v-else class="min-w-0 flex-1" />
        <span id="chat-model-hint-composer" class="sr-only">
          Opcional. SIPAc elige por defecto el modo más adecuado para buscar en el repositorio
          compartido.
        </span>
        <div class="ms-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          <SipacButton
            v-if="modelValue.length"
            color="neutral"
            variant="ghost"
            size="sm"
            type="button"
            icon="i-lucide-eraser"
            @click="emit('update:modelValue', '')"
          >
            Borrar
          </SipacButton>
          <SipacButton
            v-if="busy && canStop"
            type="button"
            color="warning"
            variant="soft"
            icon="i-lucide-square"
            class="rounded-xl"
            aria-label="Detener respuesta"
            @click="emit('stop')"
          >
            <span class="hidden sm:inline">{{ stopLabel }}</span>
          </SipacButton>
          <SipacButton
            v-else
            type="submit"
            :icon="
              layout === 'floating' || layout === 'docked' ? 'i-lucide-arrow-up' : 'i-lucide-send'
            "
            class="rounded-xl"
            :loading="busy"
            :disabled="!canSend"
            :aria-label="submitLabel"
          >
            <span class="hidden sm:inline">{{ submitLabel }}</span>
          </SipacButton>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
.chat-composer {
  position: relative;
  width: 100%;
}

.chat-composer--centered {
  max-width: 42rem;
  margin-left: auto;
  margin-right: auto;
}

.chat-composer--floating {
  max-width: 48rem;
  margin-left: auto;
  margin-right: auto;
}

.chat-composer--docked {
  width: 100%;
  max-width: none;
  margin-left: 0;
  margin-right: 0;
}

.chat-composer--hero .chat-composer-glow {
  inset: -6px;
  opacity: 0.5;
  filter: blur(16px);
}

.chat-composer-glow {
  position: absolute;
  inset: -4px;
  z-index: 0;
  pointer-events: none;
  background: linear-gradient(
    120deg,
    rgb(40 124 73 / 0.14),
    rgb(125 83 54 / 0.09),
    rgb(40 124 73 / 0.12)
  );
  opacity: 0.42;
  filter: blur(12px);
}

.chat-composer-glow--dock {
  inset: -2px -4px 10px;
  opacity: 0.32;
}

.chat-composer > form {
  position: relative;
  z-index: 1;
}

@media (prefers-reduced-motion: reduce) {
  .chat-composer-glow {
    filter: none;
    opacity: 0.2;
  }
}
</style>
