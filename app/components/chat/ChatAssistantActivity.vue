<script setup lang="ts">
import SipacLogoMarkAnimated from '~/components/brand/SipacLogoMarkAnimated.vue'

defineProps<{
  phase: 'preparing' | 'searching' | 'writing'
  label: string
}>()
</script>

<template>
  <div
    class="chat-assistant-activity"
    :class="`chat-assistant-activity--${phase}`"
    role="status"
    aria-live="polite"
    :aria-label="label"
  >
    <div class="chat-assistant-activity__inner">
      <div class="chat-assistant-activity__logo-wrap">
        <SipacLogoMarkAnimated :phase="phase" />
      </div>

      <div class="chat-assistant-activity__copy">
        <p class="chat-assistant-activity__label">{{ label }}</p>
        <div class="chat-assistant-activity__track" aria-hidden="true">
          <div class="chat-assistant-activity__ribbon" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-assistant-activity {
  --glyph-accent: rgb(40 124 73);
  --glyph-accent-soft: rgb(40 124 73 / 0.18);
  --glyph-border: rgb(40 124 73 / 0.32);
  --ribbon-from: rgb(40 124 73 / 0.08);
  --ribbon-mid: rgb(40 124 73 / 0.55);
  max-width: min(100%, 22rem);
}

@media (min-width: 640px) {
  .chat-assistant-activity {
    max-width: min(100%, 26rem);
  }
}

.chat-assistant-activity--searching {
  --glyph-accent: rgb(125 83 54);
  --glyph-accent-soft: rgb(125 83 54 / 0.2);
  --glyph-border: rgb(125 83 54 / 0.38);
  --ribbon-from: rgb(125 83 54 / 0.1);
  --ribbon-mid: rgb(174 127 83 / 0.65);
}

.chat-assistant-activity--writing {
  --glyph-accent: rgb(29 99 60);
  --glyph-accent-soft: rgb(29 99 60 / 0.22);
  --glyph-border: rgb(29 99 60 / 0.36);
  --ribbon-from: rgb(29 99 60 / 0.08);
  --ribbon-mid: rgb(40 124 73 / 0.62);
}

.chat-assistant-activity__inner {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  border-radius: 1rem;
  border: 1px solid color-mix(in srgb, var(--glyph-border) 70%, transparent);
  background: linear-gradient(
    145deg,
    rgb(255 255 255 / 0.96) 0%,
    color-mix(in srgb, var(--glyph-accent-soft) 35%, white) 48%,
    rgb(255 255 255 / 0.88) 100%
  );
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.85),
    0 10px 28px -18px rgb(17 46 29 / 0.18);
  padding: 0.35rem 0.65rem 0.4rem 0.45rem;
}

.chat-assistant-activity__logo-wrap {
  flex-shrink: 0;
  width: 1.95rem;
  height: 1.95rem;
  color: var(--glyph-accent);
}

@media (min-width: 640px) {
  .chat-assistant-activity__logo-wrap {
    width: 2.2rem;
    height: 2.2rem;
  }
}

.chat-assistant-activity__copy {
  min-width: 0;
  flex: 1;
}

.chat-assistant-activity__label {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1.35;
  color: rgb(16 35 25);
}

@media (min-width: 640px) {
  .chat-assistant-activity__label {
    font-size: 0.75rem;
  }
}

.chat-assistant-activity__track {
  margin-top: 0.35rem;
  height: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--glyph-accent) 12%, transparent);
  overflow: hidden;
}

.chat-assistant-activity__ribbon {
  height: 100%;
  width: 42%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--ribbon-from), var(--ribbon-mid), var(--ribbon-from));
  animation: activity-ribbon 1.65s cubic-bezier(0.45, 0.05, 0.25, 1) infinite;
}

.chat-assistant-activity--searching .chat-assistant-activity__ribbon {
  animation-duration: 2.05s;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

.chat-assistant-activity--writing .chat-assistant-activity__ribbon {
  animation-duration: 1.25s;
}

@keyframes activity-ribbon {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(320%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .chat-assistant-activity__ribbon {
    animation: none;
    transform: translateX(40%);
    width: 28%;
  }
}
</style>
