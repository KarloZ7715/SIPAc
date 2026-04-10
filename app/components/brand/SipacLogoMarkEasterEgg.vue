<script setup lang="ts">
import SipacLogoMarkAnimated from '~/components/brand/SipacLogoMarkAnimated.vue'

type LogoPhase = 'preparing' | 'searching' | 'writing'

const props = withDefaults(
  defineProps<{
    basePhase: LogoPhase
    burstDurationMs?: number
    cooldownMs?: number
    phaseTransitionMs?: number
    ariaLabel?: string
    disabled?: boolean
  }>(),
  {
    burstDurationMs: 2500,
    cooldownMs: 1000,
    phaseTransitionMs: 420,
    ariaLabel: 'Animar logo de SIPAc',
    disabled: false,
  },
)

const overridePhase = ref<LogoPhase | null>(null)
const locked = ref(false)

let burstTimer: ReturnType<typeof setTimeout> | null = null
let cooldownTimer: ReturnType<typeof setTimeout> | null = null

const displayPhase = computed<LogoPhase>(() => overridePhase.value ?? props.basePhase)
const renderedPhase = ref<LogoPhase>(displayPhase.value)
const phaseTransitionName = 'sipac-logo-phase'
const phaseTransitionDuration = computed(() => `${props.phaseTransitionMs}ms`)

watch(
  displayPhase,
  (nextPhase) => {
    renderedPhase.value = nextPhase
  },
  { immediate: true },
)

watch(
  () => props.disabled,
  (disabled) => {
    if (!disabled) {
      return
    }

    clearTimers()
    locked.value = false
    overridePhase.value = null
  },
)

function randomBurstPhase(): LogoPhase {
  return Math.random() < 0.5 ? 'searching' : 'writing'
}

function clearTimers() {
  if (burstTimer) {
    clearTimeout(burstTimer)
    burstTimer = null
  }

  if (cooldownTimer) {
    clearTimeout(cooldownTimer)
    cooldownTimer = null
  }
}

function triggerEasterEgg() {
  if (props.disabled || locked.value) {
    return
  }

  locked.value = true
  overridePhase.value = randomBurstPhase()

  burstTimer = setTimeout(() => {
    overridePhase.value = null

    cooldownTimer = setTimeout(() => {
      locked.value = false
    }, props.cooldownMs)
  }, props.burstDurationMs)
}

onBeforeUnmount(() => {
  clearTimers()
})
</script>

<template>
  <button
    type="button"
    class="sipac-logo-easter-egg"
    :class="{ 'sipac-logo-easter-egg--locked': locked }"
    :aria-label="ariaLabel"
    :disabled="disabled || locked"
    @click="triggerEasterEgg"
  >
    <Transition :name="phaseTransitionName" mode="out-in">
      <SipacLogoMarkAnimated :key="renderedPhase" :phase="renderedPhase" />
    </Transition>
  </button>
</template>

<style scoped>
.sipac-logo-easter-egg {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  padding: 0;
  margin: 0;
  background: transparent;
  color: inherit;
  line-height: 0;
  cursor: pointer;
}

.sipac-logo-easter-egg--locked,
.sipac-logo-easter-egg:disabled {
  cursor: default;
}

.sipac-logo-easter-egg:focus-visible {
  outline: 2px solid rgb(40 124 73 / 0.45);
  outline-offset: 3px;
  border-radius: 12px;
}

.sipac-logo-phase-enter-active,
.sipac-logo-phase-leave-active {
  transition:
    opacity v-bind('phaseTransitionDuration') ease,
    transform v-bind('phaseTransitionDuration') ease;
}

.sipac-logo-phase-enter-from,
.sipac-logo-phase-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .sipac-logo-phase-enter-active,
  .sipac-logo-phase-leave-active {
    transition: none;
  }

  .sipac-logo-phase-enter-from,
  .sipac-logo-phase-leave-to {
    opacity: 1;
    transform: none;
  }
}
</style>
