// apps/web/src/stores/hub.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface HubWidget {
  id: string;
  type: 'appointments' | 'patients' | 'consultas' | 'notifications' | 'stats';
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  visible: boolean;
  settings?: Record<string, any>;
}

export interface HubState {
  widgets: HubWidget[];
  darkMode: boolean;
  compactMode: boolean;
  showNotifications: boolean;
  unreadNotifications: number;
}

export const useHubStore = defineStore('hub', () => {
  // Estado
  const widgets = ref<HubWidget[]>([
    {
      id: 'appointments',
      type: 'appointments',
      title: 'Próximas Citas',
      position: { x: 0, y: 0 },
      size: { width: 6, height: 4 },
      visible: true
    },
    {
      id: 'patients',
      type: 'patients',
      title: 'Pacientes Recientes',
      position: { x: 6, y: 0 },
      size: { width: 6, height: 4 },
      visible: true
    },
    {
      id: 'consultas',
      type: 'consultas',
      title: 'Consultas Recientes',
      position: { x: 0, y: 4 },
      size: { width: 6, height: 4 },
      visible: true
    },
    {
      id: 'notifications',
      type: 'notifications',
      title: 'Notificaciones',
      position: { x: 6, y: 4 },
      size: { width: 6, height: 3 },
      visible: true
    },
    {
      id: 'stats',
      type: 'stats',
      title: 'Estadísticas',
      position: { x: 0, y: 8 },
      size: { width: 12, height: 3 },
      visible: true
    }
  ]);

  const darkMode = ref(false);
  const compactMode = ref(false);
  const showNotifications = ref(false);
  const unreadNotifications = ref(0);

  // Getters
  const visibleWidgets = computed(() => 
    widgets.value.filter(w => w.visible)
  );

  const theme = computed(() => 
    darkMode.value ? 'dark' : 'light'
  );

  // Actions
  function toggleDarkMode() {
    darkMode.value = !darkMode.value;
    document.documentElement.classList.toggle('dark', darkMode.value);
  }

  function toggleCompactMode() {
    compactMode.value = !compactMode.value;
  }

  function toggleNotifications() {
    showNotifications.value = !showNotifications.value;
  }

  function setUnreadNotifications(count: number) {
    unreadNotifications.value = count;
  }

  function updateWidgetPosition(id: string, position: { x: number; y: number }) {
    const widget = widgets.value.find(w => w.id === id);
    if (widget) {
      widget.position = position;
    }
  }

  function updateWidgetSize(id: string, size: { width: number; height: number }) {
    const widget = widgets.value.find(w => w.id === id);
    if (widget) {
      widget.size = size;
    }
  }

  function toggleWidgetVisibility(id: string) {
    const widget = widgets.value.find(w => w.id === id);
    if (widget) {
      widget.visible = !widget.visible;
    }
  }

  function addWidget(widget: Omit<HubWidget, 'position' | 'size'>) {
    widgets.value.push({
      ...widget,
      position: { x: 0, y: 0 },
      size: { width: 6, height: 4 }
    });
  }

  function removeWidget(id: string) {
    widgets.value = widgets.value.filter(w => w.id !== id);
  }

  function resetLayout() {
    widgets.value = widgets.value.map((w, i) => ({
      ...w,
      position: { x: (i % 2) * 6, y: Math.floor(i / 2) * 4 },
      size: { width: 6, height: 4 },
      visible: true
    }));
  }

  function setLayout(layout: Array<{ id: string; position: { x: number; y: number }; size: { width: number; height: number }; visible: boolean }>) {
    layout.forEach(item => {
      const widget = widgets.value.find(w => w.id === item.id);
      if (widget) {
        widget.position = item.position;
        widget.size = item.size;
        widget.visible = item.visible;
      }
    });
  }

  // Keyboard shortcuts
  const shortcuts = {
    toggleDarkMode: 'Alt+D',
    toggleNotifications: 'Alt+N',
    toggleCompactMode: 'Alt+C',
    focusSearch: 'Ctrl+K',
    showHelp: 'Ctrl+/'
  };

  return {
    // State
    widgets,
    darkMode,
    compactMode,
    showNotifications,
    unreadNotifications,
    shortcuts,

    // Getters
    visibleWidgets,
    theme,

    // Actions
    toggleDarkMode,
    toggleCompactMode,
    toggleNotifications,
    setUnreadNotifications,
    updateWidgetPosition,
    updateWidgetSize,
    toggleWidgetVisibility,
    addWidget,
    removeWidget,
    resetLayout,
    setLayout
  };
});
