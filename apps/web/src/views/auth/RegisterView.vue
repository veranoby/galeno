<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="5">
        <v-card class="elevation-12 pa-4">
          <v-card-text>
            <div class="text-center mb-6">
              <v-icon icon="mdi-account-plus" size="x-large" color="primary" class="mb-2" />
              <h1 class="text-h4 font-weight-bold">Únete a Galeno</h1>
              <p class="text-subtitle-1">Crea tu cuenta profesional</p>
            </div>

            <v-form @submit.prevent="handleRegister" v-model="isValid">
              <v-text-field
                v-model="nombre"
                label="Nombre Completo"
                prepend-inner-icon="mdi-account"
                variant="outlined"
                required
                :rules="[v => !!v || 'Nombre es requerido']"
              />

              <v-text-field
                v-model="email"
                label="Email Profesional"
                prepend-inner-icon="mdi-email"
                type="email"
                variant="outlined"
                required
                :rules="[
                  v => !!v || 'Email es requerido',
                  v => /.+@.+\..+/.test(v) || 'Email debe ser válido'
                ]"
              />

              <v-text-field
                v-model="password"
                label="Contraseña"
                prepend-inner-icon="mdi-lock"
                :type="showPassword ? 'text' : 'password'"
                variant="outlined"
                required
                :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append-inner="showPassword = !showPassword"
                hint="Mínimo 8 caracteres, una mayúscula, un número y un símbolo"
                persistent-hint
                :rules="[
                  v => !!v || 'Contraseña es requerida',
                  v => v.length >= 8 || 'Mínimo 8 caracteres'
                ]"
              />

              <v-checkbox
                v-model="acceptTerms"
                color="primary"
                required
                :rules="[v => !!v || 'Debe aceptar los términos']"
              >
                <template #label>
                  <div>
                    Acepto los
                    <a href="#" @click.stop class="text-primary">Términos y Condiciones</a>
                    y la
                    <a href="#" @click.stop class="text-primary">Política de Privacidad</a>
                  </div>
                </template>
              </v-checkbox>

              <v-btn
                type="submit"
                color="primary"
                block
                size="large"
                :loading="loading"
                :disabled="!isValid"
                class="mt-4"
              >
                Registrarse
              </v-btn>
            </v-form>
          </v-card-text>

          <v-card-actions class="justify-center">
            <p class="text-body-2">
              ¿Ya tiene una cuenta?
              <router-link to="/login" class="text-primary font-weight-bold">
                Inicie sesión
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
import { apiClient } from '@/services/api';

const router = useRouter();
const authStore = useAuthStore();

const nombre = ref('');
const email = ref('');
const password = ref('');
const acceptTerms = ref(false);
const showPassword = ref(false);
const loading = ref(false);
const isValid = ref(false);

async function handleRegister() {
  if (!isValid.value) return;

  try {
    loading.value = true;
    const response = await apiClient.post<any>('/auth/register', {
      nombre: nombre.value,
      email: email.value,
      password: password.value
    });

    if (response.success && response.data) {
      const { user, tokens } = response.data;
      authStore.setSession(user, tokens.accessToken, tokens.refreshToken);
      router.push('/onboarding');
    }
  } catch (error) {
    console.error('Registration failed', error);
  } finally {
    loading.value = false;
  }
}
</script>
