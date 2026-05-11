<!-- apps/web/src/views/doctor/PublicProfile.vue -->
<template>
  <v-container fluid class="doctor-profile-page">
    <v-row v-if="loading" justify="center" align="center" class="min-height">
      <v-progress-circular indeterminate size="64" color="primary" />
      <p class="mt-4 text-h6">Cargando perfil del doctor...</p>
    </v-row>

    <v-row v-else-if="error" justify="center" align="center" class="min-height">
      <v-alert type="error" variant="tonal" border="start" max-width="500">
        <template v-slot:prepend>
          <v-icon size="large">mdi-alert-circle</v-icon>
        </template>
        <div>
          <h3 class="text-h6 mb-2">Error al cargar el perfil</h3>
          <p>{{ error }}</p>
          <v-btn color="primary" variant="tonal" class="mt-4" @click="loadProfile">
            <v-icon start>mdi-refresh</v-icon>
            Reintentar
          </v-btn>
        </div>
      </v-alert>
    </v-row>

    <v-row v-else-if="profile" justify="center">
      <v-col cols="12" lg="10">
        <!-- Profile Header -->
        <div class="profile-header mb-6">
          <ProfileCard
            :doctor="profile"
            :rating-stats="ratingStats"
            @book="openBooking"
            @contact="openContact"
          />
        </div>

        <!-- Main Content -->
        <v-row>
          <!-- Left Column: Metrics & Ratings -->
          <v-col cols="12" md="4">
            <div class="sticky-sidebar">
              <ProfileMetrics
                :doctor="profile"
                :rating-stats="ratingStats"
                class="mb-6"
              />

              <!-- Quick Actions -->
              <v-card variant="outlined" class="mb-6">
                <v-card-title class="text-h6 font-weight-bold">
                  Acciones Rápidas
                </v-card-title>
                <v-card-text>
                  <v-btn
                    block
                    color="primary"
                    variant="elevated"
                    class="mb-2"
                    @click="openBooking"
                  >
                    <v-icon start>mdi-calendar-plus</v-icon>
                    Agendar Cita
                  </v-btn>
                  <v-btn
                    block
                    variant="outlined"
                    class="mb-2"
                    @click="openContact"
                  >
                    <v-icon start>mdi-message</v-icon>
                    Enviar Mensaje
                  </v-btn>
                  <v-btn
                    block
                    variant="text"
                    @click="shareProfile"
                  >
                    <v-icon start>mdi-share-variant</v-icon>
                    Compartir Perfil
                  </v-btn>
                </v-card-text>
              </v-card>
            </div>
          </v-col>

          <!-- Right Column: Bio, Reviews, etc -->
          <v-col cols="12" md="8">
            <!-- Bio -->
            <v-card variant="outlined" class="mb-6" v-if="profile.bio">
              <v-card-title class="text-h6 font-weight-bold">
                <v-icon start color="primary">mdi-account-details</v-icon>
                Sobre Mí
              </v-card-title>
              <v-card-text>
                <p class="text-body-1">{{ profile.bio }}</p>
              </v-card-text>
            </v-card>

            <!-- Educación -->
            <v-card variant="outlined" class="mb-6" v-if="profile.educacion">
              <v-card-title class="text-h6 font-weight-bold">
                <v-icon start color="primary">mdi-school</v-icon>
                Educación
              </v-card-title>
              <v-card-text>
                <div v-for="(edu, index) in educacionList" :key="index" class="mb-3">
                  <div class="text-subtitle-1 font-weight-bold">{{ edu.institucion }}</div>
                  <div class="text-body-2 text-grey-darken-1">{{ edu.titulo }}</div>
                  <div class="text-caption text-grey">{{ edu.anio }}</div>
                </div>
              </v-card-text>
            </v-card>

            <!-- Certificaciones -->
            <v-card variant="outlined" class="mb-6" v-if="profile.certificaciones">
              <v-card-title class="text-h6 font-weight-bold">
                <v-icon start color="primary">mdi-certificate</v-icon>
                Certificaciones
              </v-card-title>
              <v-card-text>
                <div v-for="(cert, index) in certificacionesList" :key="index" class="mb-2">
                  <v-chip color="primary" variant="tonal" size="small">
                    <v-icon start>mdi-check</v-icon>
                    {{ cert }}
                  </v-chip>
                </div>
              </v-card-text>
            </v-card>

            <!-- Valoraciones -->
            <v-card variant="outlined" class="mb-6">
              <v-card-title class="text-h6 font-weight-bold d-flex align-center">
                <v-icon start color="warning">mdi-star</v-icon>
                Valoraciones de Pacientes
                <v-chip size="small" color="primary" class="ml-auto">
                  {{ ratings?.total || 0 }} valoraciones
                </v-chip>
              </v-card-title>

              <v-card-text>
                <!-- Rating Summary -->
                <div class="rating-summary mb-4" v-if="ratingStats">
                  <div class="text-center">
                    <div class="display-1 font-weight-bold">{{ ratingStats.average }}</div>
                    <v-rating
                      :model-value="ratingStats.average"
                      readonly
                      color="warning"
                      density="compact"
                    />
                    <div class="text-caption text-grey-darken-1">
                      Basado en {{ ratingStats.total }} valoraciones
                    </div>
                  </div>
                </div>

                <!-- Rating List -->
                <RatingList
                  :doctor-id="profile.doctorId"
                  :initial-ratings="ratings?.ratings || []"
                  @load-more="loadMoreRatings"
                />

                <!-- Write Review Button -->
                <v-divider class="my-4" />
                <div class="text-center">
                  <v-btn
                    color="primary"
                    variant="elevated"
                    @click="openRatingForm"
                  >
                    <v-icon start>mdi-pencil</v-icon>
                    Escribir una Valoración
                  </v-btn>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <!-- Booking Dialog -->
    <v-dialog v-model="showBookingDialog" max-width="600">
      <v-card>
        <v-card-title class="text-h5">Agendar Cita</v-card-title>
        <v-card-text>
          <p>Funcionalidad de agendamiento en desarrollo...</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" variant="text" @click="showBookingDialog = false">
            Cerrar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Contact Dialog -->
    <v-dialog v-model="showContactDialog" max-width="500">
      <v-card>
        <v-card-title class="text-h5">Contactar Doctor</v-card-title>
        <v-card-text>
          <v-form>
            <v-textarea
              v-model="contactMessage"
              label="Mensaje"
              variant="outlined"
              rows="4"
              placeholder="Escribe tu mensaje aquí..."
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showContactDialog = false">Cancelar</v-btn>
          <v-btn color="primary" variant="elevated" @click="sendContact">Enviar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Rating Form Dialog -->
    <v-dialog v-model="showRatingDialog" max-width="600">
      <RatingForm
        :doctor-id="profile?.doctorId || ''"
        @submitted="handleRatingSubmitted"
        @close="showRatingDialog = false"
      />
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'vue-toastification';
import ProfileCard from '@/components/doctor/ProfileCard.vue';
import ProfileMetrics from '@/components/doctor/ProfileMetrics.vue';
import RatingList from '@/components/doctor/RatingList.vue';
import RatingForm from '@/components/doctor/RatingForm.vue';
import { apiClient } from '@/services/api';

