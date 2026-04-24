<script setup lang="ts">
import type {
  NotificationListDensity,
  NotificationPublic,
  NotificationQuickFilter,
} from '~~/app/types'

const notificationsStore = useNotificationsStore()
const toast = useToast()
const { densityPreference } = useUiPreferences()

const quickFilterOptions: Array<{
  value: NotificationQuickFilter
  label: string
  icon: string
}> = [
  { value: 'all', label: 'Todas', icon: 'i-lucide-list' },
  { value: 'unread', label: 'Sin leer', icon: 'i-lucide-mail-open' },
  { value: 'errors', label: 'Errores', icon: 'i-lucide-triangle-alert' },
  { value: 'system', label: 'Sistema', icon: 'i-lucide-shield-check' },
]

const pollingIntervalOptions = [
  { label: '10 segundos', value: 10000 },
  { label: '15 segundos', value: 15000 },
  { label: '30 segundos', value: 30000 },
  { label: '60 segundos', value: 60000 },
]

const densityOptions: Array<{ label: string; value: NotificationListDensity }> = [
  { label: 'Comoda', value: 'comfortable' },
  { label: 'Compacta', value: 'compact' },
]

const UNDO_DELETE_WINDOW_MS = 5000

interface PendingDeleteState {
  notification: NotificationPublic
  index: number
  timeoutId: ReturnType<typeof setTimeout>
}

const hasNotifications = computed(() => notificationsStore.notifications.length > 0)
const hasUnread = computed(() => notificationsStore.unreadCount > 0)
const isCompactInbox = computed(
  () => notificationsStore.listDensity === 'compact' || densityPreference.value === 'compact',
)
const actionButtonSize = computed(() => (isCompactInbox.value ? 'xs' : 'sm'))
const showPreferences = ref(false)
const pendingDelete = ref<PendingDeleteState | null>(null)

const autoRefreshModel = computed({
  get: () => notificationsStore.autoRefreshEnabled,
  set: (next: boolean) => notificationsStore.setAutoRefreshEnabled(next),
})

const pollingIntervalModel = computed({
  get: () => notificationsStore.pollingIntervalMs,
  set: (next: number) => notificationsStore.setPollingInterval(next),
})

const densityModel = computed<NotificationListDensity>({
  get: () => notificationsStore.listDensity,
  set: (next: NotificationListDensity) => notificationsStore.setListDensity(next),
})

interface GroupedNotifications {
  key: string
  label: string
  notifications: NotificationPublic[]
}

const groupedNotifications = computed<GroupedNotifications[]>(() => {
  const grouped = new Map<string, GroupedNotifications>()

  for (const notification of notificationsStore.notifications) {
    const temporalGroup = resolveTemporalGroup(notification.createdAt)
    const existingGroup = grouped.get(temporalGroup.key)

    if (existingGroup) {
      existingGroup.notifications.push(notification)
      continue
    }

    grouped.set(temporalGroup.key, {
      key: temporalGroup.key,
      label: temporalGroup.label,
      notifications: [notification],
    })
  }

  return [...grouped.values()]
})

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function resolveTemporalGroup(value: string) {
  const date = new Date(value)
  const now = new Date()

  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)

  const startOfWeek = new Date(startOfToday)
  const day = startOfWeek.getDay()
  const diff = day === 0 ? 6 : day - 1
  startOfWeek.setDate(startOfWeek.getDate() - diff)

  if (date >= startOfToday) {
    return { key: 'today', label: 'Hoy' }
  }

  if (date >= startOfYesterday) {
    return { key: 'yesterday', label: 'Ayer' }
  }

  if (date >= startOfWeek) {
    return { key: 'this-week', label: 'Esta semana' }
  }

  return {
    key: `month-${date.getFullYear()}-${date.getMonth()}`,
    label: new Intl.DateTimeFormat('es-CO', {
      month: 'long',
      year: 'numeric',
    }).format(date),
  }
}

function notificationTypeLabel(notification: NotificationPublic) {
  if (notification.type === 'processing_error') {
    return 'Atencion'
  }

  if (notification.type === 'system') {
    return 'Sistema'
  }

  return 'Informativa'
}

function notificationTypeColor(notification: NotificationPublic) {
  if (notification.type === 'processing_error') {
    return 'warning'
  }

  if (notification.type === 'system') {
    return 'primary'
  }

  return 'neutral'
}

