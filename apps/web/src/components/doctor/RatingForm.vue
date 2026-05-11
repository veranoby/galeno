<!-- apps/web/src/components/doctor/RatingForm.vue -->
<template>
  <v-card>
    <v-card-title class="text-h5 py-4">
      <v-icon start color="warning">mdi-star</v-icon>
      Valorar al Doctor
    </v-card-title>

    <v-card-text>
      <v-form ref="formRef" v-slot="{ isValid }">
        <!-- Rating -->
        <div class="text-center mb-6">
          <p class="text-subtitle-1 mb-2">¿Cómo fue tu experiencia?</p>
          <StarRating
            v-model="rating"
            :size="40"
            interactive
            class="mb-2"
          />
          <div class="text-h6 font-weight-bold" :style="{ color: ratingColor }">
            {{ ratingText }}
          </div>
        </div>

        <!-- Comment -->
        <v-textarea
          v-model="comment"
          label="Tu valoración (opcional)"
          variant="outlined"
          rows="4"
          placeholder="Comparte tu experiencia con este doctor..."
          counter="500"
          maxlength="500"
          hide-details="auto"
          class="mb-4"
        />

        <!-- Anonymous Toggle -->
        <v-switch
          v-model="anonymous"
          label="Publicar como anónimo"
          color="primary"
          hide-details
        />

        <!-- Consultation Link (if applicable) -->
        <v-select
          v-if="consultations.length > 0"
          v-model="selectedConsultation"
          :items="consultations"
          item-title="fecha"
          item-value="id"
          label="Selecciona la consulta (opcional)"
          variant="outlined"
          hide-details
          class="mt-4"
        />
      </v-form>
    </v-card-text>

    <v-card-actions class="pa-4">
      <v-spacer />
      <v-btn
        variant="text"
        @click="$emit('close')"
      >
        Cancelar
      </v-btn>
      <v-btn
        color="primary"
        variant="elevated"
        :disabled="!isValid || rating === 0"
        :loading="isSubmitting"
        @click="submitRating"
      >
        <v-icon start>mdi-send</v-icon>
        Enviar Valoración
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useToast } from 'vue-toastification';
import StarRating from './StarRating.vue';
import { apiClient } from '@/services/api';

interface Props {
  doctorId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'submitted'): void;
  (e: 'close'): void;
}>();

const toast = useToast();
const formRef = ref<HTMLFormElement | null>(null);
const rating = ref(0);
const comment = ref('');
const anonymous = ref(false);
const selectedConsultation = ref<string | null>(null);
const isSubmitting = ref(false);
const consultations = ref<any[]>([]);

const ratingText = computed(() => {
  const texts = [
    '',
    'Muy malo',
    'Malo',
    'Regular',
    'Bueno',
    'Excelente'
  ];
  return texts[rating.value] || '';
});

const ratingColor = computed(() => {
  const colors = [
    '',
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#84cc16',
    '#10b981'
  ];
  return colors[rating.value] || '';
});

const submitRating = async () => {
  if (rating.value < 1 || rating.value > 5) {
    toast.error('Por favor selecciona una valoración');
    return;
  }

  try {
    isSubmitting.value = true;

    await apiClient.post(`/api/v1/doctor/public/${props.doctorId}/ratings`, {
      rating: rating.value,
      comentario: comment.value,
      anonimizado: anonymous.value,
      consultaId: selectedConsultation.value
    });

    toast.success('¡Gracias por tu valoración!');
    emit('submitted');
  } catch (err: any) {
    toast.error(err.response?.data?.error || 'Error al enviar valoración');
  } finally {
    isSubmitting.value = false;
  }
};

// Load user consultations (optional)
const loadConsultations = async () => {
  try {
    const response = await apiClient.get('/api/v1/consultas');
    if (response.success && response.data) {
      consultations.value = response.data.data
        .filter((c: any) => c.doctorId === props.doctorId)
        .map((c: any) => ({
          id: c.id,
          fecha: new Date(c.createdAt).toLocaleDateString('es-EC')
        }));
    }
  } catch (err) {
    console.error('Error loading consultations:', err);
  }
};

// onMounted(() => {
//   loadConsultations();
// });
</script>
