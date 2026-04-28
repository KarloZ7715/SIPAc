<script setup lang="ts">
import type { ApiSuccessResponse } from '~~/app/types'

definePageMeta({ middleware: ['admin'] })

interface SystemResponse {
  health: 'healthy' | 'degraded' | 'offline'
  timestamp: string
  system: {
    uptimeSeconds: number
    memoryUsage: {
      rss: number
      heapTotal: number
      heapUsed: number
    }
    os: {
      platform: string
      release: string
      totalMem: number
      freeMem: number
      loadAvg: number[]
    }
  }
  database: {
    status: string
    name: string
    host: string
  }
  services: {
    ocr: { status: string; lastProcessed: string | null; queueLength: number }
    ner: { status: string; lastExtracted: string | null; queueLength: number }
  }
}

const loading = ref(false)
const systemData = ref<SystemResponse | null>(null)

async function fetchSystemData() {
  loading.value = true
  try {
    const res = await $fetch<ApiSuccessResponse<SystemResponse>>('/api/admin/system')
    systemData.value = res.data
  } catch (err) {
    console.error('Error loading system data', err)
  } finally {
    loading.value = false
  }
}

await useAsyncData('admin-system', async () => {
  await fetchSystemData()
  return true
})

// Auto-refresh every 30s
let refreshInterval: ReturnType<typeof setInterval>
onMounted(() => {
  refreshInterval = setInterval(() => {
    void fetchSystemData()
  }, 30000)
})
onUnmounted(() => {
  clearInterval(refreshInterval)
})

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / (3600 * 24))
  const h = Math.floor((seconds % (3600 * 24)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${d}d ${h}h ${m}m ${s}s`
}

function formatServiceTime(iso: string | null) {
  if (!iso) return 'N/D'
  return new Date(iso).toLocaleTimeString('es-CO')
}

const memoryPercentage = computed(() => {
  if (!systemData.value) return 0
  const used = systemData.value.system.memoryUsage.heapUsed
  const total = systemData.value.system.memoryUsage.heapTotal
  return Math.round((used / total) * 100)
})
</script>

<template>
  <div class="space-y-8">
    <section class="page-stage-hero panel-surface hero-wash p-6 sm:p-8">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-4">
          <div class="flex items-center gap-2">
            <div class="section-chip">Observabilidad</div>
            <SipacBadge
              v-if="systemData"
              :variant="systemData.health === 'healthy' ? 'outline' : 'solid'"
              :color="systemData.health === 'healthy' ? 'success' : 'error'"
              :label="systemData.health === 'healthy' ? 'Sistema Saludable' : 'Sistema Degradado'"
              size="sm"
            />
          </div>
          <SipacSectionHeader
            title="Salud del Sistema"
            description="Métricas de rendimiento, uso de memoria y estado de servicios en tiempo real."
            size="md"
          />
        </div>
        <SipacButton
          variant="outline"
          color="neutral"
          icon="i-lucide-refresh-cw"
          :class="loading ? 'animate-spin-reverse' : ''"
          @click="fetchSystemData"
        >
          Actualizar
        </SipacButton>
      </div>
    </section>

    <div v-if="systemData" class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <!-- Node Process -->
      <SipacCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-cpu" class="text-text-soft" />
            <h3 class="font-semibold text-text">Proceso Node.js</h3>
          </div>
        </template>
        <div class="space-y-4 text-sm">
          <div class="flex justify-between border-b border-border/50 pb-2">
            <span class="text-text-muted">Tiempo activo</span>
            <span class="font-medium text-text">{{
              formatUptime(systemData.system.uptimeSeconds)
            }}</span>
          </div>
          <div class="flex justify-between border-b border-border/50 pb-2">
            <span class="text-text-muted">Uso de Heap</span>
            <span class="font-medium text-text">
              {{ formatBytes(systemData.system.memoryUsage.heapUsed) }} /
              {{ formatBytes(systemData.system.memoryUsage.heapTotal) }}
            </span>
          </div>
          <div class="space-y-1">
            <div class="flex justify-between text-xs">
              <span class="text-text-muted">Presión de Memoria</span>
              <span class="font-medium text-text">{{ memoryPercentage }}%</span>
            </div>
            <UProgress
              :value="memoryPercentage"
              :color="
                memoryPercentage > 85 ? 'error' : memoryPercentage > 70 ? 'warning' : 'primary'
              "
            />
          </div>
        </div>
      </SipacCard>

      <!-- Database -->
      <SipacCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-database" class="text-text-soft" />
            <h3 class="font-semibold text-text">Base de Datos (MongoDB)</h3>
          </div>
        </template>
        <div class="space-y-4 text-sm">
          <div class="flex justify-between border-b border-border/50 pb-2">
            <span class="text-text-muted">Estado de Conexión</span>
            <SipacBadge
              :variant="systemData.database.status === 'connected' ? 'outline' : 'solid'"
              :color="systemData.database.status === 'connected' ? 'success' : 'error'"
              :label="systemData.database.status"
              size="sm"
            />
          </div>
          <div class="flex justify-between border-b border-border/50 pb-2">
            <span class="text-text-muted">Host</span>
            <span class="font-medium text-text">{{ systemData.database.host || 'N/A' }}</span>
          </div>
          <div class="flex justify-between pb-2">
            <span class="text-text-muted">Nombre DB</span>
            <span class="font-medium text-text">{{ systemData.database.name || 'N/A' }}</span>
          </div>
        </div>
      </SipacCard>

      <!-- Pipeline OCR/NER -->
      <SipacCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-brain-circuit" class="text-text-soft" />
            <h3 class="font-semibold text-text">Servicios de Extracción</h3>
          </div>
        </template>
        <div class="space-y-4 text-sm">
          <div class="flex flex-col gap-1 border-b border-border/50 pb-2">
            <div class="flex items-center justify-between">
              <span class="font-medium text-text">Motor OCR</span>
              <SipacBadge variant="subtle" color="success" label="En línea" size="sm" />
            </div>
            <div class="flex items-center justify-between text-xs text-text-muted">
              <span>Cola: {{ systemData.services.ocr.queueLength }} docs</span>
              <span>Último: {{ formatServiceTime(systemData.services.ocr.lastProcessed) }}</span>
            </div>
          </div>
          <div class="flex flex-col gap-1 pb-2">
            <div class="flex items-center justify-between">
              <span class="font-medium text-text">Motor NER (Groq)</span>
              <SipacBadge variant="subtle" color="success" label="En línea" size="sm" />
            </div>
            <div class="flex items-center justify-between text-xs text-text-muted">
              <span>Cola: {{ systemData.services.ner.queueLength }} peticiones</span>
              <span>Último: {{ formatServiceTime(systemData.services.ner.lastExtracted) }}</span>
            </div>
          </div>
        </div>
      </SipacCard>

      <!-- Host OS -->
      <SipacCard class="md:col-span-2 lg:col-span-3">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-server" class="text-text-soft" />
            <h3 class="font-semibold text-text">Sistema Operativo Host</h3>
          </div>
        </template>
        <div class="grid gap-6 md:grid-cols-3">
          <div class="space-y-1">
            <p class="text-sm text-text-muted">Plataforma</p>
            <p class="font-medium text-text capitalize">
              {{ systemData.system.os.platform }} ({{ systemData.system.os.release }})
            </p>
          </div>
          <div class="space-y-1">
            <p class="text-sm text-text-muted">Carga Promedio (1m, 5m, 15m)</p>
            <p class="font-medium text-text font-mono">
              {{ systemData.system.os.loadAvg.map((n) => n.toFixed(2)).join(', ') }}
            </p>
          </div>
          <div class="space-y-1">
            <p class="text-sm text-text-muted">Memoria Libre</p>
            <p class="font-medium text-text">
              {{ formatBytes(systemData.system.os.freeMem) }} /
              {{ formatBytes(systemData.system.os.totalMem) }}
            </p>
          </div>
        </div>
      </SipacCard>
    </div>

    <!-- Loading Skeleton -->
    <div v-else class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <USkeleton class="h-48 w-full" />
      <USkeleton class="h-48 w-full" />
      <USkeleton class="h-48 w-full" />
    </div>
  </div>
</template>
