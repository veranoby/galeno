import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: 'Inicio - Galeno', requiresAuth: true }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { title: 'Iniciar Sesión - Galeno', guestOnly: true }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/auth/RegisterView.vue'),
    meta: { title: 'Registrarse - Galeno', guestOnly: true }
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('@/views/onboarding/OnboardingView.vue'),
    meta: { title: 'Bienvenido - Galeno', requiresAuth: true }
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/views/auth/ForgotPasswordView.vue'),
    meta: { title: 'Recuperar Contraseña - Galeno', guestOnly: true }
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/views/auth/ResetPasswordView.vue'),
    meta: { title: 'Restablecer Contraseña - Galeno' }
  },
  {
    path: '/consultas',
    name: 'consultas',
    component: () => import('@/views/ConsultasView.vue'),
    meta: { title: 'Consultas - Galeno' }
  },
  {
    path: '/consultas/:id',
    name: 'consulta-workspace',
    component: () => import('@/views/consultation/Workspace.vue'),
    meta: { title: 'Consulta - Galeno' }
  },
  {
    path: '/interconsulta-simplificada',
    name: 'interconsulta-simplificada',
    component: () => import('@/views/consultation/SimpleInterconsultation.vue'),
    meta: { title: 'Interconsulta Simplificada - Galeno', requiresAuth: true }
  },
  {
    path: '/historial',
    name: 'historial',
    component: () => import('@/views/consultation/History.vue'),
    meta: { title: 'Historial - Galeno' }
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
    path: '/pacientes/:pacienteId/antecedentes',
    name: 'paciente-antecedentes',
    component: () => import('@/views/patient/Antecedents.vue'),
    meta: { title: 'Antecedentes - Galeno', requiresAuth: true }
  },
  {
    path: '/facturacion',
    name: 'facturacion',
    component: () => import('@/views/billing/FacturasListView.vue'),
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
    path: '/audit',
    name: 'audit-dashboard',
    component: () => import('@/views/AuditDashboardView.vue'),
    meta: { title: 'Auditoría - Galeno', requiresAuth: true, roles: ['ADMIN'] }
  },
  {
    path: '/senescyt/validacion',
    name: 'senescyt-validation',
    component: () => import('@/components/senescyt/Validation.vue'),
    meta: {
      title: 'Validación SENESCYT - Galeno',
      requiresAuth: true,
      roles: ['DOCTOR', 'ADMIN']
    }
  },
  {
    path: '/mapa-doctores',
    name: 'doctor-map',
    component: () => import('@/views/gps/DoctorMapView.vue'),
    meta: {
      title: 'Mapa de Doctores - Galeno',
      requiresAuth: true
    }
  },
  {
    path: '/doctor/:id',
    name: 'doctor-public-profile',
    component: () => import('@/views/doctor/PublicProfile.vue'),
    meta: {
      title: 'Perfil del Doctor - Galeno',
      public: true
    }
  },
  {
    path: '/hub',
    name: 'hub',
    component: () => import('@/views/hub/Hub.vue'),
    meta: {
      title: 'Galeno Hub - Dashboard',
      requiresAuth: true
    }
  },
  {
    path: '/teleconsulta/:citaId/waiting-room',
    name: 'teleconsulta-waiting-room',
    component: () => import('@/views/teleconference/WaitingRoomView.vue'),
    meta: {
      title: 'Sala de Espera - Galeno',
      requiresAuth: true
    }
  },
  {
    path: '/teleconsulta/:citaId/consulta',
    name: 'teleconsulta-consulta',
    component: () => import('@/views/teleconference/Consultation.vue'),
    meta: {
      title: 'Teleconsulta - Galeno',
      requiresAuth: true,
      roles: ['DOCTOR']
    }
  },
  {
    path: '/teleconsulta/:citaId/video',
    name: 'teleconsulta-video',
    component: () => import('@/components/teleconsulta/JitsiMeet.vue'),
    meta: {
      title: 'Videollamada - Galeno',
      requiresAuth: true
    }
  },
  {
    path: '/payment/checkout',
    name: 'payment-checkout',
    component: () => import('@/views/payment/Checkout.vue'),
    meta: {
      title: 'Checkout - Galeno',
      requiresAuth: true
    }
  },
  {
    path: '/schedule',
    name: 'schedule-calendar',
    component: () => import('@/views/schedule/Calendar.vue'),
    meta: {
      title: 'Calendario - Galeno',
      requiresAuth: true,
      roles: ['DOCTOR', 'ADMIN']
    }
  },
  {
    path: '/pharmacy/validate',
    name: 'pharmacy-validate',
    component: () => import('@/views/pharmacy/Validate.vue'),
    meta: {
      title: 'Validación QR - Farmacia',
      requiresAuth: true,
      roles: ['FARMACIA']
    }
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

// Navigation guard for auth and page titles
router.beforeEach(async (to, from, next) => {
  // Set document title
  document.title = to.meta.title as string || 'Galeno - Ecuador-Health 360';

  const authStore = useAuthStore();

  // Check if route requires auth
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return next({ name: 'login', query: { redirect: to.fullPath } });
  }

  // Check if route is for guests only (like login/register)
  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return next({ name: 'home' });
  }

  // Check roles if specified
  if (to.meta.roles && Array.isArray(to.meta.roles)) {
    const userRole = authStore.user?.rol;
    if (!userRole || !to.meta.roles.includes(userRole)) {
      return next({ name: 'not-found' });
    }
  }

  next();
});

export default router;
