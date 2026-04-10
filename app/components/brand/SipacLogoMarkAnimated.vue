<script setup lang="ts">
defineProps<{
  phase: 'preparing' | 'searching' | 'writing'
}>()
</script>

<template>
  <div class="sipac-mark" :class="`sipac-mark--${phase}`" aria-hidden="true">
    <svg
      class="sipac-mark__svg"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g stroke-linejoin="round" stroke-linecap="round" class="sipac-mark__group">
        <!-- 3 Inner Rhombi -->
        <!-- Rhombus 11 (Top-Left) -->
        <g class="sipac-inner-rhombus sipac-inner-11">
          <polygon class="sipac-poly-light" points="50,36 37.876,29 37.876,43" />
          <polygon class="sipac-poly-dark" points="50,50 50,36 37.876,43" />
        </g>

        <!-- Rhombus 3 (Right) -->
        <g class="sipac-inner-rhombus sipac-inner-3">
          <polygon class="sipac-poly-light" points="62.124,43 74.248,50 62.124,57" />
          <polygon class="sipac-poly-dark" points="50,50 62.124,43 62.124,57" />
        </g>

        <!-- Rhombus 7 (Bottom-Left) -->
        <g class="sipac-inner-rhombus sipac-inner-7">
          <polygon class="sipac-poly-light" points="37.876,57 37.876,71 50,64" />
          <polygon class="sipac-poly-dark" points="50,50 37.876,57 50,64" />
        </g>

        <!-- 6 Outer Chevrons -->
        <!-- Chevron 12 (Top) -->
        <g class="sipac-outer-chevron sipac-outer-12">
          <polygon class="sipac-poly-light" points="37.876,29 50,36 50,22" />
          <polygon class="sipac-poly-dark" points="62.124,29 50,36 50,22" />
        </g>

        <!-- Chevron 2 (Top-Right) -->
        <g class="sipac-outer-chevron sipac-outer-2">
          <polygon class="sipac-poly-light" points="62.124,29 62.124,43 74.248,36" />
          <polygon class="sipac-poly-dark" points="74.248,50 62.124,43 74.248,36" />
        </g>

        <!-- Chevron 4 (Bottom-Right) -->
        <g class="sipac-outer-chevron sipac-outer-4">
          <polygon class="sipac-poly-light" points="74.248,50 62.124,57 74.248,64" />
          <polygon class="sipac-poly-dark" points="62.124,71 62.124,57 74.248,64" />
        </g>

        <!-- Chevron 6 (Bottom) -->
        <g class="sipac-outer-chevron sipac-outer-6">
          <polygon class="sipac-poly-light" points="62.124,71 50,64 50,78" />
          <polygon class="sipac-poly-dark" points="37.876,71 50,64 50,78" />
        </g>

        <!-- Chevron 8 (Bottom-Left) -->
        <g class="sipac-outer-chevron sipac-outer-8">
          <polygon class="sipac-poly-light" points="37.876,71 37.876,57 25.752,64" />
          <polygon class="sipac-poly-dark" points="25.752,50 37.876,57 25.752,64" />
        </g>

        <!-- Chevron 10 (Top-Left) -->
        <g class="sipac-outer-chevron sipac-outer-10">
          <polygon class="sipac-poly-light" points="25.752,50 37.876,43 25.752,36" />
          <polygon class="sipac-poly-dark" points="37.876,29 37.876,43 25.752,36" />
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.sipac-mark {
  --mark-light: #f3a683;
  --mark-dark: #e08b66;

  isolation: isolate;
  width: 100%;
  height: 100%;
}

.sipac-poly-light {
  fill: var(--mark-light);
  transform-origin: 50px 50px;
}

.sipac-poly-dark {
  fill: var(--mark-dark);
  transform-origin: 50px 50px;
}

.sipac-inner-rhombus,
.sipac-outer-chevron {
  transform-origin: 50px 50px;
}

.sipac-mark__svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.sipac-mark__group {
  transform-origin: 50px 50px;
}

/* =========================================================================
   ANIMATION: PREPARING
   - Concept: "Breathing & Assembling"
   - Inner Rhombi glow and gently scale, Outer Chevrons gently contract and expand 
     in a wave, looking like a system warming up.
   ========================================================================= */