function notifyActionError(title: string) {
  toast.add({
    title,
    description: 'Intenta de nuevo en unos segundos.',
    icon: 'i-lucide-circle-alert',
    color: 'error',
  })
}

async function flushPendingDelete() {
  const pending = pendingDelete.value
  if (!pending) {
    return
  }

  clearTimeout(pending.timeoutId)
  pendingDelete.value = null

  try {
    await notificationsStore.commitDeleteNotification(pending.notification._id)
  } catch {
    notificationsStore.restoreNotificationLocally(pending.notification, pending.index)
    notifyActionError('No se pudo confirmar la eliminacion')
  }
}

async function finalizePendingDelete(notificationId: string) {
  const pending = pendingDelete.value
  if (!pending || pending.notification._id !== notificationId) {
    return
  }

  pendingDelete.value = null

  try {
    await notificationsStore.commitDeleteNotification(notificationId)
  } catch {
    notificationsStore.restoreNotificationLocally(pending.notification, pending.index)
    notifyActionError('No se pudo eliminar la notificacion')
  }
}

function undoPendingDelete() {
  const pending = pendingDelete.value
  if (!pending) {
    return
  }

  clearTimeout(pending.timeoutId)
  notificationsStore.restoreNotificationLocally(pending.notification, pending.index)
  pendingDelete.value = null

  toast.add({
    title: 'Eliminacion cancelada',
    description: 'La notificacion fue restaurada en la bandeja.',
    icon: 'i-lucide-rotate-ccw',
    color: 'neutral',
  })
}

async function onRefresh() {
  try {
    await notificationsStore.fetchNotifications({ silent: true })
  } catch {
    notifyActionError('No se pudo actualizar la bandeja')
  }
}

async function onMarkAsRead(notificationId: string) {
  try {
    await notificationsStore.markAsRead(notificationId)
  } catch {
    notifyActionError('No se pudo marcar la notificacion como leida')
  }
}

async function onMarkAllAsRead() {
  try {
    await notificationsStore.markAllAsRead()
  } catch {
    notifyActionError('No se pudieron marcar todas como leidas')
  }
}

async function onDeleteNotification(notificationId: string) {
  try {
    await flushPendingDelete()

    const removedNotification = notificationsStore.removeNotificationLocally(notificationId)
    if (!removedNotification) {
      await notificationsStore.deleteNotification(notificationId)
      return
    }

    const pending: PendingDeleteState = {
      notification: removedNotification.notification,
      index: removedNotification.index,
      timeoutId: setTimeout(() => {
        void finalizePendingDelete(removedNotification.notification._id)
      }, UNDO_DELETE_WINDOW_MS),
    }

    pendingDelete.value = pending

    toast.add({
      title: 'Notificacion eliminada',
      description: 'Tienes 5 segundos para deshacer la accion.',
      icon: 'i-lucide-trash-2',
      color: 'warning',
      duration: UNDO_DELETE_WINDOW_MS,
      actions: [
        {
          label: 'Deshacer',
          icon: 'i-lucide-rotate-ccw',
          onClick: () => undoPendingDelete(),
        },
      ],
    })
  } catch {
    notifyActionError('No se pudo eliminar la notificacion')
  }
}

async function onDeleteAll() {
  try {
    await flushPendingDelete()
    await notificationsStore.deleteAllNotifications()
  } catch {
    notifyActionError('No se pudieron eliminar las notificaciones')
  }
}

async function onLoadMore() {
  try {
    await notificationsStore.loadMoreNotifications()
  } catch {
    notifyActionError('No se pudieron cargar mas notificaciones')
  }
}

function onSetFilter(nextFilter: NotificationQuickFilter) {
  notificationsStore.setActiveFilter(nextFilter)
}

onBeforeUnmount(() => {
  if (pendingDelete.value) {
    clearTimeout(pendingDelete.value.timeoutId)
    void finalizePendingDelete(pendingDelete.value.notification._id)
  }
})
</script>

