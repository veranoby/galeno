<!-- apps/web/src/components/hub/HubLayout.vue -->
<template>
  <div class="hub-layout" :class="{ 'dark-mode': darkMode, 'compact-mode': compactMode }">
    <!-- Top Bar -->
    <header class="hub-topbar">
      <div class="topbar-left">
        <h1 class="text-h5 font-weight-bold">
          <v-icon start color="primary">mdi-view-dashboard</v-icon>
          Galeno Hub
        </h1>
      </div>

      <div class="topbar-actions">
        <!-- Search -->
        <v-text-field
          density="compact"
          placeholder="Buscar... (Ctrl+K)"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          hide-details
          class="search-field mr-4"
        />

        <!-- Dark Mode Toggle -->
        <v-btn
          icon
          variant="text"
          @click="toggleDarkMode"
          :title="darkMode ? 'Modo claro' : 'Modo oscuro'"
        >
          <v-icon>{{ darkMode ? 'mdi-white-balance-sunny' : 'mdi-moon-waning-crescent' }}</v-icon>
        </v-btn>

        <!-- Compact Mode Toggle -->
        <v-btn
          icon
          variant="text"
          @click="toggleCompactMode"
          :title="compactMode ? 'Modo normal' : 'Modo compacto'"
        >
          <v-icon>{{ compactMode ? 'mdi-arrow-expand' : 'mdi-arrow-collapse' }}</v-icon>
        </v-btn>

        <!-- Notifications -->
        <v-btn
          icon
          variant="text"
          @click="toggleNotifications"
          :title="'Notificaciones'"
        >
          <v-badge
            :content="unreadNotifications"
            :value="unreadNotifications > 0"
            color="error"
          >
            <v-icon>mdi-bell</v-icon>
          </v-badge>
        </v-btn>

        <!-- Settings -->
        <v-menu>
          <template v-slot:activator="{ props }">
            <v-btn icon v-bind="props">
              <v-icon>mdi-dots-vertical</v-icon>
            </v-btn>
          </template>
          <v-list>
            <v-list-item @click="resetLayout">
              <v-list-item-title>Restablecer diseño</v-list-item-title>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Ayuda de atajos</v-list-item-title>
              <v-list-item-subtitle>Ctrl+/</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </header>

    <!-- Notifications Panel -->
    <v-slide-y-transition>
      <div v-if="showNotifications" class="notifications-panel">
        <NotificationCenter />
      </div>
    </v-slide-y-transition>

    <!-- Widgets Grid -->
    <main class="hub-content">
      <v-row dense>
        <v-col
          v-for="widget in visibleWidgets"
          :key="widget.id"
          :cols="compactMode ? 12 : (widget.size.width / 12 * 12)"
        >
          <WidgetContainer :widget="widget">
            <component
              :is="getWidgetComponent(widget.type)"
              :widget="widget"
            />
          </WidgetContainer>
        </v-col>
      </v-row>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useHub } from '@/composables/useHub';
import WidgetContainer from './WidgetContainer.vue';
import NotificationCenter from './NotificationCenter.vue';

const {
  widgets,
  visibleWidgets,
  darkMode,
  compactMode,
  showNotifications,
  unreadNotifications,
  toggleDarkMode,
  toggleCompactMode,
  toggleNotifications,
  resetLayout
} = useHub();

// Dynamic widget components
const widgetComponents: Record<string, any> = {
  appointments: defineAsyncComponent(() => import('./widgets/AppointmentsWidget.vue')),
  patients: defineAsyncComponent(() => import('./widgets/PatientsWidget.vue')),
  consultas: defineAsyncComponent(() => import('./widgets/ConsultasWidget.vue')),
  notifications: defineAsyncComponent(() => import('./widgets/NotificationsWidget.vue')),
  stats: defineAsyncComponent(() => import('./widgets/StatsWidget.vue'))
};

const getWidgetComponent = (type: string) => {
  return widgetComponents[type] || null;
};
</script>

<style scoped lang="scss">
.hub-layout {
  min-height: 100vh;
  background-color: #f5f5f5;
  transition: all 0.3s ease;

  &.dark-mode {
    background-color: #1a1a2e;
    color: #ffffff;

    .hub-topbar {
      background-color: #16213e;
      border-bottom-color: #0f3460;
    }
  }

  &.compact-mode {
    .hub-topbar {
      padding: 8px 16px;
    }

    .search-field {
      max-width: 200px;
    }
  }
}

.hub-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background-color: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-field {
  max-width: 300px;
}

.notifications-panel {
  background-color: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  padding: 16px 24px;
}

.hub-content {
  padding: 24px;
}
</style>
