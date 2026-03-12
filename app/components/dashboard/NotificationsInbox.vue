<script setup lang="ts">
const notificationsStore = useNotificationsStore()

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

async function onMarkAsRead(notificationId: string) {
  await notificationsStore.markAsRead(notificationId)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-xs font-semibold tracking-[0.16em] text-text-soft uppercase">
          Bandeja activa
        </p>
        <p class="mt-1 text-sm text-text-muted">
          Cambios de estado del procesamiento y avisos enviados al correo institucional.
        </p>
      </div>

      <SipacButton
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="ghost"
        size="sm"
        @click="notificationsStore.fetchNotifications()"
      >
        Actualizar
      </SipacButton>
    </div>

    <div class="flex flex-wrap gap-2">
      <SipacBadge color="primary" variant="subtle">
        {{ notificationsStore.unreadCount }} sin leer
      </SipacBadge>
      <SipacBadge color="neutral" variant="outline">
        {{ notificationsStore.notifications.length }} visibles
      </SipacBadge>
    </div>

    <div v-if="notificationsStore.loading" class="space-y-3">
      <USkeleton v-for="index in 3" :key="index" class="h-24 rounded-2xl" />
    </div>

    <div v-else-if="notificationsStore.notifications.length" class="space-y-3">
      <article
        v-for="notification in notificationsStore.notifications"
        :key="notification._id"
        class="rounded-[1.3rem] border border-border/70 bg-white/90 p-4"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-semibold text-text">{{ notification.title }}</p>
            <p class="mt-1 text-sm leading-6 text-text-muted">{{ notification.message }}</p>
          </div>

          <SipacBadge :color="notification.isRead ? 'neutral' : 'primary'" variant="subtle">
            {{ notification.isRead ? 'Leida' : 'Nueva' }}
          </SipacBadge>
        </div>

        <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p class="text-xs tracking-[0.12em] text-text-soft uppercase">
            {{ formatDate(notification.createdAt) }}
          </p>

          <div class="flex flex-wrap items-center gap-2">
            <SipacBadge :color="notification.emailSent ? 'success' : 'warning'" variant="outline">
              {{ notification.emailSent ? 'Correo enviado' : 'Solo app' }}
            </SipacBadge>
            <SipacButton
              v-if="!notification.isRead"
              icon="i-lucide-check-check"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="onMarkAsRead(notification._id)"
            >
              Marcar leida
            </SipacButton>
          </div>
        </div>
      </article>
    </div>

    <UEmpty
      v-else
      icon="i-lucide-bell-ring"
      title="Sin notificaciones por ahora"
      description="Cuando un documento termine o falle en el procesamiento verás aquí el cambio de estado."
    />
  </div>
</template>