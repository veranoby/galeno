<!-- apps/web/src/components/hub/NotificationCenter.vue -->
<template>
  <div class="notification-center">
    <div class="notification-header">
      <h3 class="text-h6 font-weight-bold">Notificaciones</h3>
      <v-btn
        v-if="notifications.length > 0"
        variant="text"
        size="small"
        @click="markAllAsRead"
      >
        Marcar todas como leídas
      </v-btn>
    </div>

    <div v-if="notifications.length === 0" class="empty-state">
      <v-icon size="64" color="grey-lighten-2" class="mb-4">mdi-bell-off</v-icon>
      <p class="text-grey-darken-1">No hay notificaciones</p>
    </div>

    <v-list v-else class="notification-list bg-transparent">
      <v-list-item
        v-for="notification in notifications"
        :key="notification.id"
        :class="{ 'unread': !notification.read }"
        variant="tonal"
        rounded="lg"
        class="mb-2"
      >
        <template v-slot:prepend>
          <v-avatar :color="notificationTypeColor(notification.type)" size="40">
            <v-icon color="white">{{ notificationTypeIcon(notification.type) }}</v-icon>
          </v-avatar>
        </template>

        <v-list-item-title class="font-weight-bold">
          {{ notification.title }}
        </v-list-item-title>

        <v-list-item-subtitle class="mt-1">
          {{ notification.message }}
        </v-list-item-subtitle>

        <v-list-item-subtitle class="text-caption mt-2">
          {{ formatTime(notification.createdAt) }}
        </v-list-item-subtitle>

        <template v-slot:append>
          <v-btn
            icon
            size="small"
            variant="text"
            @click="markAsRead(notification.id)"
          >
            <v-icon size="small">
              {{ notification.read ? 'mdi-check' : 'mdi-circle-outline' }}
            </v-icon>
          </v-btn>
        </template>
      </v-list-item>
    </v-list>

    <div v-if="hasMore" class="text-center mt-4">
      <v-btn variant="text" @click="loadMore">
        Cargar más
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useHubStore } from '@/stores/hub';

interface Notification {
  id: string;
  type: 'appointment' | 'patient' | 'consulta' | 'system' | 'payment';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const hubStore = useHubStore();
const notifications = ref<Notification[]>([]);
const hasMore = ref(false);

const notificationTypeIcon = (type: string): string => {
  const icons: Record<string, string> = {
    appointment: 'mdi-calendar',
    patient: 'mdi-account',
    consulta: 'mdi-file-document',
    system: 'mdi-cog',
    payment: 'mdi-cash'
  };
  return icons[type] || 'mdi-bell';
};

const notificationTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    appointment: 'primary',
    patient: 'success',
    consulta: 'warning',
    system: 'grey',
    payment: 'error'
  };
  return colors[type] || 'primary';
};

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) return 'Ahora mismo';
  if (hours < 24) return `Hace ${hours}h`;
  return date.toLocaleDateString('es-EC');
};

const markAsRead = (id: string) => {
  const notification = notifications.value.find(n => n.id === id);
  if (notification) {
    notification.read = true;
    updateUnreadCount();
  }
};

const markAllAsRead = () => {
  notifications.value.forEach(n => n.read = true);
  updateUnreadCount();
};

const updateUnreadCount = () => {
  const unread = notifications.value.filter(n => !n.read).length;
  hubStore.setUnreadNotifications(unread);
};

const loadMore = async () => {
  // TODO: Load more notifications from API
};

onMounted(() => {
  // TODO: Load notifications from API
  // Mock data for demo
  notifications.value = [
    {
      id: '1',
      type: 'appointment',
      title: 'Nueva cita agendada',
      message: 'Juan Pérez agendó una cita para mañana a las 10:00',
      read: false,
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      type: 'patient',
      message: 'María López completó su perfil',
      title: 'Nuevo paciente registrado',
      read: false,
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: '3',
      type: 'system',
      title: 'Actualización del sistema',
      message: 'Nueva funcionalidad de telemedicina disponible',
      read: true,
      createdAt: new Date(Date.now() - 86400000).toISOString()
    }
  ];

  updateUnreadCount();
});
</script>

<style scoped lang="scss">
.notification-center {
  max-height: 400px;
  overflow-y: auto;
}

.notification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
}

.notification-list {
  max-height: 300px;
  overflow-y: auto;
}

.v-list-item {
  &.unread {
    background-color: rgba(59, 130, 246, 0.1) !important;
  }
}
</style>
