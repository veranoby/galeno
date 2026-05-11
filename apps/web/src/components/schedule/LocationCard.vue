<!-- apps/web/src/components/schedule/LocationCard.vue -->
<template>
  <v-card class="location-card" :class="{ 'active-location': isActive }">
    <v-card-title class="pb-2">
      <v-icon left :color="isActive ? 'green' : 'grey'">
        {{ isActive ? 'mdi-map-marker-check' : 'mdi-map-marker-radius' }}
      </v-icon>
      {{ office.nombre }}
    </v-card-title>

    <v-card-subtitle class="pt-1 pb-2">
      {{ office.direccion }}
    </v-card-subtitle>

    <v-card-text>
      <div class="location-info mb-3">
        <div class="d-flex align-center mb-2">
          <v-icon small class="mr-2">mdi-phone</v-icon>
          <span>{{ office.telefono || 'No especificado' }}</span>
        </div>

        <div class="d-flex align-center mb-2">
          <v-icon small class="mr-2">mdi-information</v-icon>
          <span>{{ office.indicaciones || 'Sin indicaciones especiales' }}</span>
        </div>

        <div class="d-flex align-center">
          <v-icon small class="mr-2">mdi-map-marker</v-icon>
          <span>{{ formatCoordinates(office.lat, office.lng) }}</span>
        </div>
      </div>

      <!-- Doctor presence indicator -->
      <div class="doctor-presence mb-3">
        <v-chip 
          v-if="isDoctorPresent" 
          color="green" 
          text-color="white" 
          small
        >
          <v-icon left small>mdi-check</v-icon>
          Doctor Presente
        </v-chip>
        
        <v-chip 
          v-else 
          color="grey" 
          text-color="white" 
          small
        >
          <v-icon left small>mdi-close</v-icon>
          Doctor Ausente
        </v-chip>
        
        <v-chip 
          v-if="distance !== null" 
          color="info" 
          text-color="white" 
          small 
          class="ml-2"
        >
          <v-icon left small>mdi-ruler</v-icon>
          {{ distance }} km
        </v-chip>
      </div>

      <!-- Action buttons -->
      <div class="d-flex justify-space-between">
        <v-btn 
          @click="viewOnMap" 
          color="primary" 
          size="small"
          :disabled="!hasCoordinates"
        >
          <v-icon left>mdi-map</v-icon>
          Ver en Mapa
        </v-btn>
        
        <v-btn 
          @click="getDirections" 
          color="secondary" 
          size="small"
          :disabled="!canGetDirections"
        >
          <v-icon left>mdi-directions</v-icon>
          Cómo Llegar
        </v-btn>
      </div>
    </v-card-text>

    <!-- Status badge -->
    <v-badge
      :content="isActive ? 'ACTIVA' : 'INACTIVA'"
      :color="isActive ? 'green' : 'grey'"
      overlap
      location="bottom right"
    >
      <v-img
        height="150px"
        src="https://images.unsplash.com/photo-1569163139394-de4e4f7bf085?auto=format&fit=crop&w=400"
        cover
      ></v-img>
    </v-badge>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Oficina } from '@/types/location';

// Define props
interface Props {
  office: Oficina;
  isActive?: boolean;
  isDoctorPresent?: boolean;
  distance?: number | null;
  currentLocation?: {
    lat: number;
    lng: number;
  } | null;
}

const props = withDefaults(defineProps<Props>(), {
  isActive: false,
  isDoctorPresent: false,
  distance: null,
  currentLocation: null
});

// Computed properties
const hasCoordinates = computed(() => {
  return props.office.lat !== undefined && 
         props.office.lng !== undefined &&
         props.office.lat !== null && 
         props.office.lng !== null;
});

const canGetDirections = computed(() => {
  return hasCoordinates.value && 
         props.currentLocation !== null && 
         props.currentLocation !== undefined &&
         props.currentLocation.lat !== undefined &&
         props.currentLocation.lng !== undefined;
});

// Methods
const formatCoordinates = (lat: number, lng: number) => {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
};

const viewOnMap = () => {
  if (!hasCoordinates.value) return;
  
  // Open in Google Maps
  const url = `https://www.google.com/maps/search/?api=1&query=${props.office.lat},${props.office.lng}`;
  window.open(url, '_blank');
};

const getDirections = () => {
  if (!canGetDirections.value) return;
  
  // Open directions in Google Maps
  const url = `https://www.google.com/maps/dir/?api=1&origin=${props.currentLocation!.lat},${props.currentLocation!.lng}&destination=${props.office.lat},${props.office.lng}&travelmode=driving`;
  window.open(url, '_blank');
};

// Emit events
const emit = defineEmits<{
  'view-on-map': [office: Oficina];
  'get-directions': [office: Oficina];
}>();

// Additional methods to emit events
const viewOnMapWithEvent = () => {
  viewOnMap();
  emit('view-on-map', props.office);
};

const getDirectionsWithEvent = () => {
  getDirections();
  emit('get-directions', props.office);
};
</script>

<style scoped>
.location-card {
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.location-card.active-location {
  border-color: #4CAF50;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.location-info {
  border-left: 3px solid #e0e0e0;
  padding-left: 12px;
}

.doctor-presence {
  min-height: 32px;
}
</style>