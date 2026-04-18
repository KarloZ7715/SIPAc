<script setup lang="ts">
import type {
  ApiSuccessResponse,
  AuditAction,
  AuditLogPublic,
  AuditResource,
  PaginationMeta,
} from '~~/app/types'

definePageMeta({ middleware: ['admin'] })

type AuditLogsResponse = ApiSuccessResponse<{ logs: AuditLogPublic[] }>

const logs = ref<AuditLogPublic[]>([])
const meta = ref<PaginationMeta | null>(null)
const loading = ref(false)
const page = ref(1)
const requestFetch = import.meta.server ? useRequestFetch() : $fetch

const filters = reactive<{
  resource?: AuditResource
  action?: AuditAction
  from?: string
  to?: string
}>({
  resource: undefined,
  action: undefined,
  from: undefined,
  to: undefined,
})

const resourceOptions = [
  { label: 'Todos los recursos', value: undefined },
  { label: 'Productos', value: 'academic_product' },
  { label: 'Archivos', value: 'uploaded_file' },
  { label: 'Usuarios', value: 'user' },
  { label: 'Sesiones', value: 'session' },
]

const actionOptions = [
  { label: 'Todas las acciones', value: undefined },
  { label: 'Crear', value: 'create' },
  { label: 'Actualizar', value: 'update' },
  { label: 'Eliminar', value: 'delete' },
  { label: 'Login', value: 'login' },
  { label: 'Login fallido', value: 'login_failed' },
]

async function loadAuditLogs() {
  loading.value = true
  try {
    const response = await requestFetch<AuditLogsResponse>('/api/audit-logs', {
      query: {
        page: page.value,
        ...(filters.resource ? { resource: filters.resource } : {}),
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
      },
    })

    logs.value = response.data.logs
    meta.value = response.meta ?? null
  } finally {
    loading.value = false
  }
}

await useAsyncData(
  'admin-audit-logs-bootstrap',
  async () => {
    await loadAuditLogs()
    return true
  },
  {
    default: () => true,
  },
)

function resetFilters() {
  filters.resource = undefined
  filters.action = undefined
  filters.from = undefined
  filters.to = undefined
  page.value = 1
  void loadAuditLogs()
}

watch(page, () => {
  void loadAuditLogs()
})
</script>

<template>
  <div class="space-y-8">
    <section class="page-stage-hero panel-surface hero-wash p-6 sm:p-8">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-4">
          <div class="section-chip">M7 · Auditoría</div>
          <SipacSectionHeader
            title="Registro de auditoría"
            description="Consulta acciones críticas del sistema con filtros mínimos y paginación."
            size="md"
          />
        </div>

        <div class="flex flex-wrap gap-3">
          <SipacButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-rotate-ccw"
            :loading="loading"
            @click="resetFilters"
          >
            Limpiar filtros
          </SipacButton>
          <SipacButton icon="i-lucide-filter" :loading="loading" @click="loadAuditLogs">
            Aplicar filtros
          </SipacButton>
        </div>
      </div>
    </section>

    <SipacCard class="page-stage-primary">
      <template #header>
        <div class="grid gap-3 md:grid-cols-4">
          <USelect
            v-model="filters.resource"
            color="neutral"
            variant="outline"
            :items="resourceOptions"
          />
          <USelect
            v-model="filters.action"
            color="neutral"
            variant="outline"
            :items="actionOptions"
          />
          <UInput v-model="filters.from" color="neutral" variant="outline" type="date" />
          <UInput v-model="filters.to" color="neutral" variant="outline" type="date" />
        </div>
      </template>

      <div v-if="loading && !logs.length" class="py-10 text-center text-sm text-text-muted">
        Cargando registros...
      </div>

      <div v-else-if="logs.length" class="space-y-3">
        <article
          v-for="log in logs"
          :key="log._id"
          class="panel-muted space-y-3 rounded-[1rem] p-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-2">
              <SipacBadge color="primary" variant="subtle">{{ log.resource }}</SipacBadge>
              <SipacBadge color="neutral" variant="outline">{{ log.action }}</SipacBadge>
            </div>
            <p class="text-xs text-text-soft">{{ log.createdAt }}</p>
          </div>

          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p class="text-xs font-semibold tracking-[0.12em] text-text-soft uppercase">
                Usuario
              </p>
              <p class="mt-1 text-sm text-text">{{ log.userName }}</p>
            </div>
            <div>
              <p class="text-xs font-semibold tracking-[0.12em] text-text-soft uppercase">IP</p>
              <p class="mt-1 text-sm text-text">{{ log.ipAddress }}</p>
            </div>
            <div>
              <p class="text-xs font-semibold tracking-[0.12em] text-text-soft uppercase">
                Resource ID
              </p>
              <p class="mt-1 break-all text-sm text-text">{{ log.resourceId || '—' }}</p>
            </div>
            <div>
              <p class="text-xs font-semibold tracking-[0.12em] text-text-soft uppercase">
                User-Agent
              </p>
              <p class="mt-1 break-all text-sm text-text">{{ log.userAgent || '—' }}</p>
            </div>
          </div>

          <div
            v-if="log.details"
            class="rounded-xl border border-border/60 bg-white/80 p-3 text-sm text-text-muted"
          >
            {{ log.details }}
          </div>
        </article>
      </div>

      <UEmpty
        v-else
        icon="i-lucide-scroll-text"
        title="Sin registros para esta consulta"
        description="Ajusta filtros o prueba con otro rango de fechas."
      />

      <template #footer>
        <div class="flex items-center justify-between gap-4">
          <p class="text-sm text-text-muted">
            {{ meta?.total ?? logs.length }} registro{{
              (meta?.total ?? logs.length) === 1 ? '' : 's'
            }}.
          </p>

          <UPagination
            v-if="meta"
            v-model:page="page"
            :total="meta.total"
            :items-per-page="meta.limit"
            show-edges
            :sibling-count="1"
          />
        </div>
      </template>
    </SipacCard>
  </div>
</template>
