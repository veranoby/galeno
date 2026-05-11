<template>
  <div class="workspace-layout" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <!-- Toolbar Superior -->
    <header class="workspace-toolbar">
      <slot name="toolbar">
        <div class="toolbar-content">
          <!-- Breadcrumb / Título -->
          <div class="toolbar-left">
            <v-btn
              icon="mdi-menu"
              variant="text"
              class="sidebar-toggle"
              @click="toggleSidebar"
              density="comfortable"
            />
            <slot name="toolbar-title">
              <h2 class="text-h6">{{ title }}</h2>
            </slot>
          </div>

          <!-- Acciones centrales -->
          <div class="toolbar-center">
            <slot name="toolbar-center" />
          </div>

          <!-- Acciones derecha -->
          <div class="toolbar-right">
            <slot name="toolbar-actions">
              <v-btn-group density="comfortable" variant="outlined">
                <v-tooltip location="bottom">
                  <template v-slot:activator="{ props }">
                    <v-btn
                      icon="mdi-content-save"
                      v-bind="props"
                      @click="$emit('save')"
                      :loading="saving"
                    />
                  </template>
                  <span>Guardar (Ctrl+S)</span>
                </v-tooltip>

                <v-tooltip location="bottom">
                  <template v-slot:activator="{ props }">
                    <v-btn
                      icon="mdi-printer"
                      v-bind="props"
                      @click="$emit('print')"
                    />
                  </template>
                  <span>Imprimir (Ctrl+P)</span>
                </v-tooltip>

                <v-tooltip location="bottom">
                  <template v-slot:activator="{ props }">
                    <v-btn
                      icon="mdi-dots-vertical"
                      v-bind="props"
                      @click="$emit('more')"
                    />
                  </template>
                  <span>Más opciones</span>
                </v-tooltip>
              </v-btn-group>
            </slot>
          </div>
        </div>
      </slot>
    </header>

    <!-- Contenido Principal -->
    <div class="workspace-content">
      <!-- Panel Lateral Izquierdo (Contexto del Paciente) -->
      <aside
        class="workspace-sidebar"
        :class="{ 'collapsed': sidebarCollapsed }"
        v-if="!hideSidebar"
      >
        <slot name="sidebar">
          <!-- Header del Sidebar con botón colapsar -->
          <div class="sidebar-header">
            <span v-if="!sidebarCollapsed" class="text-subtitle-2 font-weight-medium">
              Contexto
            </span>
            <v-btn
              icon="mdi-chevron-left"
              size="x-small"
              variant="text"
              @click="toggleSidebar"
              class="collapse-btn"
            />
          </div>

          <!-- Contenido del Sidebar -->
          <div class="sidebar-content" v-if="!sidebarCollapsed">
            <slot name="sidebar-content" />
          </div>
        </slot>

        <!-- Botón expandir cuando está colapsado -->
        <v-btn
          v-if="sidebarCollapsed"
          icon="mdi-chevron-right"
          size="small"
          variant="elevated"
          class="expand-btn"
          @click="toggleSidebar"
        />
      </aside>

      <!-- Área Principal -->
      <main class="workspace-main">
        <slot name="main-header">
          <div v-if="mainHeader" class="main-header">
            {{ mainHeader }}
          </div>
        </slot>

        <div class="main-content">
          <slot />
        </div>

        <slot name="main-footer">
          <div v-if="mainFooter" class="main-footer">
            {{ mainFooter }}
          </div>
        </slot>
      </main>

      <!-- Panel Lateral Derecho (Herramientas) -->
      <aside
        class="workspace-tools"
        v-if="showTools"
      >
        <slot name="tools">
          <div class="tools-header">
            <span class="text-caption font-weight-medium">Herramientas</span>
          </div>
          <div class="tools-content">
            <slot name="tools-content" />
          </div>
        </slot>
      </aside>
    </div>

    <!-- Snackbar para notificaciones -->
    <v-snackbar
      v-model="snackbar.visible"
      :color="snackbar.color"
      :timeout="snackbar.timeout"
      location="bottom"
    >
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn variant="text" @click="snackbar.visible = false">
          Cerrar
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

