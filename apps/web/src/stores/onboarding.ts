import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  OnboardingState,
  EmailVerificationRequest,
  EmailVerificationResponse,
  ProfileSetupData
} from '@galeno/shared-types';
import { OnboardingStep } from '@galeno/shared-types';
import apiClient from '@galeno/api-client';

/**
 * Store de Pinia para manejar el estado del flujo de onboarding
 *
 * Este store gestiona:
 * - El paso actual del onboarding
 * - El estado de verificación de email
 * - La configuración del perfil
 * - El progreso del tutorial
 */
export const useOnboardingStore = defineStore('onboarding', () => {
  // ============= STATE =============

  /**
   * Estado actual del onboarding
   */
  const state = ref<OnboardingState>({
    currentStep: OnboardingStep.WELCOME,
    emailVerified: false,
    profileCompleted: false,
    tutorialCompleted: false,
    startedAt: new Date()
  });

  /**
   * Email del usuario
   */
  const email = ref<string>('');

  /**
   * Token de verificación de email
   */
  const verificationToken = ref<string>('');

  /**
   * Código de verificación (para desarrollo/testing)
   */
  const verificationCode = ref<string>('');

  /**
   * Datos del perfil configurado
   */
  const profileData = ref<ProfileSetupData | null>(null);

  /**
   * Flag de carga
   */
  const isLoading = ref<boolean>(false);

  /**
   * Mensaje de error
   */
  const error = ref<string | null>(null);

  // ============= GETTERS =============

  /**
   * Paso actual del onboarding
   */
  const currentStep = computed(() => state.value.currentStep);

  /**
   * Indica si el email ha sido verificado
   */
  const isEmailVerified = computed(() => state.value.emailVerified);

  /**
   * Indica si el perfil ha sido completado
   */
  const isProfileCompleted = computed(() => state.value.profileCompleted);

  /**
   * Indica si el tutorial ha sido completado
   */
  const isTutorialCompleted = computed(() => state.value.tutorialCompleted);

  /**
   * Indica si el onboarding ha sido completado
   */
  const isOnboardingCompleted = computed(
    () =>
      state.value.emailVerified &&
      state.value.profileCompleted &&
      state.value.tutorialCompleted
  );

  /**
   * Progreso del onboarding (0-100)
   */
  const progress = computed(() => {
    let completed = 0;
    if (state.value.emailVerified) completed += 33;
    if (state.value.profileCompleted) completed += 33;
    if (state.value.tutorialCompleted) completed += 34;
    return completed;
  });

  /**
   * Tiempo estimado restante en minutos
   */
  const estimatedTimeRemaining = computed(() => {
    const stepsRemaining = [
      !state.value.emailVerified,
      !state.value.profileCompleted,
      !state.value.tutorialCompleted
    ].filter(Boolean).length;

    const timePerStep = 2; // minutos estimados por paso
    return stepsRemaining * timePerStep;
  });

  // ============= ACTIONS =============

  /**
   * Inicia el proceso de onboarding
   */
  function startOnboarding() {
    state.value = {
      currentStep: OnboardingStep.WELCOME,
      emailVerified: false,
      profileCompleted: false,
      tutorialCompleted: false,
      startedAt: new Date()
    };
    email.value = '';
    verificationToken.value = '';
    verificationCode.value = '';
    profileData.value = null;
    error.value = null;
  }

  /**
   * Avanza al siguiente paso del onboarding
   */
  function nextStep() {
    const steps: OnboardingStep[] = [
      OnboardingStep.WELCOME,
      OnboardingStep.EMAIL_VERIFICATION,
      OnboardingStep.PROFILE_SETUP,
      OnboardingStep.TUTORIAL,
      OnboardingStep.COMPLETED
    ];

    const currentIndex = steps.indexOf(state.value.currentStep);
    if (currentIndex < steps.length - 1) {
      state.value.currentStep = steps[currentIndex + 1];
    }
  }

  /**
   * Retrocede al paso anterior del onboarding
   */
  function previousStep() {
    const steps: OnboardingStep[] = [
      OnboardingStep.WELCOME,
      OnboardingStep.EMAIL_VERIFICATION,
      OnboardingStep.PROFILE_SETUP,
      OnboardingStep.TUTORIAL,
      OnboardingStep.COMPLETED
    ];

    const currentIndex = steps.indexOf(state.value.currentStep);
    if (currentIndex > 0) {
      state.value.currentStep = steps[currentIndex - 1];
    }
  }

  /**
   * Establece el paso actual del onboarding
   */
  function setCurrentStep(step: OnboardingStep) {
    state.value.currentStep = step;
  }

  /**
   * Solicita el envío del código de verificación al email
   */
  async function sendVerificationCode(emailAddress: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiClient.post<EmailVerificationResponse>(
        '/onboarding/send-verification',
        { email: emailAddress }
      );

      if (response.success && response.data) {
        email.value = emailAddress;
        verificationToken.value = response.data.token;
        state.value.currentStep = OnboardingStep.EMAIL_VERIFICATION;
        return true;
      } else {
        error.value = response.error || 'Error al enviar código de verificación';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error desconocido';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Verifica el código de verificación del email
   */
  async function verifyEmail(code: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiClient.post<{ success: boolean; message: string }>(
        '/onboarding/verify-email',
        {
          email: email.value,
          code,
          token: verificationToken.value
        }
      );

      if (response.success) {
        state.value.emailVerified = true;
        state.value.currentStep = OnboardingStep.PROFILE_SETUP;
        return true;
      } else {
        error.value = response.error || 'Error al verificar email';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error desconocido';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Completa la configuración del perfil
   */
  async function completeProfileSetup(data: ProfileSetupData): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiClient.post<{ success: boolean; message: string; user: unknown }>(
        '/onboarding/setup-profile',
        data
      );

      if (response.success) {
        profileData.value = data;
        state.value.profileCompleted = true;
        state.value.currentStep = OnboardingStep.TUTORIAL;
        return true;
      } else {
        error.value = response.error || 'Error al configurar perfil';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error desconocido';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Marca el tutorial como completado
   */
  function completeTutorial() {
    state.value.tutorialCompleted = true;
    state.value.currentStep = OnboardingStep.COMPLETED;
    state.value.completedAt = new Date();
  }

  /**
   * Marca todo el onboarding como completado
   */
  async function markOnboardingCompleted(): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiClient.post<{ success: boolean; message: string }>(
        '/onboarding/complete',
        {}
      );

      if (response.success) {
        state.value.currentStep = OnboardingStep.COMPLETED;
        state.value.completedAt = new Date();
        return true;
      } else {
        error.value = response.error || 'Error al completar onboarding';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error desconocido';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Obtiene el estado actual del onboarding desde el servidor
   */
  async function fetchOnboardingStatus(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiClient.get<{
        currentStep: OnboardingStep;
        completed: boolean;
        emailVerified: boolean;
        profileCompleted: boolean;
      }>('onboarding/status');

      if (response.success && response.data) {
        state.value.currentStep = response.data.currentStep;
        state.value.emailVerified = response.data.emailVerified;
        state.value.profileCompleted = response.data.profileCompleted;
      } else {
        error.value = response.error || 'Error al obtener estado';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error desconocido';
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Limpia el estado del onboarding
   */
  function $reset() {
    state.value = {
      currentStep: OnboardingStep.WELCOME,
      emailVerified: false,
      profileCompleted: false,
      tutorialCompleted: false
    };
    email.value = '';
    verificationToken.value = '';
    verificationCode.value = '';
    profileData.value = null;
    error.value = null;
    isLoading.value = false;
  }

  return {
    // State
    state,
    email,
    verificationToken,
    verificationCode,
    profileData,
    isLoading,
    error,

    // Getters
    currentStep,
    isEmailVerified,
    isProfileCompleted,
    isTutorialCompleted,
    isOnboardingCompleted,
    progress,
    estimatedTimeRemaining,

    // Actions
    startOnboarding,
    nextStep,
    previousStep,
    setCurrentStep,
    sendVerificationCode,
    verifyEmail,
    completeProfileSetup,
    completeTutorial,
    markOnboardingCompleted,
    fetchOnboardingStatus,
    $reset
  };
});