interface DoctorProfile {
  id: string;
  doctorId: string;
  bio?: string;
  experiencia?: number;
  especialidades?: string;
  educacion?: any;
  certificaciones?: any;
  idiomas?: string;
  precioConsulta?: number;
  ubicacion?: string;
  telefonoPublico?: string;
  emailPublico?: string;
  website?: string;
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  fotoPerfilUrl?: string;
  fotoPortadaUrl?: string;
  verificado?: boolean;
  destacado?: boolean;
  activo?: boolean;
  vistasPerfil?: number;
  doctor?: {
    id: string;
    nombre: string;
    especialidad?: string;
  };
}

interface RatingStats {
  total: number;
  average: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

const route = useRoute();
const toast = useToast();

const loading = ref(true);
const error = ref<string | null>(null);
const profile = ref<DoctorProfile | null>(null);
const ratingStats = ref<RatingStats | null>(null);
const ratings = ref<any>(null);

const showBookingDialog = ref(false);
const showContactDialog = ref(false);
const showRatingDialog = ref(false);
const contactMessage = ref('');

const educacionList = computed(() => {
  if (!profile.value?.educacion) return [];
  try {
    return typeof profile.value.educacion === 'string'
      ? JSON.parse(profile.value.educacion)
      : profile.value.educacion;
  } catch {
    return [];
  }
});

const certificacionesList = computed(() => {
  if (!profile.value?.certificaciones) return [];
  try {
    return typeof profile.value.certificaciones === 'string'
      ? JSON.parse(profile.value.certificaciones)
      : profile.value.certificaciones;
  } catch {
    return [];
  }
});

const loadProfile = async () => {
  try {
    loading.value = true;
    error.value = null;

    const profileId = route.params.id as string;
    const response = await apiClient.get<{ data: DoctorProfile }>(
      `/api/v1/doctor/public/${profileId}`
    );

    if (response.success && response.data) {
      profile.value = response.data.data;
      
      // Load rating stats
      loadRatingStats(profile.value.doctorId);
      loadRatings(profile.value.doctorId);
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Error al cargar el perfil';
    toast.error(error.value);
  } finally {
    loading.value = false;
  }
};

const loadRatingStats = async (doctorId: string) => {
  try {
    const response = await apiClient.get<{ data: RatingStats }>(
      `/api/v1/doctor/public/${doctorId}/ratings/stats`
    );

    if (response.success && response.data) {
      ratingStats.value = response.data.data;
    }
  } catch (err) {
    console.error('Error loading rating stats:', err);
  }
};

const loadRatings = async (doctorId: string, offset = 0) => {
  try {
    const response = await apiClient.get<{ data: any }>(
      `/api/v1/doctor/public/${doctorId}/ratings?limit=10&offset=${offset}`
    );

    if (response.success && response.data) {
      ratings.value = response.data.data;
    }
  } catch (err) {
    console.error('Error loading ratings:', err);
  }
};

const loadMoreRatings = async () => {
  if (!profile.value || !ratings.value) return;
  
  const newOffset = (ratings.value.offset || 0) + (ratings.value.limit || 10);
  await loadRatings(profile.value.doctorId, newOffset);
};

const openBooking = () => {
  showBookingDialog.value = true;
};

const openContact = () => {
  showContactDialog.value = true;
};

const sendContact = async () => {
  if (!contactMessage.value.trim()) {
    toast.error('Por favor escribe un mensaje');
    return;
  }

  try {
    // TODO: Implement contact API
    toast.success('Mensaje enviado al doctor');
    contactMessage.value = '';
    showContactDialog.value = false;
  } catch (err: any) {
    toast.error(err.message || 'Error al enviar mensaje');
  }
};

const openRatingForm = () => {
  showRatingDialog.value = true;
};

const handleRatingSubmitted = () => {
  showRatingDialog.value = false;
  toast.success('¡Gracias por tu valoración!');
  
  // Reload ratings
  if (profile.value) {
    loadRatingStats(profile.value.doctorId);
    loadRatings(profile.value.doctorId);
  }
};

const shareProfile = async () => {
  const url = window.location.href;
  
  if (navigator.share) {
    try {
      await navigator.share({
        title: `Perfil de ${profile.value?.doctor?.nombre || 'Doctor'}`,
        url
      });
    } catch (err) {
      copyToClipboard(url);
    }
  } else {
    copyToClipboard(url);
  }
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success('Enlace copiado al portapapeles');
};

onMounted(() => {
  loadProfile();
});
</script>

<style scoped lang="scss">
.doctor-profile-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 16px;
}

.min-height {
  min-height: 60vh;
}

.profile-header {
  max-width: 1000px;
  margin: 0 auto;
}

.sticky-sidebar {
  position: sticky;
  top: 24px;
}

.rating-summary {
  padding: 24px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.display-1 {
  font-size: 4rem;
  line-height: 1;
}

@media (max-width: 960px) {
  .sticky-sidebar {
    position: static;
  }
  
  .display-1 {
    font-size: 3rem;
  }
}
</style>
