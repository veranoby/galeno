/**
 * Composable PWA - usePWA
 * 
 * Proporciona lógica reutilizable para funcionalidades PWA:
 * - Detección de instalación
 * - Prompt de instalación manual
 * - Estado de conexión online/offline
 * - Detección de modo offline
 * - Event listeners para cambios de estado
 * 
 * @example
 * ```ts
 * const { isPWAInstalled, isInstallable, promptInstall, isOnline, offlineMode } = usePWA()
 * ```
 */

import { ref, readonly, onMounted, onUnmounted } from 'vue';

/**
 * Interface para el evento beforeinstallprompt
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Interface para el resultado de instalación
 */
interface InstallationResult {
  outcome: 'accepted' | 'dismissed';
}

/**
 * Composable para funcionalidades PWA
 */
export function usePWA() {
  // Estado reactivo
  const isPWAInstalled = ref<boolean>(false);
  const isInstallable = ref<boolean>(false);
  const isOnline = ref<boolean>(navigator.onLine);
  const offlineMode = ref<boolean>(false);
  const appVersion = ref<string>('1.0.0');

  // Referencia al deferred prompt
  let deferredPrompt: BeforeInstallPromptEvent | null = null;

  // Storage key para tracking de dismiss
  const INSTALL_DISMISSED_KEY = 'pwa-install-dismissed';
  const INSTALL_DISMISSED_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 días

  /**
   * Verifica si la app está instalada como PWA
   * 
   * Detecta instalación mediante:
   * - window.matchMedia('(display-mode: standalone)')
   * - window.navigator.standalone (iOS)
   */
  function checkInstallationStatus(): void {
    // Método 1: display-mode standalone (Android/Desktop)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    // Método 2: iOS standalone
    const isIOSStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    
    // Método 3: URL bar oculta (iOS Safari)
    const isIOSFullscreen = document.referrer.includes('com.apple.WebKit');
    
    isPWAInstalled.value = isStandalone || isIOSStandalone || isIOSFullscreen;
  }

  /**
   * Verifica si el prompt de instalación ha sido dismissado recientemente
   */
  function isInstallDismissed(): boolean {
    try {
      const dismissedData = localStorage.getItem(INSTALL_DISMISSED_KEY);
      
      if (!dismissedData) {
        return false;
      }

      const { timestamp } = JSON.parse(dismissedData) as { timestamp: number };
      const isExpired = Date.now() - timestamp > INSTALL_DISMISSED_EXPIRY;
      
      if (isExpired) {
        localStorage.removeItem(INSTALL_DISMISSED_KEY);
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Marca el prompt como dismissado
   */
  function markInstallDismissed(): void {
    try {
      localStorage.setItem(
        INSTALL_DISMISSED_KEY,
        JSON.stringify({ timestamp: Date.now() })
      );
    } catch {
      // Ignorar errores de localStorage
    }
  }

  /**
   * Limpia el flag de dismiss
   */
  function clearInstallDismissed(): void {
    try {
      localStorage.removeItem(INSTALL_DISMISSED_KEY);
    } catch {
      // Ignorar errores de localStorage
    }
  }

  /**
   * Muestra el prompt nativo de instalación
   * 
   * @returns Promise con el resultado de la instalación
   */
  async function promptInstall(): Promise<InstallationResult | null> {
    if (!deferredPrompt) {
      console.warn('[usePWA] Prompt de instalación no disponible');
      return null;
    }

    try {
      // Mostrar prompt nativo
      await deferredPrompt.prompt();
      
      // Esperar resultado
      const { outcome } = await deferredPrompt.userChoice;
      
      // Limpiar referencia
      if (outcome === 'dismissed') {
        markInstallDismissed();
      } else {
        clearInstallDismissed();
      }
      
      deferredPrompt = null;
      isInstallable.value = false;
      
      return { outcome };
    } catch (error) {
      console.error('[usePWA] Error mostrando prompt de instalación:', error);
      return null;
    }
  }

  /**
   * Maneja el evento beforeinstallprompt
   */
  function handleBeforeInstallPrompt(event: Event): void {
    // Prevenir comportamiento por defecto
    event.preventDefault();
    
    // Guardar referencia al prompt
    deferredPrompt = event as BeforeInstallPromptEvent;
    
    // Solo mostrar si no ha sido dismissado
    if (!isInstallDismissed()) {
      isInstallable.value = true;
    }
  }

  /**
   * Maneja cambios de conexión online
   */
  function handleOnline(): void {
    isOnline.value = true;
    offlineMode.value = false;
  }

  /**
   * Maneja cambios de conexión offline
   */
  function handleOffline(): void {
    isOnline.value = false;
    
    // Detectar modo offline (primera carga sin conexión)
    if (document.visibilityState === 'visible') {
      offlineMode.value = true;
    }
  }

  /**
   * Maneja cambio de visibilidad para detectar modo offline
   */
  function handleVisibilityChange(): void {
    if (document.visibilityState === 'visible' && !isOnline.value) {
      offlineMode.value = true;
    } else {
      offlineMode.value = false;
    }
  }

  /**
   * Obtiene la versión de la app del manifest
   */
  async function fetchAppVersion(): Promise<void> {
    try {
      const response = await fetch('/manifest.webmanifest', {
        cache: 'no-cache'
      });
      
      if (response.ok) {
        const manifest = await response.json();
        // Usar start_url con query param de versión o campo custom
        appVersion.value = manifest.version || '1.0.0';
      }
    } catch {
      // Usar versión por defecto
      appVersion.value = '1.0.0';
    }
  }

  /**
   * Registra event listeners para cambios de estado PWA
   */
  function registerEventListeners(): void {
    // beforeinstallprompt
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Online/Offline
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Visibilidad para detectar modo offline
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  /**
   * Limpia event listeners
   */
  function unregisterEventListeners(): void {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }

  /**
   * Inicializa el composable
   */
  onMounted(() => {
    checkInstallationStatus();
    fetchAppVersion();
    registerEventListeners();
    
    // Verificar offline mode al inicio
    if (!navigator.onLine) {
      offlineMode.value = true;
    }
  });

  /**
   * Limpieza al desmontar
   */
  onUnmounted(() => {
    unregisterEventListeners();
  });

  /**
   * Reinicia el estado de installable (para mostrar prompt nuevamente)
   */
  function resetInstallable(): void {
    clearInstallDismissed();
    checkInstallationStatus();
  }

  return {
    // Estado readonly
    isPWAInstalled: readonly(isPWAInstalled),
    isInstallable: readonly(isInstallable),
    isOnline: readonly(isOnline),
    offlineMode: readonly(offlineMode),
    appVersion: readonly(appVersion),
    
    // Acciones
    promptInstall,
    resetInstallable,
    markInstallDismissed,
    clearInstallDismissed
  };
}

export default usePWA;
