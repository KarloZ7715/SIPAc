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
    showToolDock?: boolean
  }>(),
  {
    canStop: false,
    layout: 'floating',
    submitLabel: 'Consultar',
    stopLabel: 'Detener',
    placeholder: 'Pregunta por autores, tema, institución, fechas o tipo de obra académica…',
    showModelPicker: true,
    showToolDock: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
  stop: []
}>()

const selectedModelKey = defineModel<string>('selectedModelKey', { default: 'default' })
const quote = defineModel<string>('quote', { default: '' })

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

    <ChatToolDock :show="showToolDock">
      <template #indicators>
        <slot name="tool-dock">
          <!-- Default empty or sample usage if not overridden -->
        </slot>
      </template>
    </ChatToolDock>

    <form
      class="composer-surface relative flex min-h-0 flex-col overflow-hidden bg-white/[0.98] backdrop-blur-sm transition-all duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
      :class="[
        layout === 'centered'
          ? 'rounded-[1.75rem] border border-border/60'
          : layout === 'docked'
            ? 'rounded-[1.5rem] border border-border/55 sm:rounded-[1.65rem]'
            : 'rounded-[1.5rem] border border-border/55',
      ]"
      @submit.prevent="emit('submit')"
    >
      <label class="sr-only" for="chat-composer-input">Mensaje para el asistente</label>
      <div class="min-h-0 px-2 pt-2 sm:px-3 sm:pt-3">
        <div
          v-if="quote && quote.trim().length > 0"
          class="group mb-1 ml-1 mr-1 flex items-center gap-2.5 rounded-xl border border-border/60 bg-surface/40 px-3 py-2 transition-colors hover:bg-surface/80"
        >
          <div
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sipac-500/10 text-sipac-600"
          >
            <UIcon name="i-lucide-quote" class="size-3.5" />
          </div>
          <p class="line-clamp-1 flex-1 text-sm text-text-soft" :title="quote">
            {{ quote }}
          </p>
          <button
            type="button"
            class="flex shrink-0 items-center justify-center rounded-full p-1.5 text-text-muted transition-colors hover:bg-black/5 hover:text-text focus:outline-none"
            aria-label="Eliminar cita"
            @click="quote = ''"
          >
            <UIcon name="i-lucide-x" class="size-3.5" />
          </button>
        </div>

        <div
          class="composer-textarea-shell max-h-[min(42vh,15.5rem)] overflow-y-auto sm:max-h-[min(38vh,13.5rem)]"
        >
          <UTextarea
            id="chat-composer-input"
            :model-value="modelValue"
            color="neutral"
            variant="none"
            autoresize
            :rows="layout === 'centered' ? 2 : 1"
            :maxrows="layout === 'centered' ? 14 : 12"
            :placeholder="placeholder"
            class="w-full resize-none border-0 bg-transparent px-1 py-1 text-[15px] leading-relaxed text-text shadow-none ring-0 max-[380px]:text-[14px] focus-visible:ring-0 sm:px-2 sm:py-1.5"
            @update:model-value="emit('update:modelValue', $event)"
            @keydown="onKeydown"
          />
        </div>
      </div>

      <div
        class="flex flex-col items-stretch gap-2 px-2 py-2.5 max-[380px]:px-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-4 sm:py-3"
      >
        <div
          v-if="showModelPicker"
          class="flex min-w-0 w-full items-center gap-2 sm:max-w-[min(100%,20rem)]"
        >
          <UIcon
            name="i-lucide-wand-sparkles"
            class="size-4 shrink-0 text-sipac-600 opacity-80 max-[380px]:hidden"
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
        <span v-else class="hidden min-w-0 sm:block sm:flex-1" />
        <span id="chat-model-hint-composer" class="sr-only">
          Opcional. SIPAc elige por defecto el modo más adecuado para buscar en el repositorio
          compartido.
        </span>
        <div
          class="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:ms-auto sm:w-auto"
        >
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
  inset: -6px;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(
    60% 120% at 50% 100%,
    rgb(201 100 66 / 0.18),
    rgb(201 100 66 / 0.06) 45%,
    transparent 72%
  );
  opacity: 0.55;
  filter: blur(14px);
  transition: opacity 400ms ease;
}

.chat-composer-glow--dock {
  inset: -3px -6px 12px;
  opacity: 0.4;
}

.chat-composer > form {
  position: relative;
  z-index: 1;
}

.composer-surface {
  box-shadow:
    0 1px 0 rgb(255 255 255 / 0.9) inset,
    0 1px 2px rgb(28 25 23 / 0.04),
    0 14px 38px -22px rgb(28 25 23 / 0.14);
}

.composer-surface:focus-within {
  box-shadow:
    0 1px 0 rgb(255 255 255 / 0.9) inset,
    0 1px 2px rgb(28 25 23 / 0.04),
    0 14px 38px -22px rgb(28 25 23 / 0.14);
  /* No heavy ring, just a soft glow */
}

.chat-composer--centered:focus-within .chat-composer-glow,
.chat-composer--floating:focus-within .chat-composer-glow,
.chat-composer--docked:focus-within .chat-composer-glow {
  opacity: 0.65;
}

@media (prefers-reduced-motion: reduce) {
  .chat-composer-glow {
    filter: none;
    opacity: 0.2;
  }
}
</style>
