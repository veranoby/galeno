<template>
  <div class="email-verification-view">
    <!-- Step Description -->
    <div class="text-center mb-6">
      <v-icon
        icon="mdi-email-check"
        size="48"
        color="primary"
        class="mb-3"
      />
      <h3 class="text-h5 font-weight-bold mb-2">
        Verifica tu email
      </h3>
      <p class="text-body-2 text-medium-emphasis">
        Te enviaremos un código de verificación a tu correo electrónico
      </p>
    </div>

    <!-- Email Input Form -->
    <v-form
      v-if="!codeSent"
      ref="emailForm"
      @submit.prevent="sendCode"
    >
      <v-text-field
        v-model="email"
        label="Correo electrónico"
        placeholder="tu@email.com"
        type="email"
        variant="outlined"
        :rules="emailRules"
        :disabled="isLoading"
        prepend-inner-icon="mdi-email"
        class="mb-4"
      />

      <v-btn
        type="submit"
        color="primary"
        size="large"
        block
        rounded="lg"
        :loading="isLoading"
        class="text-none font-weight-bold"
      >
        Enviar código de verificación
      </v-btn>
    </v-form>

    <!-- Code Verification Form -->
    <v-form
      v-else
      ref="codeForm"
      @submit.prevent="verifyCode"
    >
      <v-alert
        type="success"
        variant="tonal"
        class="mb-4"
        density="compact"
      >
        Código enviado a <strong>{{ email }}</strong>
      </v-alert>

      <p class="text-body-2 text-medium-emphasis mb-4">
        Ingresa el código de 6 dígitos que enviamos a tu correo:
      </p>

      <v-otp-input
        v-model="verificationCode"
        length="6"
        type="number"
        variant="outlined"
        :disabled="isLoading"
        class="mb-4"
        @finish="verifyCode"
      />

      <!-- Resend Option -->
      <div class="text-center mb-4">
        <v-btn
          v-if="!countdown"
          variant="text"
          color="primary"
          :disabled="isLoading"
          @click="resendCode"
        >
          Reenviar código
        </v-btn>
        <span
          v-else
          class="text-caption text-medium-emphasis"
        >
          Reenviar en {{ countdown }} segundos
        </span>
      </div>

      <!-- Verify Button -->
      <v-btn
        type="submit"
        color="primary"
        size="large"
        block
        rounded="lg"
        :loading="isLoading"
        :disabled="verificationCode.length !== 6"
        class="text-none font-weight-bold"
      >
        Verificar email
      </v-btn>

      <!-- Change Email -->
      <v-btn
        variant="text"
        color="grey"
        block
        class="mt-2"
        @click="changeEmail"
      >
        Cambiar correo electrónico
      </v-btn>
    </v-form>

    <!-- Error Alert -->
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      class="mt-4"
      density="compact"
      closable
      @click:close="clearError"
    >
      {{ error }}
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useOnboardingStore } from '@/stores/onboarding';
import { storeToRefs } from 'pinia';

const onboardingStore = useOnboardingStore();
const { isLoading, error } = storeToRefs(onboardingStore);

const email = ref('');
const codeSent = ref(false);
const verificationCode = ref('');
const countdown = ref(0);
let countdownInterval: ReturnType<typeof setInterval> | null = null;

const emailRules = [
  (v: string) => !!v || 'Email es requerido',
  (v: string) => /.+@.+\..+/.test(v) || 'Email debe ser válido'
];

async function sendCode() {
  const success = await onboardingStore.sendVerificationCode(email.value);
  if (success) {
    codeSent.value = true;
    startCountdown();
  }
}

async function verifyCode() {
  if (verificationCode.value.length === 6) {
    await onboardingStore.verifyEmail(verificationCode.value);
    if (!error.value) {
      // Navigate happens automatically via store
    }
  }
}

function resendCode() {
  codeSent.value = false;
  verificationCode.value = '';
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function changeEmail() {
  codeSent.value = false;
  verificationCode.value = '';
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function startCountdown() {
  countdown.value = 60;
  countdownInterval = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0 && countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }, 1000);
}

function clearError() {
  error.value = null;
}

// Cleanup on unmount
watch(codeSent, (newVal) => {
  if (!newVal && countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
});
</script>

<style scoped>
.email-verification-view {
  padding: 20px 0;
}
</style>
