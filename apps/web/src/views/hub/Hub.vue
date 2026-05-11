<!-- apps/web/src/views/hub/Hub.vue -->
<template>
  <div class="hub-view" :class="{ 'dark-mode': darkMode, 'compact-mode': compactMode }">
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

    <!-- Main Content -->
    <main class="hub-content">
      <!-- Quick Actions -->
      <QuickActions @action="handleQuickAction" class="mb-6" />

      <!-- Draggable Widgets Grid -->
      <v-row dense>
        <draggable
          v-model="visibleWidgets"
          item-key="id"
          class="draggable-grid"
          tag="template"
          :animation="200"
          :ghost-class="ghostClass"
          :drag-class="dragClass"
          @start="isDragging = true"
          @end="isDragging = false"
        >
          <template #item="{ element }">
            <v-col
              :cols="compactMode ? 12 : (element.size?.width || 6)"
              :sm="compactMode ? 12 : (element.size?.width || 6)"
              :md="compactMode ? 6 : (element.size?.width || 6)"
            >
              <WidgetContainer
                :widget="element"
                :draggable="true"
                @update="handleWidgetUpdate"
                @refresh="refreshWidget(element.id)"
                @toggle-visibility="toggleWidgetVisibility(element.id)"
                @settings="openWidgetSettings(element.id)"
              >
                <!-- Dynamic Widget Component -->
                <component
                  :is="getWidgetComponent(element.type)"
                  :widget="element"
                />
              </WidgetContainer>
            </v-col>
          </template>
        </draggable>
      </v-row>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue';
import draggable from 'vuedraggable';
import { useHub } from '@/composables/useHub';
import WidgetContainer from '@/components/hub/WidgetContainer.vue';
import NotificationCenter from '@/components/hub/NotificationCenter.vue';
import QuickActions from '@/components/hub/QuickActions.vue';

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
  toggleWidgetVisibility,
  resetLayout,
  setupPersistence
} = useHub();

// Setup persistence for localStorage
setupPersistence();

const isDragging = ref(false);
const ghostClass = 'widget-ghost';
const dragClass = 'widget-drag';

// Dynamic widget components
const widgetComponents: Record<string, any> = {
  appointments: defineAsyncComponent(() => import('@/components/hub/widgets/AppointmentsWidget.vue')),
  patients: defineAsyncComponent(() => import('@/components/hub/widgets/PatientsWidget.vue')),
  consultas: defineAsyncComponent(() => import('@/components/hub/widgets/ConsultasWidget.vue')),
  stats: defineAsyncComponent(() => import('@/components/hub/widgets/StatsWidget.vue')),
  notifications: defineAsyncComponent(() => import('@/components/hub/NotificationCenter.vue'))
};

const getWidgetComponent = (type: string) => {
  return widgetComponents[type] || null;
};

const handleQuickAction = (type: string) => {
  console.log('Quick action:', type);
  // TODO: Implement quick actions
};

const refreshWidget = (widgetId: string) => {
  console.log('Refresh widget:', widgetId);
  // TODO: Implement widget refresh
};

const openWidgetSettings = (widgetId: string) => {
  console.log('Open settings:', widgetId);
  // TODO: Implement widget settings
};

const handleWidgetUpdate = (position: { x: number; y: number }) => {
  // The position update is already handled by vuedraggable v-model
  // This is just a callback for additional actions if needed
  console.log('Widget position updated:', position);
};
</script>

<style scoped lang="scss">
.hub-view {
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
  max-width: 1400px;
  margin: 0 auto;
}

.draggable-grid {
  width: 100%;
}

.widget-ghost {
  opacity: 0.5;
  background-color: #e0e0e0;
  border: 2px dashed #9e9e9e;
}

.widget-drag {
  opacity: 0.5;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
</style>
