<!-- apps/web/src/components/doctor/ProfileMetrics.vue -->
<template>
  <v-card class="profile-metrics" variant="outlined">
    <v-card-title class="text-h6 font-weight-bold mb-4">
      <v-icon start color="primary">mdi-chart-bar</v-icon>
      Métricas del Doctor
    </v-card-title>

    <v-row dense>
      <!-- Experiencia -->
      <v-col cols="6" md="3">
        <v-card variant="tonal" color="primary" class="metric-card">
          <v-card-text class="text-center">
            <v-icon size="40" class="mb-2">mdi-briefcase</v-icon>
            <div class="text-h4 font-weight-bold">{{ doctor.experiencia || 0 }}</div>
            <div class="text-caption">Años de Experiencia</div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Vistas al Perfil -->
      <v-col cols="6" md="3">
        <v-card variant="tonal" color="success" class="metric-card">
          <v-card-text class="text-center">
            <v-icon size="40" class="mb-2">mdi-eye</v-icon>
            <div class="text-h4 font-weight-bold">{{ formatNumber(doctor.vistasPerfil || 0) }}</div>
            <div class="text-caption">Vistas al Perfil</div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Valoraciones -->
      <v-col cols="6" md="3">
        <v-card variant="tonal" color="warning" class="metric-card">
          <v-card-text class="text-center">
            <v-icon size="40" class="mb-2">mdi-star</v-icon>
            <div class="text-h4 font-weight-bold">{{ ratingStats?.total || 0 }}</div>
            <div class="text-caption">Valoraciones</div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Rating Promedio -->
      <v-col cols="6" md="3">
        <v-card variant="tonal" color="secondary" class="metric-card">
          <v-card-text class="text-center">
            <v-icon size="40" class="mb-2">mdi-emoticon-happy</v-icon>
            <div class="text-h4 font-weight-bold">{{ ratingStats?.average || 'N/A' }}</div>
            <div class="text-caption">Rating Promedio</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Rating Distribution -->
    <div v-if="ratingStats?.distribution" class="rating-distribution mt-6">
      <h3 class="text-subtitle-1 font-weight-bold mb-3">Distribución de Valoraciones</h3>
      
      <div v-for="stars in [5, 4, 3, 2, 1]" :key="stars" class="rating-bar mb-2">
        <div class="rating-label">
          <v-rating
            :model-value="stars"
            readonly
            density="compact"
            size="small"
            class="d-inline"
          />
          <span class="text-caption ml-2">
            ({{ ratingStats.distribution[stars as keyof typeof ratingStats.distribution] }})
          </span>
        </div>
        <v-progress-linear
          :model-value="calculatePercentage(stars)"
          :color="getColor(stars)"
          height="8"
          rounded
          class="mx-2"
        />
      </div>
    </div>

    <!-- Especialidades -->
    <div v-if="especialidadesList.length > 0" class="mt-6">
      <h3 class="text-subtitle-1 font-weight-bold mb-3">Especialidades</h3>
      <div class="d-flex flex-wrap gap-2">
        <v-chip
          v-for="(especialidad, index) in especialidadesList"
          :key="index"
          color="primary"
          variant="tonal"
          size="small"
          class="mr-2 mb-2"
        >
          <v-icon start size="small">mdi-check</v-icon>
          {{ especialidad }}
        </v-chip>
      </div>
    </div>

    <!-- Idiomas -->
    <div v-if="idiomasList.length > 0" class="mt-6">
      <h3 class="text-subtitle-1 font-weight-bold mb-3">Idiomas</h3>
      <div class="d-flex flex-wrap gap-2">
        <v-chip
          v-for="(idioma, index) in idiomasList"
          :key="index"
          color="secondary"
          variant="outlined"
          size="small"
          class="mr-2 mb-2"
        >
          <v-icon start size="small">mdi-translate</v-icon>
          {{ idioma }}
        </v-chip>
      </div>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';

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

interface DoctorProfile {
  experiencia?: number;
  vistasPerfil?: number;
  especialidades?: string;
  idiomas?: string;
}

interface Props {
  doctor: DoctorProfile;
  ratingStats?: RatingStats | null;
}

const props = withDefaults(defineProps<Props>(), {
  ratingStats: null
});

const especialidadesList = computed(() => {
  if (!props.doctor.especialidades) return [];
  try {
    return JSON.parse(props.doctor.especialidades);
  } catch {
    return props.doctor.especialidades.split(',').map((s: string) => s.trim());
  }
});

const idiomasList = computed(() => {
  if (!props.doctor.idiomas) return [];
  try {
    return JSON.parse(props.doctor.idiomas);
  } catch {
    return props.doctor.idiomas.split(',').map((s: string) => s.trim());
  }
});

const formatNumber = (num: number): string => {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
};

const calculatePercentage = (stars: number): number => {
  if (!props.ratingStats?.total) return 0;
  const count = props.ratingStats.distribution[stars as keyof typeof props.ratingStats.distribution];
  return (count / props.ratingStats.total) * 100;
};

const getColor = (stars: number): string => {
  const colors: Record<number, string> = {
    5: 'success',
    4: 'primary',
    3: 'warning',
    2: 'orange',
    1: 'error'
  };
  return colors[stars] || 'grey';
};
</script>

<style scoped lang="scss">
.profile-metrics {
  padding: 24px;
}

.metric-card {
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  }
}

.rating-distribution {
  .rating-bar {
    display: flex;
    align-items: center;
    
    .rating-label {
      min-width: 140px;
      display: flex;
      align-items: center;
    }
    
    .v-progress-linear {
      flex: 1;
    }
  }
}

.gap-2 {
  gap: 8px;
}
</style>
