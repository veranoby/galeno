<!-- apps/web/src/components/doctor/RatingList.vue -->
<template>
  <div class="rating-list">
    <div v-if="loading" class="text-center py-8">
      <v-progress-circular indeterminate size="40" color="primary" />
      <p class="mt-2 text-grey-darken-1">Cargando valoraciones...</p>
    </div>

    <div v-else-if="ratings.length === 0" class="text-center py-8">
      <v-icon size="64" color="grey-lighten-2" class="mb-4">mdi-star-outline</v-icon>
      <p class="text-grey-darken-1">Aún no hay valoraciones</p>
      <p class="text-caption text-grey">¡Sé el primero en valorar!</p>
    </div>

    <div v-else>
      <v-list class="bg-transparent">
        <v-list-item
          v-for="rating in ratings"
          :key="rating.id"
          class="mb-4"
          variant="tonal"
          rounded="lg"
        >
          <template v-slot:prepend>
            <v-avatar size="40" color="primary">
              <v-icon v-if="rating.anonimizado" color="white">mdi-account</v-icon>
              <v-img v-else :src="rating.paciente?.foto" alt="Paciente" />
            </v-avatar>
          </template>

          <v-list-item-title class="d-flex align-center">
            <span class="font-weight-bold">
              {{ rating.anonimizado ? 'Paciente Anónimo' : (rating.paciente?.nombre || 'Paciente') }}
            </span>
            <v-rating
              :model-value="rating.rating"
              readonly
              density="compact"
              size="small"
              color="warning"
              class="ml-auto"
            />
          </v-list-item-title>

          <v-list-item-subtitle class="mt-1">
            <div class="text-caption text-grey-darken-1">
              {{ formatDate(rating.createdAt) }}
              <span v-if="rating.consultaId" class="ml-2">
                <v-icon size="x-small">mdi-check-circle</v-icon>
                Consulta verificada
              </span>
            </div>
          </v-list-item-subtitle>

          <v-list-item-text class="mt-2" v-if="rating.comentario">
            <p class="text-body-2">{{ rating.comentario }}</p>
          </v-list-item-text>

          <!-- Usefulness -->
          <div class="d-flex align-center mt-2" v-if="!rating.anonimizado">
            <v-btn
              size="small"
              variant="text"
              @click="markUseful(rating.id, true)"
            >
              <v-icon start size="small">mdi-thumb-up</v-icon>
              {{ rating.util || 0 }}
            </v-btn>
            <v-btn
              size="small"
              variant="text"
              @click="markUseful(rating.id, false)"
            >
              <v-icon start size="small">mdi-thumb-down</v-icon>
              {{ rating.noUtil || 0 }}
            </v-btn>
            <v-btn
              size="small"
              variant="text"
              color="error"
              class="ml-auto"
              @click="reportRating(rating.id)"
            >
              <v-icon start size="small">mdi-flag</v-icon>
              Reportar
            </v-btn>
          </div>

          <!-- Doctor Response -->
          <v-alert
            v-if="rating.respuesta"
            variant="tonal"
            density="compact"
            border="start"
            color="primary"
            class="mt-3"
          >
            <template v-slot:prepend>
              <v-icon size="small">mdi-reply</v-icon>
            </template>
            <strong>Respuesta del doctor:</strong>
            <p class="mt-1 mb-0">{{ rating.respuesta }}</p>
            <div class="text-caption mt-1">
              {{ formatDate(rating.respuestaFecha) }}
            </div>
          </v-alert>
        </v-list-item>
      </v-list>

      <!-- Load More -->
      <div class="text-center mt-4" v-if="hasMore">
        <v-btn
          variant="outlined"
          color="primary"
          :loading="loadingMore"
          @click="$emit('load-more')"
        >
          <v-icon start>mdi-refresh</v-icon>
          Cargar más valoraciones
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useToast } from 'vue-toastification';
import { apiClient } from '@/services/api';

interface Rating {
  id: string;
  doctorId: string;
  pacienteId: string;
  rating: number;
  comentario?: string;
  anonimizado: boolean;
  aprobado: boolean;
  reportado: boolean;
  util: number;
  noUtil: number;
  respuesta?: string;
  respuestaFecha?: string;
  createdAt: string;
  updatedAt: string;
  paciente?: {
    nombre: string;
    foto?: string;
  };
}

interface Props {
  doctorId: string;
  initialRatings?: Rating[];
}

const props = withDefaults(defineProps<Props>(), {
  initialRatings: () => []
});

const emit = defineEmits<{
  (e: 'load-more'): void;
}>();

const toast = useToast();
const loading = ref(false);
const loadingMore = ref(false);
const ratings = ref<Rating[]>(props.initialRatings || []);
const hasMore = ref(true);

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const markUseful = async (ratingId: string, useful: boolean) => {
  try {
    await apiClient.post(`/api/v1/doctor/ratings/${ratingId}/useful`, { useful });
    toast.success('Gracias por tu feedback');
    
    // Update local count
    const rating = ratings.value.find(r => r.id === ratingId);
    if (rating) {
      if (useful) rating.util++;
      else rating.noUtil++;
    }
  } catch (err: any) {
    toast.error(err.response?.data?.error || 'Error al marcar valoración');
  }
};

const reportRating = async (ratingId: string) => {
  const confirmed = confirm('¿Estás seguro de reportar esta valoración como inapropiada?');
  if (!confirmed) return;

  try {
    await apiClient.post(`/api/v1/doctor/ratings/${ratingId}/report`);
    toast.success('Valoración reportada. Nuestro equipo la revisará.');
    
    const rating = ratings.value.find(r => r.id === ratingId);
    if (rating) {
      rating.reportado = true;
    }
  } catch (err: any) {
    toast.error(err.response?.data?.error || 'Error al reportar valoración');
  }
};

onMounted(() => {
  if (props.initialRatings.length === 0) {
    // Load initial ratings if not provided
    // This would be handled by the parent component
  }
});
</script>

<style scoped lang="scss">
.rating-list {
  .v-list-item {
    transition: all 0.3s ease;
    
    &:hover {
      transform: translateX(4px);
    }
  }
}
</style>
