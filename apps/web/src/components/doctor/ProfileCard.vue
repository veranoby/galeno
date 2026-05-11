<!-- apps/web/src/components/doctor/ProfileCard.vue -->
<template>
  <v-card class="profile-card" :class="{ 'verified': doctor.verificado, 'destacado': doctor.destacado }">
    <!-- Cover Image -->
    <div class="profile-cover" :style="{ backgroundImage: `url(${doctor.fotoPortadaUrl || '/default-cover.jpg'}` }">
      <v-chip
        v-if="doctor.destacado"
        color="primary"
        size="small"
        class="featured-badge"
      >
        <v-icon start size="small">mdi-star</v-icon>
        Destacado
      </v-chip>
    </div>

    <!-- Profile Info -->
    <div class="profile-content">
      <!-- Avatar -->
      <div class="profile-avatar">
        <v-avatar size="120" class="border-thick border-white">
          <v-img
            v-if="doctor.fotoPerfilUrl"
            :src="doctor.fotoPerfilUrl"
            :alt="doctor.doctor?.nombre"
          />
          <v-icon v-else size="64" color="grey-lighten-1">mdi-account-circle</v-icon>
        </v-avatar>
        <v-chip
          v-if="doctor.verificado"
          color="success"
          size="small"
          class="verified-badge"
        >
          <v-icon start size="x-small">mdi-check-circle</v-icon>
          Verificado
        </v-chip>
      </div>

      <!-- Doctor Info -->
      <div class="profile-info text-center">
        <h2 class="text-h5 font-weight-bold mb-1">
          {{ doctor.doctor?.nombre || 'Doctor' }}
        </h2>
        <p class="text-subtitle-1 text-grey-darken-1 mb-2">
          {{ doctor.doctor?.especialidad || 'Especialidad' }}
        </p>

        <!-- Rating -->
        <div class="profile-rating mb-3" v-if="ratingStats">
          <v-rating
            :model-value="ratingStats.average"
            color="warning"
            size="small"
            readonly
            density="compact"
          />
          <span class="text-caption text-grey-darken-1 ml-2">
            {{ ratingStats.average }} ({{ ratingStats.total }} valoraciones)
          </span>
        </div>

        <!-- Location -->
        <div class="profile-location text-grey-darken-1 mb-3" v-if="doctor.ubicacion">
          <v-icon size="small" start>mdi-map-marker</v-icon>
          {{ doctor.ubicacion }}
        </div>

        <!-- Price -->
        <div class="profile-price mb-3" v-if="doctor.precioConsulta">
          <v-chip color="primary" variant="tonal">
            <v-icon start>mdi-cash</v-icon>
            {{ formatPrice(doctor.precioConsulta) }} / consulta
          </v-chip>
        </div>

        <!-- Actions -->
        <div class="profile-actions">
          <v-btn
            color="primary"
            variant="elevated"
            class="mr-2"
            @click="$emit('book')"
          >
            <v-icon start>mdi-calendar-plus</v-icon>
            Agendar
          </v-btn>
          <v-btn
            variant="outlined"
            @click="$emit('contact')"
          >
            <v-icon start>mdi-message</v-icon>
            Contactar
          </v-btn>
        </div>
      </div>

      <!-- Social Links -->
      <div class="profile-social mt-4" v-if="hasSocialLinks">
        <v-btn
          v-if="doctor.website"
          icon
          size="small"
          variant="text"
          :href="doctor.website"
          target="_blank"
        >
          <v-icon>mdi-web</v-icon>
        </v-btn>
        <v-btn
          v-if="doctor.linkedin"
          icon
          size="small"
          variant="text"
          :href="doctor.linkedin"
          target="_blank"
        >
          <v-icon>mdi-linkedin</v-icon>
        </v-btn>
        <v-btn
          v-if="doctor.twitter"
          icon
          size="small"
          variant="text"
          :href="doctor.twitter"
          target="_blank"
        >
          <v-icon>mdi-twitter</v-icon>
        </v-btn>
        <v-btn
          v-if="doctor.facebook"
          icon
          size="small"
          variant="text"
          :href="doctor.facebook"
          target="_blank"
        >
          <v-icon>mdi-facebook</v-icon>
        </v-btn>
        <v-btn
          v-if="doctor.instagram"
          icon
          size="small"
          variant="text"
          :href="doctor.instagram"
          target="_blank"
        >
          <v-icon>mdi-instagram</v-icon>
        </v-btn>
      </div>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface DoctorProfile {
  id: string;
  doctorId: string;
  bio?: string;
  experiencia?: number;
  especialidades?: string;
  educacion?: any;
  certificaciones?: any;
  idiomas?: string;
  precioConsulta?: number | string;
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

interface Props {
  doctor: DoctorProfile;
  ratingStats?: RatingStats | null;
}

const props = withDefaults(defineProps<Props>(), {
  ratingStats: null
});

const emit = defineEmits<{
  (e: 'book'): void;
  (e: 'contact'): void;
}>();

const hasSocialLinks = computed(() => {
  return !!(
    props.doctor.website ||
    props.doctor.linkedin ||
    props.doctor.twitter ||
    props.doctor.facebook ||
    props.doctor.instagram
  );
});

const formatPrice = (price: number | string): string => {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(numPrice);
};
</script>

<style scoped lang="scss">
.profile-card {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    transform: translateY(-4px);
  }

  &.verified {
    border: 2px solid #10b981;
  }

  &.destacado {
    border: 2px solid #3b82f6;
  }
}

.profile-cover {
  height: 160px;
  background-size: cover;
  background-position: center;
  position: relative;

  .featured-badge {
    position: absolute;
    top: 12px;
    right: 12px;
  }
}

.profile-content {
  padding: 0 24px 24px;
}

.profile-avatar {
  position: relative;
  margin-top: -60px;
  margin-bottom: 16px;
  text-align: center;

  .verified-badge {
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
  }
}

.profile-info {
  margin-bottom: 16px;
}

.profile-rating {
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-location,
.profile-price {
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.profile-social {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.border-thick {
  border-width: 4px !important;
}
</style>
