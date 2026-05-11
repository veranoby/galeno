<template>
  <v-container class="fill-height" fluid>
    <v-row justify="center">
      <v-col cols="12" sm="10" md="8" lg="6">
        <v-card class="elevation-12 overflow-hidden">
          <v-row no-gutters>
            <!-- Left Side: Progress -->
            <v-col cols="12" md="4" class="bg-primary pa-6 text-white">
              <h2 class="text-h5 mb-6">Configuración</h2>
              <v-timeline side="end" align="start" density="compact">
                <v-timeline-item
                  v-for="(step, index) in steps"
                  :key="index"
                  :dot-color="currentStepIndex >= index ? 'white' : 'primary-lighten-1'"
                  size="small"
                >
                  <div :class="{ 'font-weight-bold': currentStepIndex === index }">
                    {{ step.title }}
                  </div>
                </v-timeline-item>
              </v-timeline>
            </v-col>

            <!-- Right Side: Content -->
            <v-col cols="12" md="8" class="pa-8">
              <v-window v-model="currentStepIndex">
                <!-- Step 1: Welcome -->
                <v-window-item :value="0">
                  <div class="text-center">
                    <v-icon icon="mdi-medical-bag" size="80" color="primary" class="mb-4" />
                    <h3 class="text-h4 mb-4">¡Bienvenido, {{ authStore.user?.nombre }}!</h3>
                    <p class="text-body-1 mb-6">
                      Estamos emocionados de tenerte en Galeno. Vamos a configurar tu perfil profesional en menos de 5 minutos.
                    </p>
                    <v-btn color="primary" size="large" @click="currentStepIndex++">
                      Comenzar
                    </v-btn>
                  </div>
                </v-window-item>

                <!-- Step 2: Specialization -->
                <v-window-item :value="1">
                  <h3 class="text-h5 mb-4">Información Profesional</h3>
                  <v-form v-model="isProfileValid">
                    <v-select
                      v-model="profile.especialidad"
                      :items="especialidades"
                      label="Especialidad Principal"
                      variant="outlined"
                      required
                    />
                    <v-text-field
                      v-model="profile.numeroLicencia"
                      label="Número de Licencia / Registro"
                      variant="outlined"
                      required
                    />
                    <v-text-field
                      v-model="profile.telefono"
                      label="Teléfono de Contacto"
                      variant="outlined"
                      required
                    />
                  </v-form>
                  <div class="d-flex justify-end mt-6">
                    <v-btn variant="text" class="mr-2" @click="currentStepIndex--">Atrás</v-btn>
                    <v-btn color="primary" :disabled="!isProfileValid" @click="currentStepIndex++">Siguiente</v-btn>
                  </div>
                </v-window-item>

                <!-- Step 3: Office -->
                <v-window-item :value="2">
                  <h3 class="text-h5 mb-4">Tu Consultorio</h3>
                  <v-form v-model="isOfficeValid">
                    <v-text-field
                      v-model="profile.consultorio.nombre"
                      label="Nombre del Consultorio"
                      variant="outlined"
                      required
                    />
                    <v-text-field
                      v-model="profile.consultorio.direccion"
                      label="Dirección"
                      variant="outlined"
                      required
                    />
                    <v-row>
                      <v-col cols="6">
                        <v-text-field
                          v-model="profile.consultorio.ciudad"
                          label="Ciudad"
                          variant="outlined"
                          required
                        />
                      </v-col>
                      <v-col cols="6">
                        <v-text-field
                          v-model="profile.consultorio.telefono"
                          label="Teléfono Consultorio"
                          variant="outlined"
                        />
                      </v-col>
                    </v-row>
                  </v-form>
                  <div class="d-flex justify-end mt-6">
                    <v-btn variant="text" class="mr-2" @click="currentStepIndex--">Atrás</v-btn>
                    <v-btn color="primary" :disabled="!isOfficeValid" :loading="loading" @click="completeOnboarding">
                      Finalizar
                    </v-btn>
                  </div>
                </v-window-item>
              </v-window>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { apiClient } from '@/services/api';

const router = useRouter();
const authStore = useAuthStore();

const currentStepIndex = ref(0);
const loading = ref(false);
const isProfileValid = ref(false);
const isOfficeValid = ref(false);

const steps = [
  { title: 'Bienvenida' },
  { title: 'Perfil Profesional' },
  { title: 'Consultorio' }
];

const especialidades = [
  'Medicina General',
  'Pediatría',
  'Ginecología',
  'Cardiología',
  'Dermatología',
  'Psiquiatría',
  'Traumatología',
  'Otros'
];

const profile = reactive({
  especialidad: '',
  numeroLicencia: '',
  telefono: '',
  consultorio: {
    nombre: '',
    direccion: '',
    ciudad: '',
    telefono: ''
  }
});

async function completeOnboarding() {
  try {
    loading.value = true;
    
    // Save profile and office info
    const response = await apiClient.post<any>('/onboarding/setup-profile', {
      ...profile,
      preferencias: {
        idioma: 'es',
        zonaHoraria: 'America/Guayaquil',
        formatoHora: '24h'
      }
    });

    if (response.success) {
      // Mark onboarding as complete in backend
      await apiClient.post('/onboarding/complete', {});
      
      // Update local user state if needed
      if (response.data?.user) {
        authStore.user = response.data.user;
      }
      
      router.push('/');
    }
  } catch (error) {
    console.error('Onboarding failed', error);
  } finally {
    loading.value = false;
  }
}
</script>
