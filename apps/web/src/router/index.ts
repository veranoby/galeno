import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: 'Inicio - Galeno' }
  },
  {
    path: '/consultas',
    name: 'consultas',
    component: () => import('@/views/ConsultasView.vue'),
    meta: { title: 'Consultas - Galeno' }
  },
  {
    path: '/agenda',
    name: 'agenda',
    component: () => import('@/views/AgendaView.vue'),
    meta: { title: 'Agenda - Galeno' }
  },
  {
    path: '/pacientes',
    name: 'pacientes',
    component: () => import('@/views/PacientesView.vue'),
    meta: { title: 'Pacientes - Galeno' }
  },
  {
    path: '/pacientes/:id',
    name: 'paciente-detalle',
    component: () => import('@/views/PacienteDetalleView.vue'),
    meta: { title: 'Detalle Paciente - Galeno' }
  },
  {
    path: '/facturacion',
    name: 'facturacion',
    component: () => import('@/views/FacturacionView.vue'),
    meta: { title: 'Facturación - Galeno' }
  },
  {
    path: '/health-wallet',
    name: 'health-wallet',
    component: () => import('@/views/HealthWalletView.vue'),
    meta: { title: 'Health Wallet - Galeno' }
  },
  {
    path: '/documentos',
    name: 'documentos',
    component: () => import('@/views/DocumentosView.vue'),
    meta: { title: 'Documentos - Galeno' }
  },
  {
    path: '/ia-copilot',
    name: 'ia-copilot',
    component: () => import('@/views/IaCopilotView.vue'),
    meta: { title: 'IA Copilot - Galeno' }
  },
  {
    path: '/configuracion',
    name: 'configuracion',
    component: () => import('@/views/ConfiguracionView.vue'),
    meta: { title: 'Configuración - Galeno' }
  },
  {
    path: '/perfil',
    name: 'perfil',
    component: () => import('@/views/PerfilView.vue'),
    meta: { title: 'Mi Perfil - Galeno' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: 'Página no encontrada - Galeno' }
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  }
});

// Navigation guard for page titles
router.beforeEach((to) => {
  document.title = to.meta.title as string || 'Galeno - Ecuador-Health 360';
});

export default router;
