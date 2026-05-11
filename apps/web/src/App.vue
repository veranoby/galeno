<template>
  <v-app>
    <!-- App Bar -->
    <app-app-bar title="Galeno" @nav-click="drawerOpen = true">
      <template #actions>
        <v-btn icon="mdi-bell" variant="text" />
        <v-btn icon="mdi-account-circle" variant="text" to="/perfil" />
      </template>
    </app-app-bar>

    <!-- Navigation Drawer -->
    <app-nav-drawer v-model="drawerOpen" :items="navItems" @navigate="handleNavigate" />

    <!-- Main Content -->
    <v-main>
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </v-main>

    <!-- PWA Update Notification -->
    <v-snackbar
      v-model="showUpdateAvailable"
      color="info"
      :timeout="-1"
      location="bottom"
    >
      Nueva versión disponible
      <template #actions>
        <v-btn @click="updateServiceWorker">
          Actualizar
        </v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useRegisterSW } from 'virtual:pwa-register/vue';
import AppAppBar from '@galeno/ui-components/AppAppBar.vue';
import AppNavDrawer from '@galeno/ui-components/AppNavDrawer.vue';

interface NavItem {
  value: string;
  title: string;
  icon: string;
}

const router = useRouter();
const drawerOpen = ref(false);

const navItems: NavItem[] = [
  { value: '/', title: 'Inicio', icon: 'mdi-home' },
  { value: '/consultas', title: 'Consultas', icon: 'mdi-stethoscope' },
  { value: '/agenda', title: 'Agenda', icon: 'mdi-calendar' },
  { value: '/pacientes', title: 'Pacientes', icon: 'mdi-account-multiple' },
  { value: '/facturacion', title: 'Facturación', icon: 'mdi-receipt' },
  { value: '/health-wallet', title: 'Health Wallet', icon: 'mdi-wallet' },
  { value: '/documentos', title: 'Documentos', icon: 'mdi-file-document' },
  { value: '/ia-copilot', title: 'IA Copilot', icon: 'mdi-robot' },
  { value: '/configuracion', title: 'Configuración', icon: 'mdi-cog' }
];

function handleNavigate(value: string) {
  router.push(value);
}

// PWA Service Worker Update
const {
  updateServiceWorker,
  needRefresh: showUpdateAvailable
} = useRegisterSW({
  onRegisteredSW(swUrl: string, r: any) {
    if (r) {
      // Check for updates every hour
      setInterval(async () => {
        if (!(!r.installing && navigator)) return;
        if ('connection' in navigator && !navigator.onLine) return;
        const newReg = await r.update();
        newReg && newReg.addEventListener('updatefound', () => newReg.update());
      }, 60 * 60 * 1000);
    }
  }
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
