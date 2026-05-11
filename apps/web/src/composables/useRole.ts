import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';

export function useRole() {
  const authStore = useAuthStore();

  const user = computed(() => authStore.user);
  const rol = computed(() => authStore.user?.rol);

  const isAdmin = computed(() => authStore.isAdmin);
  const isDoctor = computed(() => authStore.isDoctor);
  const isAssistant = computed(() => authStore.isAssistant);

  /**
   * Check if user has a specific role
   */
  const hasRole = (requiredRoles: string | string[]) => {
    if (!rol.value) return false;
    
    const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return rolesArray.includes(rol.value);
  };

  /**
   * Check if user has permission (UI level check)
   * Note: Real permission check should be done on backend
   */
  const hasPermission = (permission: string) => {
    if (isAdmin.value) return true;
    
    // Simple UI mapping based on roles
    const permissionMap: Record<string, string[]> = {
      'patient:create': ['DOCTOR'],
      'patient:delete': ['ADMIN'],
      'consultation:create': ['DOCTOR'],
      'billing:manage': ['DOCTOR', 'ADMIN'],
      'plan:manage': ['DOCTOR', 'ADMIN'],
      'users:manage': ['DOCTOR', 'ADMIN'],
    };

    const allowedRoles = permissionMap[permission];
    if (!allowedRoles) return true; // Default to allowed if not in map
    
    return hasRole(allowedRoles);
  };

  return {
    user,
    rol,
    isAdmin,
    isDoctor,
    isAssistant,
    hasRole,
    hasPermission
  };
}
