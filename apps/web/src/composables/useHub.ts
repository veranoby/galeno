// apps/web/src/composables/useHub.ts
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { useHubStore } from '../stores/hub';

export function useHub() {
  const hubStore = useHubStore();

  // Save layout to localStorage
  const saveLayout = () => {
    const layout = hubStore.widgets.map(w => ({
      id: w.id,
      position: w.position,
      size: w.size,
      visible: w.visible
    }));
    localStorage.setItem('hub:layout', JSON.stringify(layout));
  };

  // Load layout from localStorage
  const loadLayout = () => {
    const saved = localStorage.getItem('hub:layout');
    if (saved) {
      try {
        const layout = JSON.parse(saved);
        hubStore.setLayout(layout);
      } catch (e) {
        console.error('Failed to load hub layout:', e);
      }
    }
  };

  // Keyboard shortcuts handler
  const handleKeyDown = (event: KeyboardEvent) => {
    const { ctrlKey, altKey, shiftKey, key } = event;

    // Alt+D: Toggle dark mode
    if (altKey && key.toLowerCase() === 'd') {
      event.preventDefault();
      hubStore.toggleDarkMode();
    }

    // Alt+N: Toggle notifications
    if (altKey && key.toLowerCase() === 'n') {
      event.preventDefault();
      hubStore.toggleNotifications();
    }

    // Alt+C: Toggle compact mode
    if (altKey && key.toLowerCase() === 'c') {
      event.preventDefault();
      hubStore.toggleCompactMode();
    }

    // Ctrl+K: Focus search
    if (ctrlKey && key.toLowerCase() === 'k') {
      event.preventDefault();
      const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
      searchInput?.focus();
    }

    // Ctrl+/: Show help
    if (ctrlKey && key === '/') {
      event.preventDefault();
      showShortcutHelp();
    }
  };

  const showShortcutHelp = () => {
    const help = `
Atajos de Teclado:
  Alt+D: Cambiar tema oscuro/claro
  Alt+N: Mostrar/ocultar notificaciones
  Alt+C: Modo compacto
  Ctrl+K: Buscar
  Ctrl+/: Ayuda de atajos
    `.trim();
    console.log(help);
    alert(help);
  };

  // Lifecycle
  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown);

    // Load saved preferences
    const savedDarkMode = localStorage.getItem('hub:darkMode');
    if (savedDarkMode) {
      hubStore.darkMode = savedDarkMode === 'true';
    }

    const savedCompactMode = localStorage.getItem('hub:compactMode');
    if (savedCompactMode) {
      hubStore.compactMode = savedCompactMode === 'true';
    }

    // Load saved layout
    loadLayout();
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  // Watch for changes and save to localStorage
  const setupPersistence = () => {
    // Watch dark mode and compact mode
    const stopPrefs = watch(
      () => [hubStore.darkMode, hubStore.compactMode],
      () => {
        localStorage.setItem('hub:darkMode', String(hubStore.darkMode));
        localStorage.setItem('hub:compactMode', String(hubStore.compactMode));
      }
    );

    // Watch widgets for layout changes with debounce
    let saveTimeout: ReturnType<typeof setTimeout> | null = null;
    const stopWidgets = watch(
      () => hubStore.widgets,
      () => {
        if (saveTimeout) {
          clearTimeout(saveTimeout);
        }
        saveTimeout = setTimeout(() => {
          saveLayout();
          saveTimeout = null;
        }, 300); // Debounce 300ms to avoid saving on every drag event
      },
      { deep: true }
    );

    return () => {
      stopPrefs();
      stopWidgets();
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  };

  return {
    // State
    widgets: computed(() => hubStore.widgets),
    visibleWidgets: computed(() => hubStore.visibleWidgets),
    darkMode: computed(() => hubStore.darkMode),
    compactMode: computed(() => hubStore.compactMode),
    showNotifications: computed(() => hubStore.showNotifications),
    unreadNotifications: computed(() => hubStore.unreadNotifications),
    shortcuts: computed(() => hubStore.shortcuts),
    theme: computed(() => hubStore.theme),

    // Actions
    toggleDarkMode: hubStore.toggleDarkMode,
    toggleCompactMode: hubStore.toggleCompactMode,
    toggleNotifications: hubStore.toggleNotifications,
    toggleWidgetVisibility: hubStore.toggleWidgetVisibility,
    resetLayout: hubStore.resetLayout,
    setupPersistence,
    saveLayout,
    loadLayout
  };
}

export default useHub;