// Props
interface Props {
  title?: string;
  mainHeader?: string;
  mainFooter?: string;
  hideSidebar?: boolean;
  showTools?: boolean;
  saving?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Workspace',
  hideSidebar: false,
  showTools: false,
  saving: false
});

// Emits
const emit = defineEmits<{
  save: [];
  print: [];
  more: [];
  'sidebar-toggle': [collapsed: boolean];
}>();

// Estado
const sidebarCollapsed = ref(false);
const sidebarWidth = ref(320); // Ancho por defecto del sidebar

// Snackbar para notificaciones
const snackbar = ref({
  visible: false,
  text: '',
  color: 'info',
  timeout: 3000
});

// Constantes
const STORAGE_KEY = 'workspace-sidebar-collapsed';

// Métodos
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  emit('sidebar-toggle', sidebarCollapsed.value);
  // Persistir estado en localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(sidebarCollapsed.value));
  }
};

const showNotification = (text: string, color: string = 'info') => {
  snackbar.value = { visible: true, text, color, timeout: 3000 };
};

// Cargar estado del sidebar desde localStorage
onMounted(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      sidebarCollapsed.value = saved === 'true';
    }
  }

  // Registrar atajos de teclado
  window.addEventListener('keydown', handleKeyboard);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyboard);
});

// Atajos de teclado
const handleKeyboard = (e: KeyboardEvent) => {
  // Ctrl+S - Guardar
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    emit('save');
  }
  // Ctrl+P - Imprimir
  else if (e.ctrlKey && e.key === 'p') {
    e.preventDefault();
    emit('print');
  }
  // Ctrl+B - Toggle sidebar
  else if (e.ctrlKey && e.key === 'b') {
    e.preventDefault();
    toggleSidebar();
  }
};

// Exponer método para mostrar notificaciones
defineExpose({
  showNotification
});
</script>

<style scoped>
.workspace-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: #f5f5f5;
}

/* Toolbar */
.workspace-toolbar {
  background-color: white;
  border-bottom: 1px solid #e0e0e0;
  padding: 0.5rem 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  z-index: 10;
}

.toolbar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.toolbar-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sidebar-toggle {
  margin-right: 0.5rem;
}

/* Contenido Principal */
.workspace-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Sidebar */
.workspace-sidebar {
  width: 320px;
  min-width: 320px;
  background-color: white;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease, min-width 0.3s ease;
  position: relative;
  overflow: hidden;
}

.workspace-sidebar.collapsed {
  width: 0;
  min-width: 0;
  border-right: none;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.collapse-btn {
  flex-shrink: 0;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.expand-btn {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 5;
}

/* Área Principal */
.workspace-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #fafafa;
}

.main-header {
  padding: 1rem;
  background-color: white;
  border-bottom: 1px solid #e0e0e0;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.main-footer {
  padding: 0.75rem 1rem;
  background-color: white;
  border-top: 1px solid #e0e0e0;
  font-size: 0.875rem;
  color: #666;
}

/* Panel de Herramientas */
.workspace-tools {
  width: 280px;
  min-width: 280px;
  background-color: white;
  border-left: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
}

.tools-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e0e0e0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tools-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

/* Responsive Breakpoints */
@media (max-width: 960px) {
  .workspace-tools {
    display: none;
  }

  .main-content {
    padding: 1rem;
  }
}

@media (max-width: 600px) {
  .workspace-sidebar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 20;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
  }

  .workspace-sidebar.collapsed {
    left: -320px;
  }

  .toolbar-content {
    gap: 0.5rem;
  }

  .toolbar-center {
    display: none;
  }

  .toolbar-right .v-btn-group {
    flex-wrap: wrap;
  }

  .main-content {
    padding: 0.75rem;
  }
}

/* Sidebar colapsado globalmente */
.workspace-layout.sidebar-collapsed .workspace-sidebar {
  width: 0;
  min-width: 0;
}
</style>