<template>
  <section
    class="notifications-inbox overflow-x-hidden"
    :class="isCompactInbox ? 'space-y-3' : 'space-y-4'"
    :data-density="isCompactInbox ? 'compact' : 'comfortable'"
    :aria-busy="notificationsStore.refreshing ? 'true' : 'false'"
  >
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
          Bandeja activa
        </p>
        <p class="mt-1 text-sm text-text-muted">
          Cambios de estado del procesamiento disponibles solo dentro de SIPAc.
        </p>
      </div>

      <div class="flex items-center gap-1.5">
        <SipacButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          :size="actionButtonSize"
          :loading="notificationsStore.refreshing"
          :disabled="notificationsStore.loading"
          aria-label="Actualizar bandeja de notificaciones"
          @click="onRefresh"
        >
          Actualizar
        </SipacButton>

        <SipacButton
          :icon="showPreferences ? 'i-lucide-sliders-horizontal' : 'i-lucide-settings-2'"
          color="neutral"
          variant="ghost"
          :size="actionButtonSize"
          :aria-expanded="showPreferences ? 'true' : 'false'"
          aria-controls="notifications-preferences-panel"
          aria-label="Configurar preferencias de bandeja"
          @click="showPreferences = !showPreferences"
        >
          Preferencias
        </SipacButton>
      </div>
    </div>

    <div
      v-if="showPreferences"
      id="notifications-preferences-panel"
      class="grid gap-3 rounded-xl border border-border/70 bg-white/75 p-3 sm:grid-cols-2"
    >
      <UFormField
        label="Autoactualizacion"
        name="notifications-auto-refresh"
        class="flex flex-row items-center justify-between gap-3"
      >
        <USwitch v-model="autoRefreshModel" aria-label="Activar autoactualizacion" />
      </UFormField>

      <UFormField label="Intervalo" name="notifications-refresh-interval">
        <USelectMenu
          v-model="pollingIntervalModel"
          :items="pollingIntervalOptions"
          value-key="value"
          class="w-full"
          :disabled="!autoRefreshModel"
        />
      </UFormField>

      <UFormField label="Densidad" name="notifications-density" class="sm:col-span-2">
        <p class="mb-1 text-xs leading-5 text-text-muted">
          Compacta reduce espacios para mostrar mas contenido por pantalla.
        </p>
        <USelectMenu
          v-model="densityModel"
          :items="densityOptions"
          value-key="value"
          class="w-full"
        />
      </UFormField>
    </div>

    <div class="flex flex-wrap gap-2" role="group" aria-label="Filtros de notificaciones">
      <SipacButton
        v-for="filterOption in quickFilterOptions"
        :key="filterOption.value"
        :icon="filterOption.icon"
        :size="actionButtonSize"
        :variant="notificationsStore.activeFilter === filterOption.value ? 'soft' : 'ghost'"
        :color="notificationsStore.activeFilter === filterOption.value ? 'primary' : 'neutral'"
        :aria-pressed="notificationsStore.activeFilter === filterOption.value ? 'true' : 'false'"
        @click="onSetFilter(filterOption.value)"
      >
        {{ filterOption.label }}
      </SipacButton>
    </div>

    <div
      class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-white/75 p-3"
    >
      <div class="flex flex-wrap gap-2" aria-live="polite">
        <SipacBadge color="primary" variant="subtle">
          {{ notificationsStore.unreadCount }} sin leer
        </SipacBadge>
        <SipacBadge color="neutral" variant="outline">
          {{ notificationsStore.notifications.length }} visibles
        </SipacBadge>
        <span v-if="notificationsStore.refreshing" class="text-xs text-text-muted">
          Actualizando sin interrumpir tu lectura...
        </span>
      </div>

      <div v-if="hasNotifications" class="flex flex-wrap gap-2">
        <SipacButton
          icon="i-lucide-check-check"
          color="neutral"
          variant="soft"
          :size="actionButtonSize"
          :disabled="!hasUnread || notificationsStore.markingAll"
          :loading="notificationsStore.markingAll"
          @click="onMarkAllAsRead"
        >
          Marcar todas
        </SipacButton>

        <SipacButton
          icon="i-lucide-trash-2"
          color="error"
          variant="soft"
          :size="actionButtonSize"
          :disabled="notificationsStore.deletingAll"
          :loading="notificationsStore.deletingAll"
          @click="onDeleteAll"
        >
          Eliminar todas
        </SipacButton>
      </div>
    </div>

    <div
      v-if="notificationsStore.loading && !hasNotifications"
      class="space-y-3"
      aria-live="polite"
    >
      <USkeleton v-for="index in 3" :key="index" class="h-24 rounded-2xl" />
    </div>

    <div v-else-if="hasNotifications" :class="isCompactInbox ? 'space-y-3' : 'space-y-5'">
      <section
        v-for="group in groupedNotifications"
        :key="group.key"
        :class="isCompactInbox ? 'space-y-2' : 'space-y-3'"
      >
        <header class="flex items-center justify-between gap-2">
          <h3 class="text-xs font-semibold tracking-[0.16em] text-text-muted uppercase">
            {{ group.label }}
          </h3>
          <span class="text-xs text-text-muted">{{ group.notifications.length }}</span>
        </header>

        <TransitionGroup
          name="notifications-list"
          tag="div"
          :class="isCompactInbox ? 'space-y-2' : 'space-y-3'"
        >
          <article
            v-for="notification in group.notifications"
            :key="notification._id"
            class="notifications-card rounded-[1.3rem] border border-border/70 bg-white/90"
            :class="isCompactInbox ? 'p-2.5' : 'p-4'"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p
                  class="wrap-break-word font-semibold text-text"
                  :class="isCompactInbox ? 'text-[0.86rem] leading-5' : ''"
                >
                  {{ notification.title }}
                </p>
                <p
                  class="mt-1 wrap-break-word text-sm text-text-muted"
                  :class="isCompactInbox ? 'leading-5 text-[0.8rem]' : 'leading-6'"
                >
                  {{ notification.message }}
                </p>
              </div>

              <SipacBadge :color="notification.isRead ? 'neutral' : 'primary'" variant="subtle">
                {{ notification.isRead ? 'Leida' : 'Nueva' }}
              </SipacBadge>
            </div>

            <div
              class="flex flex-wrap items-center justify-between"
              :class="isCompactInbox ? 'mt-2.5 gap-2' : 'mt-4 gap-3'"
            >
              <p class="text-xs tracking-[0.12em] text-text-muted uppercase">
                {{ formatDate(notification.createdAt) }}
              </p>

              <div
                class="flex flex-wrap items-center"
                :class="isCompactInbox ? 'gap-1.5' : 'gap-2'"
              >
                <SipacBadge :color="notificationTypeColor(notification)" variant="outline">
                  {{ notificationTypeLabel(notification) }}
                </SipacBadge>

                <SipacButton
                  v-if="!notification.isRead"
                  icon="i-lucide-check-check"
                  color="neutral"
                  variant="ghost"
                  :size="actionButtonSize"
                  :loading="notificationsStore.isMarking(notification._id)"
                  :disabled="notificationsStore.isDeleting(notification._id)"
                  @click="onMarkAsRead(notification._id)"
                >
                  Marcar leida
                </SipacButton>

                <SipacButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  :size="actionButtonSize"
                  :loading="notificationsStore.isDeleting(notification._id)"
                  :disabled="notificationsStore.isMarking(notification._id)"
                  @click="onDeleteNotification(notification._id)"
                >
                  Eliminar
                </SipacButton>
              </div>
            </div>
          </article>
        </TransitionGroup>
      </section>

      <div v-if="notificationsStore.hasMore" class="flex justify-center pt-1">
        <SipacButton
          icon="i-lucide-chevrons-down"
          color="neutral"
          variant="soft"
          :size="actionButtonSize"
          :loading="notificationsStore.loadingMore"
          :disabled="notificationsStore.loadingMore"
          @click="onLoadMore"
        >
          Cargar mas
        </SipacButton>
      </div>
    </div>

    <UEmpty
      v-else
      icon="i-lucide-bell-ring"
      title="Sin notificaciones por ahora"
      description="Cuando un documento termine o falle en el procesamiento veras aqui el cambio de estado."
    />
  </section>
</template>

<style scoped>
.notifications-card {
  transition:
    border-color 220ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.notifications-card:hover {
  border-color: rgb(201 100 66 / 0.32);
  box-shadow: 0 16px 32px -30px rgb(20 20 19 / 0.35);
  transform: translateY(-1px);
}

.notifications-inbox[data-density='compact'] .notifications-card {
  border-radius: 0.95rem;
}

.notifications-inbox[data-density='compact'] .notifications-card:hover {
  box-shadow: 0 10px 18px -16px rgb(20 20 19 / 0.26);
  transform: none;
}

.notifications-list-enter-active,
.notifications-list-leave-active,
.notifications-list-move {
  transition: all 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.notifications-list-enter-from,
.notifications-list-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.notifications-inbox[data-density='compact'] .notifications-list-enter-from,
.notifications-inbox[data-density='compact'] .notifications-list-leave-to {
  transform: translateY(4px);
}

@media (prefers-reduced-motion: reduce) {
  .notifications-card,
  .notifications-list-enter-active,
  .notifications-list-leave-active,
  .notifications-list-move {
    transition: none;
  }
}
</style>
