<script setup lang="ts">
interface HomeContinuationItem {
  id: string
  eyebrow: string
  title: string
  reason: string
  outcome: string
  meta: string
  icon: string
  to: string
  tone?: 'primary' | 'earth' | 'neutral'
}

const props = withDefaults(
  defineProps<{
    title: string
    description: string
    featured?: HomeContinuationItem | null
    queue: HomeContinuationItem[]
    loading?: boolean
  }>(),
  {
    featured: null,
    loading: false,
  },
)

function toneClasses(tone: HomeContinuationItem['tone']) {
  if (tone === 'earth') {
    return {
      shell: 'border-earth-200/80 bg-earth-50/68',
      icon: 'bg-white/88 text-earth-700',
      eyebrow: 'text-earth-700',
      meta: 'bg-earth-100/76 text-earth-700',
    }
  }

  if (tone === 'primary') {
    return {
      shell: 'border-sipac-200/80 bg-sipac-50/72',
      icon: 'bg-white/88 text-sipac-700',
      eyebrow: 'text-sipac-700',
      meta: 'bg-sipac-100/80 text-sipac-700',
    }
  }

  return {
    shell: 'border-border/70 bg-white/88',
    icon: 'bg-surface-muted/92 text-text',
    eyebrow: 'text-text-soft',
    meta: 'bg-surface-muted text-text-soft',
  }
}
</script>

