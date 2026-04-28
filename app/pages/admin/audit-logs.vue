<script setup lang="ts">
import { h, resolveComponent } from 'vue'
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

const actionLabels: Record<string, string> = {
  create: 'Crear',
  update: 'Actualizar',
  delete: 'Eliminar',
  login: 'Login',
  login_failed: 'Login fallido',
}

const resourceLabels: Record<string, string> = {
  academic_product: 'Producto',
  uploaded_file: 'Archivo',
  user: 'Usuario',
  session: 'Sesión',
  chat_conversation: 'Chat',
}

const columns = [
  {
    accessorKey: 'createdAt' as const,
    header: 'Fecha',
    cell: ({ row }: { row: { original: AuditLogPublic } }) => {
      return formatDate(row.original.createdAt)
    },
  },
  { accessorKey: 'userName' as const, header: 'Usuario' },
  {
    accessorKey: 'resource' as const,
    header: 'Recurso',
    cell: ({ row }: { row: { original: AuditLogPublic } }) => {
      return h(resolveComponent('SipacBadge'), {
        variant: 'subtle',
        color: 'primary',
        label: resourceLabels[row.original.resource] ?? row.original.resource,
        size: 'sm',
      })
    },
  },
  {
    accessorKey: 'action' as const,
    header: 'Acción',
    cell: ({ row }: { row: { original: AuditLogPublic } }) => {
      const action = row.original.action
      const color =
        action === 'delete' ? 'error' : action === 'login_failed' ? 'warning' : 'neutral'
      return h(resolveComponent('SipacBadge'), {
        variant: 'outline',
        color,
        label: actionLabels[action] ?? action,
        size: 'sm',
      })
    },
  },
  { accessorKey: 'ipAddress' as const, header: 'IP' },
  {
    accessorKey: 'details' as const,
    header: 'Detalle',
    cell: ({ row }: { row: { original: AuditLogPublic } }) => {
      const d = row.original.details
      return d && d.length > 60 ? `${d.slice(0, 60)}…` : d || '—'
    },
  },
  {
    accessorKey: 'userAgent' as const,
    header: 'Agente',
    cell: ({ row }: { row: { original: AuditLogPublic } }) => {
      return parseUserAgent(row.original.userAgent)
    },
  },
]

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parseUserAgent(ua?: string) {
  if (!ua) return '—'
  // Extract browser + OS in a readable format
  const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/(\d+)/)
  const osMatch = ua.match(/(Windows|Mac OS X|Linux|Android|iOS)/)
  const browser = browserMatch ? `${browserMatch[1]} ${browserMatch[2]}` : 'Otro'
  const os = osMatch?.[1]?.replace('Mac OS X', 'macOS') ?? ''
  return os ? `${browser} / ${os}` : browser
}

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

function setDateRange(days: number) {
  const now = new Date()
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  filters.from = from.toISOString().slice(0, 10)
  filters.to = now.toISOString().slice(0, 10)
}

function exportCSV() {
  const headers = ['Fecha', 'Usuario', 'Recurso', 'Acción', 'IP', 'Detalle', 'User-Agent']
  const rows = logs.value.map((l) => [
    formatDate(l.createdAt),
    l.userName,
    resourceLabels[l.resource] ?? l.resource,
    actionLabels[l.action] ?? l.action,
    l.ipAddress,
    l.details || '',
    parseUserAgent(l.userAgent),
  ])

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `audit_logs_sipac_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// Reactive filters (P10 fix)
watch([() => filters.resource, () => filters.action, () => filters.from, () => filters.to], () => {
  page.value = 1
  void loadAuditLogs()
})

watch(page, () => {
  void loadAuditLogs()
})
</script>

<template>
  <div class="space-y-8">
    <section class="page-stage-hero panel-surface hero-wash p-6 sm:p-8">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-4">
          <div class="section-chip">Auditoría</div>
          <SipacSectionHeader
            title="Registro de auditoría"
            description="Investigación de acciones del sistema con filtros reactivos y exportación."
            size="md"
          />
        </div>

        <div class="flex flex-wrap gap-2">
          <SipacButton
            icon="i-lucide-download"
            color="neutral"
            variant="soft"
            :disabled="!logs.length"
            @click="exportCSV"
          >
            Exportar CSV
          </SipacButton>
          <SipacButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-rotate-ccw"
            :loading="loading"
            @click="resetFilters"
          >
            Limpiar
          </SipacButton>
        </div>
      </div>
    </section>

    <SipacCard class="page-stage-primary">
      <template #header>
        <div class="space-y-3">
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

          <div class="flex flex-wrap gap-2">
            <SipacButton size="xs" color="neutral" variant="soft" @click="setDateRange(0)">
              Hoy
            </SipacButton>
            <SipacButton size="xs" color="neutral" variant="soft" @click="setDateRange(7)">
              Últimos 7 días
            </SipacButton>
            <SipacButton size="xs" color="neutral" variant="soft" @click="setDateRange(30)">
              Últimos 30 días
            </SipacButton>
          </div>
        </div>
      </template>

      <UTable
        v-if="logs.length || loading"
        :data="logs"
        :columns="columns"
        :loading="loading"
        class="w-full text-sm"
      />

      <UEmpty
        v-else
        icon="i-lucide-scroll-text"
        title="Sin registros para esta consulta"
        description="Ajusta filtros o prueba con otro rango de fechas."
      />

      <template #footer>
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
