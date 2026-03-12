<script setup lang="ts">
const { user, isAdmin } = useAuth()
const usersStore = useUsersStore()

const quickPrompts = [
  'Resume los artículos publicados entre 2022 y 2025.',
  'Muéstrame documentos relacionados con innovación educativa.',
  'Identifica evidencias útiles para acreditación institucional.',
]

const selectedPrompt = ref(quickPrompts[0] || '')

const adminHighlights = computed(() => [
  {
    title: 'Usuarios registrados',
    value: usersStore.meta?.total ?? usersStore.users.length,
    icon: 'i-lucide-users-round',
  },
  {
    title: 'Cuentas activas',
    value: usersStore.users.filter((candidate) => candidate.isActive).length,
    icon: 'i-lucide-shield-check',
  },
  {
    title: 'Docentes visibles',
    value: usersStore.users.filter((candidate) => candidate.role === 'docente').length,
    icon: 'i-lucide-graduation-cap',
  },
])

const adminPreviewUsers = computed(() => usersStore.users.slice(0, 5))

function fillPrompt(prompt: string) {
  selectedPrompt.value = prompt
}

onMounted(async () => {
  if (isAdmin.value) {
    await usersStore.fetchUsers({ page: 1, limit: 6 })
  }
})
</script>

<template>
  <div class="space-y-8">
    <section
      class="panel-surface hero-wash fade-up overflow-hidden px-6 py-7 sm:px-8 sm:py-8"
      :class="isAdmin ? '' : 'relative'"
    >
      <div
        v-if="!isAdmin"
        class="pointer-events-none absolute -top-16 right-10 hidden size-44 rounded-full bg-sipac-200/40 blur-3xl lg:block"
        aria-hidden="true"
      />

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_22rem]">
        <div class="min-w-0 space-y-5">
          <div class="section-chip">
            <UIcon
              :name="isAdmin ? 'i-lucide-shield-check' : 'i-lucide-sparkles'"
              class="size-3.5"
              aria-hidden="true"
            />
            {{ isAdmin ? 'Operación segura' : 'Workspace con IA' }}
          </div>

          <div class="space-y-3">
            <h1 class="font-display text-4xl font-semibold text-text sm:text-5xl">
              {{
                isAdmin
                  ? 'Gobierno operativo de SIPAc con claridad institucional.'
                  : `Hola, ${user?.fullName?.split(' ')[0] || 'docente'}. Tu trabajo empieza aquí.`
              }}
            </h1>
            <p class="max-w-3xl text-base leading-7 text-text-muted sm:text-lg">
              {{
                isAdmin
                  ? 'Supervisa cuentas, fortalece la trazabilidad y mantén una experiencia segura para toda la comunidad académica.'
                  : 'Consulta evidencias con apoyo de IA, prepara la carga documental y mantén la productividad académica con una interfaz clara, ágil y amigable.'
              }}
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <SipacBadge color="primary" variant="subtle" size="lg">
              {{ isAdmin ? 'Administración institucional' : 'Consulta asistida' }}
            </SipacBadge>
            <SipacBadge color="neutral" variant="outline" size="lg">
              {{ user?.program || 'Universidad de Córdoba' }}
            </SipacBadge>
          </div>

          <div class="flex flex-wrap gap-3">
            <SipacButton
              v-if="!isAdmin"
              to="/#workspace-ia"
              icon="i-lucide-sparkles"
              size="lg"
              class="shadow-[0_20px_36px_-22px_rgba(18,63,40,0.6)]"
            >
              Ir al workspace IA
            </SipacButton>
            <SipacButton
              v-if="!isAdmin"
              to="/#workspace-documentos"
              icon="i-lucide-folder-up"
              color="neutral"
              variant="soft"
              size="lg"
            >
              Explorar carga documental
            </SipacButton>
            <SipacButton v-if="isAdmin" to="/admin/users" icon="i-lucide-users-round" size="lg">
              Gestionar usuarios
            </SipacButton>
            <SipacButton
              v-if="isAdmin"
              to="/profile"
              icon="i-lucide-user-round"
              color="neutral"
              variant="soft"
              size="lg"
            >
              Ajustar mi cuenta
            </SipacButton>
          </div>
        </div>

        <div class="space-y-4">
          <div class="panel-muted p-4">
            <p class="text-[0.7rem] font-semibold tracking-[0.18em] text-text-soft uppercase">
              {{ isAdmin ? 'Estado general' : 'Enfoque de trabajo' }}
            </p>
            <div class="mt-3 space-y-3">
              <div class="flex items-start gap-3">
                <span
                  class="mt-1 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-sipac-100 text-sipac-700"
                >
                  <UIcon
                    :name="isAdmin ? 'i-lucide-waypoints' : 'i-lucide-message-square-diff'"
                    class="size-4.5"
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <p class="font-semibold text-text">
                    {{ isAdmin ? 'Operación prioritaria' : 'Consulta inteligente primero' }}
                  </p>
                  <p class="text-sm leading-6 text-text-muted">
                    {{
                      isAdmin
                        ? 'La vista administrativa pone primero el control de usuarios, la lectura rápida y la toma de decisiones claras.'
                        : 'La interfaz privilegia el flujo conversacional y deja la carga documental como segundo paso natural.'
                    }}
                  </p>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <span
                  class="mt-1 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-earth-100 text-earth-700"
                >
                  <UIcon
                    :name="isAdmin ? 'i-lucide-shield' : 'i-lucide-folder-lock'"
                    class="size-4.5"
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <p class="font-semibold text-text">Trabajo confiable</p>
                  <p class="text-sm leading-6 text-text-muted">
                    La experiencia evita ruido innecesario y deja visibles solo las acciones que
                    realmente ayudan al usuario.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <template v-if="!isAdmin">
      <section class="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.9fr)]">
        <div id="workspace-ia" class="panel-surface fade-up stagger-1 space-y-5 p-6 sm:p-7">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="section-chip">Consulta asistida</p>
              <h2 class="mt-3 font-display text-3xl font-semibold text-text">
                Workspace IA para explorar producción académica
              </h2>
              <p class="mt-2 max-w-2xl text-sm leading-6 text-text-muted">
                La interfaz deja lista la conversación futura: prompts orientados a repositorio,
                filtros naturales y continuidad con el procesamiento documental real.
              </p>
            </div>

            <SipacBadge color="primary" variant="subtle" size="lg"> Consulta guiada </SipacBadge>
          </div>

          <div class="panel-muted space-y-4 p-4 sm:p-5">
            <div class="rounded-[1.4rem] border border-border/70 bg-white/80 p-4">
              <p class="text-sm font-semibold text-text">Prompt recomendado</p>
              <p class="mt-2 text-sm leading-6 text-text-muted">{{ selectedPrompt }}</p>
            </div>

            <div class="flex flex-wrap gap-2">
              <SipacButton
                v-for="prompt in quickPrompts"
                :key="prompt"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="fillPrompt(prompt)"
              >
                {{ prompt }}
              </SipacButton>
            </div>

            <UAlert
              color="primary"
              variant="outline"
              icon="i-lucide-messages-square"
              title="Próximo módulo conversacional"
              description="El workspace IA ya quedó encuadrado para consultas sobre autores, fechas, temas e institución usando lenguaje natural."
            />
          </div>

          <div class="grid gap-4 md:grid-cols-3">
            <div class="panel-muted p-4">
              <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
                Consultas combinadas
              </p>
              <p class="mt-2 text-sm leading-6 text-text-muted">
                Rango de fechas, autor, tema e institución en lenguaje natural.
              </p>
            </div>
            <div class="panel-muted p-4">
              <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
                Contexto conversacional
              </p>
              <p class="mt-2 text-sm leading-6 text-text-muted">
                Follow-ups sin perder el hilo del análisis documental.
              </p>
            </div>
            <div class="panel-muted p-4">
              <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
                Enlaces verificables
              </p>
              <p class="mt-2 text-sm leading-6 text-text-muted">
                Salida pensada para abrir o descargar documentos asociados.
              </p>
            </div>
          </div>
        </div>

        <div id="workspace-documentos">
          <DashboardDocumentsWorkspace />
        </div>
      </section>

      <section class="grid gap-4 md:grid-cols-3">
        <SipacCard interactive>
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-11 items-center justify-center rounded-2xl bg-sipac-50 text-sipac-700"
              >
                <UIcon name="i-lucide-user-round" class="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 class="font-semibold text-text">Mi perfil</h3>
                <p class="text-sm text-text-muted">Cuenta, programa y contraseña</p>
              </div>
            </div>
          </template>

          <p class="text-sm leading-6 text-text-muted">
            Mantén actualizados los datos personales y refuerza el acceso con un flujo claro de
            credenciales.
          </p>

          <template #footer>
            <SipacButton to="/profile" variant="ghost" color="neutral">Ir al perfil</SipacButton>
          </template>
        </SipacCard>

        <SipacCard interactive>
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-11 items-center justify-center rounded-2xl bg-earth-50 text-earth-700"
              >
                <UIcon name="i-lucide-book-open-text" class="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 class="font-semibold text-text">Contexto académico</h3>
                <p class="text-sm text-text-muted">Diseñado para acreditación y trazabilidad</p>
              </div>
            </div>
          </template>

          <p class="text-sm leading-6 text-text-muted">
            La experiencia visual privilegia evidencias, claridad de lectura y preparación para
            reportes institucionales.
          </p>
        </SipacCard>

        <SipacCard interactive>
          <template #header>
            <div class="flex items-center gap-3">
              <span
                class="flex size-11 items-center justify-center rounded-2xl bg-sipac-50 text-sipac-700"
              >
                <UIcon name="i-lucide-shield-check" class="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 class="font-semibold text-text">Seguridad visible</h3>
                <p class="text-sm text-text-muted">Estados, cola y avisos sin perder claridad</p>
              </div>
            </div>
          </template>

          <p class="text-sm leading-6 text-text-muted">
            La carga documental ahora expone validación real, seguimiento de OCR y notificaciones
            visibles sin sacar al usuario del flujo principal.
          </p>
        </SipacCard>
      </section>
    </template>

    <template v-else>
      <section class="grid gap-4 lg:grid-cols-3">
        <SipacCard v-for="highlight in adminHighlights" :key="highlight.title" interactive>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
                  {{ highlight.title }}
                </p>
                <p class="mt-2 text-3xl font-semibold tabular-nums text-text">
                  {{ highlight.value }}
                </p>
              </div>

              <span
                class="flex size-12 items-center justify-center rounded-2xl bg-sipac-50 text-sipac-700"
              >
                <UIcon :name="highlight.icon" class="size-5" aria-hidden="true" />
              </span>
            </div>
          </template>
        </SipacCard>
      </section>

      <section class="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <SipacCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="section-chip">Usuarios recientes</p>
                <h2 class="mt-3 font-display text-3xl font-semibold text-text">
                  Visibilidad rápida sobre la operación
                </h2>
                <p class="mt-2 text-sm leading-6 text-text-muted">
                  La home administrativa prioriza claridad, estado y acceso directo a gestión de
                  cuentas.
                </p>
              </div>

              <SipacButton
                to="/admin/users"
                icon="i-lucide-arrow-right"
                trailing
                color="neutral"
                variant="soft"
              >
                Abrir gestión de usuarios
              </SipacButton>
            </div>
          </template>

          <div v-if="usersStore.loading" class="grid gap-3">
            <USkeleton v-for="index in 4" :key="index" class="h-16 rounded-2xl" />
          </div>

          <div v-else-if="adminPreviewUsers.length" class="space-y-3">
            <div
              v-for="account in adminPreviewUsers"
              :key="account._id"
              class="panel-muted flex items-center justify-between gap-4 p-4"
            >
              <div class="min-w-0">
                <p class="truncate font-semibold text-text">{{ account.fullName }}</p>
                <p class="truncate text-sm text-text-muted">{{ account.email }}</p>
              </div>

              <div class="flex shrink-0 items-center gap-2">
                <SipacBadge
                  :color="account.role === 'admin' ? 'warning' : 'primary'"
                  variant="subtle"
                >
                  {{ account.role === 'admin' ? 'Admin' : 'Docente' }}
                </SipacBadge>
                <SipacBadge :color="account.isActive ? 'success' : 'error'" variant="outline">
                  {{ account.isActive ? 'Activo' : 'Inactivo' }}
                </SipacBadge>
              </div>
            </div>
          </div>

          <UEmpty
            v-else
            icon="i-lucide-users-round"
            title="No se encontraron usuarios"
            description="Cuando la carga administrativa esté disponible, aquí verás un resumen rápido de cuentas."
          />
        </SipacCard>

        <div class="space-y-6">
          <SipacCard>
            <template #header>
              <div class="flex items-center gap-3">
                <span
                  class="flex size-11 items-center justify-center rounded-2xl bg-earth-50 text-earth-700"
                >
                  <UIcon name="i-lucide-building-2" class="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 class="font-semibold text-text">Operación institucional</h3>
                  <p class="text-sm text-text-muted">Administración seria, no pesada</p>
                </div>
              </div>
            </template>

            <div class="space-y-3 text-sm leading-6 text-text-muted">
              <p>
                Las acciones visibles están organizadas para facilitar decisiones rápidas y reducir
                confusiones.
              </p>
              <p>
                La creación y la edición permanecen separadas para mantener una operación más
                ordenada.
              </p>
            </div>
          </SipacCard>
        </div>
      </section>
    </template>
  </div>
</template>