<template>
  <section class="home-continuity panel-surface px-5 py-6 sm:px-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="space-y-1">
        <p class="text-[0.68rem] font-semibold tracking-[0.18em] text-text-soft uppercase">
          Continuidad
        </p>
        <h2 class="font-display text-2xl font-semibold text-text">{{ props.title }}</h2>
        <p class="max-w-2xl text-sm leading-6 text-text-muted">{{ props.description }}</p>
      </div>

      <SipacButton to="/repository" color="neutral" variant="ghost" icon="i-lucide-library-big">
        Ver repositorio
      </SipacButton>
    </div>

    <div
      v-if="props.loading"
      class="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(18rem,0.88fr)]"
    >
      <div class="skeleton-shimmer h-[18rem] rounded-[1.6rem] border border-border/50" />
      <div class="grid gap-3">
        <div
          v-for="index in 3"
          :key="index"
          class="skeleton-shimmer h-[5.5rem] rounded-[1.25rem] border border-border/50"
        />
      </div>
    </div>

    <div
      v-else-if="props.featured"
      class="mt-6 grid gap-4"
      :class="props.queue.length > 0 ? 'xl:grid-cols-[minmax(0,1.06fr)_minmax(21rem,0.94fr)]' : ''"
    >
      <NuxtLink
        :to="props.featured.to"
        class="home-featured-item group relative overflow-hidden rounded-[1.7rem] border px-5 py-5 sm:px-6"
        :class="toneClasses(props.featured.tone).shell"
      >
        <div class="home-featured-orb" aria-hidden="true" />

        <div class="relative z-1 flex h-full flex-col gap-6">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-3">
              <p
                class="text-[0.68rem] font-semibold tracking-[0.18em] uppercase"
                :class="toneClasses(props.featured.tone).eyebrow"
              >
                {{ props.featured.eyebrow }}
              </p>
              <h3
                class="max-w-xl text-[1.7rem] leading-tight font-semibold text-text sm:text-[2rem]"
              >
                {{ props.featured.title }}
              </h3>
            </div>

            <span
              class="flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-[0_16px_24px_-22px_rgba(17,46,29,0.2)]"
              :class="toneClasses(props.featured.tone).icon"
            >
              <UIcon :name="props.featured.icon" class="size-5" />
            </span>
          </div>

          <div class="flex flex-wrap gap-2">
            <span
              class="inline-flex items-center rounded-full px-3 py-1 text-[0.72rem] font-semibold tracking-[0.12em] uppercase"
              :class="toneClasses(props.featured.tone).meta"
            >
              {{ props.featured.meta }}
            </span>
            <span
              class="inline-flex items-center rounded-full bg-white/78 px-3 py-1 text-[0.72rem] font-semibold tracking-[0.12em] text-text-soft uppercase"
            >
              Sigue aquí
            </span>
          </div>

          <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,19rem)]">
            <div class="grid gap-3 sm:grid-cols-2">
              <div
                class="rounded-[1.2rem] border border-white/72 bg-white/72 px-4 py-4 backdrop-blur-sm"
              >
                <p class="text-xs font-semibold tracking-[0.14em] text-text-soft uppercase">
                  Punto clave
                </p>
                <p class="mt-2 text-sm leading-6 text-text-muted">{{ props.featured.reason }}</p>
              </div>

              <div
                class="rounded-[1.2rem] border border-white/72 bg-white/72 px-4 py-4 backdrop-blur-sm"
              >
                <p class="text-xs font-semibold tracking-[0.14em] text-text-soft uppercase">
                  Al abrir
                </p>
                <p class="mt-2 text-sm leading-6 text-text">{{ props.featured.outcome }}</p>
              </div>
            </div>

            <div
              class="rounded-[1.25rem] border border-white/75 bg-white/84 px-4 py-4 backdrop-blur-sm"
            >
              <p class="text-xs font-semibold tracking-[0.14em] text-text-soft uppercase">
                Siguiente paso
              </p>
              <p class="mt-3 text-lg font-semibold text-text">
                Entrar ahora te ahorra volver a empezar.
              </p>
              <div class="mt-5 flex items-center justify-between gap-3">
                <span
                  class="inline-flex items-center rounded-full px-3 py-1 text-[0.72rem] font-semibold tracking-[0.12em] uppercase"
                  :class="toneClasses(props.featured.tone).meta"
                >
                  {{ props.featured.eyebrow }}
                </span>
                <span class="home-inline-arrow text-sipac-800">
                  <span>Abrir</span>
                  <UIcon
                    name="i-lucide-arrow-up-right"
                    class="home-inline-arrow-icon size-4"
                    aria-hidden="true"
                  />
                </span>
              </div>
            </div>
          </div>
        </div>
      </NuxtLink>

      <div
        v-if="props.queue.length > 0"
        class="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-1"
      >
        <NuxtLink
          v-for="item in props.queue"
          :key="item.id"
          :to="item.to"
          class="home-queue-item group relative flex items-start gap-3 overflow-hidden rounded-[1.3rem] border border-border/65 bg-white/84 px-4 py-4"
        >
          <div class="absolute inset-x-0 top-0 h-px bg-white/76" aria-hidden="true" />

          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-2xl"
            :class="toneClasses(item.tone).icon"
          >
            <UIcon :name="item.icon" class="size-4.5" />
          </span>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <p
                class="text-[0.68rem] font-semibold tracking-[0.16em] uppercase"
                :class="toneClasses(item.tone).eyebrow"
              >
                {{ item.eyebrow }}
              </p>
              <span
                class="inline-flex items-center rounded-full px-2.5 py-1 text-[0.68rem] font-semibold"
                :class="toneClasses(item.tone).meta"
              >
                {{ item.meta }}
              </span>
            </div>
            <p class="mt-2 text-base font-semibold text-text">{{ item.title }}</p>
            <p class="mt-1 text-sm leading-6 text-text-muted">{{ item.reason }}</p>
          </div>

          <span class="home-inline-arrow mt-1 hidden sm:flex">
            <span class="sr-only">Abrir</span>
            <UIcon
              name="i-lucide-arrow-up-right"
              class="home-inline-arrow-icon size-4.5"
              aria-hidden="true"
            />
          </span>
        </NuxtLink>
      </div>
    </div>

    <ExperienceEmptyState
      v-else
      class="mt-6"
      icon="i-lucide-sparkles"
      title="Todavía no hay nada que retomar"
      description="Empieza con una carga o una consulta. Después, este espacio te servirá para volver justo a lo importante."
    >
      <template #actions>
        <div class="flex flex-wrap justify-center gap-3">
          <SipacButton to="/workspace-documents" icon="i-lucide-folder-up">
            Subir documento
          </SipacButton>
          <SipacButton to="/chat" color="neutral" variant="soft" icon="i-lucide-sparkles">
            Abrir chat
          </SipacButton>
        </div>
      </template>
    </ExperienceEmptyState>
  </section>
</template>
