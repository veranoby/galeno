<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="elevation-12 pa-4">
          <v-card-text>
            <div class="text-center mb-6">
              <v-icon icon="mdi-lock-reset" size="x-large" color="primary" class="mb-2" />
              <h1 class="text-h4 font-weight-bold">Recuperar Contraseña</h1>
              <p class="text-subtitle-1">Ingresa tu email para recibir el enlace</p>
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
                v-model="email"
                label="Email"
                name="email"
                prepend-inner-icon="mdi-email"
                type="email"
                variant="outlined"
                required
                :rules="[
                  v => !!v || 'Email es requerido',
                  v => /.+@.+\..+/.test(v) || 'Email debe ser válido'
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
                Enviar enlace
              </v-btn>
            </v-form>
          </v-card-text>

          <v-card-actions class="justify-center">
            <v-btn variant="text" to="/login" prepend-icon="mdi-arrow-left">
              Volver al inicio de sesión
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { apiClient } from '@/services/api';

const email = ref('');
const loading = ref(false);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');
const isValid = ref(false);

async function handleSubmit() {
  if (!isValid.value) return;

  try {
    loading.value = true;
    message.value = '';
    
    const response = await apiClient.post<any>('/auth/password/reset-request', {
      email: email.value
    });

    if (response.success) {
      message.value = 'Si el email está registrado, recibirás un enlace de recuperación pronto.';
      messageType.value = 'success';
      email.value = '';
    } else {
      message.value = response.error || 'Error al solicitar el enlace';
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
