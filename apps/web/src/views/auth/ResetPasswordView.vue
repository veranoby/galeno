<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="elevation-12 pa-4">
          <v-card-text>
            <div class="text-center mb-6">
              <v-icon icon="mdi-lock-check" size="x-large" color="primary" class="mb-2" />
              <h1 class="text-h4 font-weight-bold">Nueva Contraseña</h1>
              <p class="text-subtitle-1">Ingresa tu nueva contraseña segura</p>
            </div>

            <v-alert
              v-if="message"
              :type="messageType"
              variant="tonal"
              class="mb-4"
              closable
            >
              {{ message }}
            </v-alert>

            <v-form @submit.prevent="handleSubmit" v-model="isValid">
              <v-text-field
                v-model="password"
                label="Nueva Contraseña"
                prepend-inner-icon="mdi-lock"
                :type="showPassword ? 'text' : 'password'"
                variant="outlined"
                required
                :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append-inner="showPassword = !showPassword"
                :rules="[
                  v => !!v || 'Contraseña es requerida',
                  v => v.length >= 8 || 'Mínimo 8 caracteres'
                ]"
              />

              <v-text-field
                v-model="confirmPassword"
                label="Confirmar Contraseña"
                prepend-inner-icon="mdi-lock-check"
                :type="showPassword ? 'text' : 'password'"
                variant="outlined"
                required
                :rules="[
                  v => !!v || 'Confirmación requerida',
                  v => v === password || 'Las contraseñas no coinciden'
                ]"
              />

              <v-btn
                type="submit"
                color="primary"
                block
                size="large"
                :loading="loading"
                :disabled="!isValid"
                class="mt-4"
              >
                Cambiar Contraseña
              </v-btn>
            </v-form>
          </v-card-text>

          <v-card-actions class="justify-center">
            <v-btn variant="text" to="/login">
              Volver al inicio de sesión
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { apiClient } from '@/services/api';

const router = useRouter();
const route = useRoute();

const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const loading = ref(false);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');
const isValid = ref(false);
const token = ref('');

onMounted(() => {
  token.value = route.query.token as string || '';
  if (!token.value) {
    message.value = 'Token de recuperación no válido o ausente.';
    messageType.value = 'error';
  }
});

async function handleSubmit() {
  if (!isValid.value || !token.value) return;

  try {
    loading.value = true;
    message.value = '';
    
    const response = await apiClient.post<any>('/auth/password/reset', {
      token: token.value,
      password: password.value
    });

    if (response.success) {
      message.value = 'Contraseña actualizada exitosamente. Redirigiendo...';
      messageType.value = 'success';
      setTimeout(() => router.push('/login'), 2000);
    } else {
      message.value = response.error || 'Error al actualizar la contraseña';
      messageType.value = 'error';
    }
  } catch (error) {
    message.value = 'Error de conexión. Intenta nuevamente.';
    messageType.value = 'error';
  } finally {
    loading.value = false;
  }
}
</script>
