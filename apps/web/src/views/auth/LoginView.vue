<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="elevation-12 pa-4">
          <v-card-text>
            <div class="text-center mb-6">
              <v-icon icon="mdi-shield-check" size="x-large" color="primary" class="mb-2" />
              <h1 class="text-h4 font-weight-bold">Galeno</h1>
              <p class="text-subtitle-1">Ecuador-Health 360</p>
            </div>

            <v-form @submit.prevent="handleLogin">
              <v-text-field
                v-model="email"
                label="Email"
                name="email"
                prepend-inner-icon="mdi-email"
                type="email"
                variant="outlined"
                required
                :error-messages="authStore.error"
              />

              <v-text-field
                v-model="password"
                label="Contraseña"
                name="password"
                prepend-inner-icon="mdi-lock"
                :type="showPassword ? 'text' : 'password'"
                variant="outlined"
                required
                :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append-inner="showPassword = !showPassword"
              />

              <div class="d-flex align-center justify-space-between mb-4">
                <v-checkbox
                  v-model="rememberMe"
                  label="Recordarme"
                  hide-details
                  density="compact"
                />
                <router-link to="/forgot-password" class="text-caption text-primary">
                  ¿Olvidó su contraseña?
                </router-link>
              </div>

              <v-btn
                type="submit"
                color="primary"
                block
                size="large"
                :loading="authStore.loading"
              >
                Iniciar Sesión
              </v-btn>
            </v-form>
          </v-card-text>

          <v-card-actions class="justify-center">
            <p class="text-body-2">
              ¿No tiene una cuenta?
              <router-link to="/register" class="text-primary font-weight-bold">
                Regístrese aquí
              </router-link>
            </p>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const rememberMe = ref(false);
const showPassword = ref(false);

async function handleLogin() {
  try {
    await authStore.login({
      email: email.value,
      password: password.value
    });
    router.push('/');
  } catch (error) {
    // Error handled by store
  }
}
</script>