.sipac-mark--preparing .sipac-inner-rhombus {
  animation: s-prep-inner 3s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
}
.sipac-mark--preparing .sipac-outer-chevron {
  animation: s-prep-outer 3s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
}
.sipac-mark--preparing .sipac-outer-12 {
  animation-delay: 0.1s;
}
.sipac-mark--preparing .sipac-outer-2 {
  animation-delay: 0.2s;
}
.sipac-mark--preparing .sipac-outer-4 {
  animation-delay: 0.3s;
}
.sipac-mark--preparing .sipac-outer-6 {
  animation-delay: 0.4s;
}
.sipac-mark--preparing .sipac-outer-8 {
  animation-delay: 0.5s;
}
.sipac-mark--preparing .sipac-outer-10 {
  animation-delay: 0.6s;
}

@keyframes s-prep-inner {
  0% {
    transform: scale(1);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.05);
    opacity: 1;
  }
}

@keyframes s-prep-outer {
  0% {
    transform: scale(0.98) translate(0px, 0px);
    opacity: 0.9;
  }
  100% {
    transform: scale(1) translate(0px, 0px);
    opacity: 1;
  }
}

/* =========================================================================
   ANIMATION: SEARCHING
   - Concept: "Radar / Scanning"
   - Spin the entire mark slowly, while a bright searchlight sweeps across 
     the outer chevrons one by one.
   ========================================================================= */
.sipac-mark--searching .sipac-mark__group {
  animation: s-search-spin 10s infinite linear;
}

.sipac-mark--searching .sipac-outer-chevron polygon {
  animation: s-search-sweep 1.2s infinite linear;
}
.sipac-mark--searching .sipac-inner-rhombus {
  opacity: 0.7;
}

.sipac-mark--searching .sipac-outer-12 polygon {
  animation-delay: 0s;
}
.sipac-mark--searching .sipac-outer-2 polygon {
  animation-delay: 0.2s;
}
.sipac-mark--searching .sipac-outer-4 polygon {
  animation-delay: 0.4s;
}
.sipac-mark--searching .sipac-outer-6 polygon {
  animation-delay: 0.6s;
}
.sipac-mark--searching .sipac-outer-8 polygon {
  animation-delay: 0.8s;
}
.sipac-mark--searching .sipac-outer-10 polygon {
  animation-delay: 1s;
}

@keyframes s-search-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes s-search-sweep {
  0%,
  100% {
    opacity: 0.8;
    filter: brightness(1) drop-shadow(0 0 0 transparent);
  }
  20% {
    opacity: 1;
    filter: brightness(1.4) drop-shadow(0 0 6px var(--mark-light));
    transform: scale(1.05);
  }
  45% {
    opacity: 0.8;
    filter: brightness(1) drop-shadow(0 0 0 transparent);
    transform: scale(1);
  }
}

/* =========================================================================
   ANIMATION: WRITING
   - Concept: "Neural Firing / Final Assembly"
   - Very energetic. The center shrinks in, the outer tips burst outward 
     synchronously like a bright spark of idea generation.
   ========================================================================= */
.sipac-mark--writing .sipac-inner-rhombus {
  animation: s-write-inner 0.7s infinite cubic-bezier(0.2, 0.8, 0.2, 1) alternate;
}
.sipac-mark--writing .sipac-outer-chevron {
  animation: s-write-outer 0.7s infinite cubic-bezier(0.2, 0.8, 0.2, 1) alternate;
}

/* Add slight cascading delay for writing to give it dynamic electricity */
.sipac-mark--writing .sipac-outer-12,
.sipac-mark--writing .sipac-outer-6 {
  animation-delay: 0s;
}
.sipac-mark--writing .sipac-outer-2,
.sipac-mark--writing .sipac-outer-8 {
  animation-delay: 0.1s;
}
.sipac-mark--writing .sipac-outer-4,
.sipac-mark--writing .sipac-outer-10 {
  animation-delay: 0.2s;
}

@keyframes s-write-inner {
  0% {
    transform: scale(1);
    opacity: 0.9;
  }
  100% {
    transform: scale(0.92);
    opacity: 1;
    fill: #fff;
    filter: brightness(1.2);
  }
}

@keyframes s-write-outer {
  0% {
    transform: scale(0.98);
    opacity: 0.9;
    filter: drop-shadow(0 0 0 transparent);
  }
  100% {
    transform: scale(1.08);
    opacity: 1;
    filter: drop-shadow(0 0 8px rgba(243, 166, 131, 0.6)) brightness(1.15);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sipac-mark__group,
  .sipac-inner-rhombus,
  .sipac-outer-chevron,
  .sipac-outer-chevron polygon {
    animation: none !important;
  }
}
</style>
