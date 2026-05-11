<template>
  <v-container fluid class="fill-height pa-0">
    <!-- Toolbar -->
    <v-app-bar density="compact" elevation="2">
      <v-app-bar-title>Mapa de Doctores Cercanos</v-app-bar-title>
      <v-btn
        icon="mdi-crosshairs-gps"
        @click="centerOnUser"
        title="Centrar en mi ubicación"
      />
      <v-btn
        icon="mdi-refresh"
        @click="refreshDoctors"
        :loading="loading"
        title="Actualizar doctores"
      />
    </v-app-bar>

    <!-- Main Content -->
    <div class="map-container" ref="mapContainer">
      <div ref="mapElement" class="map-element"></div>

      <!-- Loading Overlay -->
      <v-overlay
        v-model="loading"
        class="align-center justify-center"
        contained
      >
        <v-card
          class="pa-4"
          elevation="8"
          rounded="lg"
        >
          <v-progress-circular
            indeterminate
            color="primary"
            size="64"
          />
          <div class="mt-4 text-center">
            {{ loadingMessage }}
          </div>
        </v-card>
      </v-overlay>

      <!-- Info Panel -->
      <v-card
        class="info-panel"
        elevation="4"
        rounded="lg"
      >
        <v-card-title class="text-subtitle-1 pa-3">
          <v-icon start color="primary">mdi-information</v-icon>
          Doctores Cercanos
        </v-card-title>
        <v-card-text class="pa-3 pt-0">
          <div v-if="nearbyDoctors.length > 0" class="doctor-list">
            <div
              v-for="(doctor, index) in nearbyDoctors"
              :key="doctor.doctorId"
              class="doctor-item mb-2"
              @click="focusDoctor(doctor)"
            >
              <div class="d-flex align-center">
                <v-avatar
                  :color="getSpecialtyColor(doctor.especialidad)"
                  size="32"
                  class="mr-2"
                >
                  <v-icon size="20">mdi-account-md</v-icon>
                </v-avatar>
                <div class="flex-grow-1">
                  <div class="text-subtitle-2 font-weight-medium">
                    {{ doctor.doctorName }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ doctor.especialidad }} • {{ formatDistance(doctor.distanciaKm) }}
                  </div>
                </div>
                <v-chip
                  size="x-small"
                  :color="getDistanceColor(doctor.distanciaKm)"
                  class="ml-2"
                >
                  {{ index + 1 }}
                </v-chip>
              </div>
            </div>
          </div>
          <div v-else class="text-center text-medium-emphasis py-4">
            <v-icon size="48" class="mb-2">mdi-map-marker-off</v-icon>
            <div>No se encontraron doctores cercanos</div>
            <div class="text-caption mt-1">
              Ajusta el radio de búsqueda o tu ubicación
            </div>
          </div>
        </v-card-text>
      </v-card>

      <!-- Search Controls -->
      <v-card
        class="search-controls"
        elevation="4"
        rounded="lg"
      >
        <v-card-text class="pa-3">
          <v-row dense>
            <v-col cols="12">
              <v-text-field
                v-model="searchRadius"
                label="Radio de búsqueda (km)"
                type="number"
                density="compact"
                hide-details
                :min="1"
                :max="100"
                @change="refreshDoctors"
              />
            </v-col>
            <v-col cols="12">
              <v-select
                v-model="selectedSpecialty"
                label="Especialidad"
                :items="specialties"
                density="compact"
                clearable
                hide-details
                @update:model-value="refreshDoctors"
              />
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </div>

    <!-- Error Alert -->
    <v-snackbar
      v-model="showError"
      color="error"
      timeout="5000"
      location="top"
    >
      {{ errorMessage }}
      <template v-slot:actions>
        <v-btn
          variant="text"
          @click="showError = false"
        >
          Cerrar
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useGPS } from '@/composables/useGPS';
import { useLocationStore } from '@/stores/location';
import { apiClient } from '@/services/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Icons fix for Leaflet in Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// State
const mapContainer = ref<HTMLDivElement | null>(null);
const mapElement = ref<HTMLDivElement | null>(null);
const loading = ref(false);
const loadingMessage = ref('Obteniendo ubicación...');
const showError = ref(false);
const errorMessage = ref('');
const nearbyDoctors = ref<Array<{
  doctorId: string;
  doctorName: string;
  especialidad: string;
  oficinaName: string;
  distanciaKm: number;
  ubicacion: { lat: number; lng: number };
}>>([]);
const searchRadius = ref(10);
const selectedSpecialty = ref<string | null>(null);
const specialties = ref<string[]>([]);

// Map and markers
let map: L.Map | null = null;
const markersRef = ref<Map<string, L.Marker>>(new Map());
const userMarker = ref<L.Marker | null>(null);
const userCircle = ref<L.Circle | null>(null);

// Composables
const gps = useGPS();
const locationStore = useLocationStore();

// Methods
const showErrorAlert = (message: string) => {
  errorMessage.value = message;
  showError.value = true;
};

const initializeMap = () => {
  if (!mapElement.value) return;

  // Initialize map with default center (Quito, Ecuador)
  map = L.map(mapElement.value, {
    zoomControl: false,
    attributionControl: true
  }).setView([-0.180653, -78.467838], 13);

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  // Add zoom control to top-right
  L.control.zoom({
    position: 'topright'
  }).addTo(map);
};

const addUserMarker = (lat: number, lng: number) => {
  if (!map) return;

  // Remove existing user marker
  if (userMarker.value) {
    map.removeLayer(userMarker.value as any);
  }
  if (userCircle.value) {
    map.removeLayer(userCircle.value as any);
  }

  // Add user location marker
  userMarker.value = L.marker([lat, lng], {
    icon: L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    })
  }).addTo(map).bindPopup('Tu ubicación');

  // Add accuracy circle
  userCircle.value = L.circle([lat, lng], {
    radius: 100,
    color: '#2196F3',
    fillColor: '#2196F3',
    fillOpacity: 0.2,
    weight: 1
  }).addTo(map);
};

const addDoctorMarkers = () => {
  if (!map) return;

  // Clear existing markers
  markersRef.value.forEach((marker) => {
    map!.removeLayer(marker as any);
  });
  markersRef.value.clear();

  // Add doctor markers
  nearbyDoctors.value.forEach((doctor) => {
    const marker = L.marker([doctor.ubicacion.lat, doctor.ubicacion.lng], {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    });
    
    if (map) {
      marker.addTo(map);
    }

    marker.bindPopup(`
      <div class="text-center">
        <strong>${doctor.doctorName}</strong><br>
        ${doctor.especialidad}<br>
        ${doctor.oficinaName}<br>
        <small>${formatDistance(doctor.distanciaKm)}</small>
      </div>
    `);

    markersRef.value.set(doctor.doctorId, marker);
  });
};

const centerOnUser = () => {
  if (!map || !gps.currentPosition) return;
  map.setView([gps.currentPosition.lat, gps.currentPosition.lng], 15);
};

const focusDoctor = (doctor: typeof nearbyDoctors.value[0]) => {
  if (!map) return;
  map.setView([doctor.ubicacion.lat, doctor.ubicacion.lng], 16);
  
  const marker = markersRef.value.get(doctor.doctorId);
  if (marker) {
    marker.openPopup();
  }
};

const formatDistance = (km: number): string => {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
};

const getSpecialtyColor = (specialty: string): string => {
  const colors: Record<string, string> = {
    'Medicina General': 'blue',
    'Pediatría': 'green',
    'Ginecología': 'pink',
    'Cardiología': 'red',
    'Dermatología': 'purple',
    'Odontología': 'cyan'
  };
  return colors[specialty] || 'grey';
};

const getDistanceColor = (km: number): string => {
  if (km < 1) return 'success';
  if (km < 5) return 'warning';
  return 'error';
};

const loadSpecialties = async () => {
  try {
    const response = await apiClient.get('/specialties');
    if (response.success && response.data) {
      specialties.value = (response.data as any[]).map((s) => s.nombre);
    }
  } catch (error) {
    console.error('Error loading specialties:', error);
  }
};

const refreshDoctors = async () => {
  if (!gps.currentPosition) {
    showErrorAlert('No se pudo obtener tu ubicación. Por favor verifica los permisos.');
    return;
  }

  loading.value = true;
  loadingMessage.value = 'Buscando doctores cercanos...';

  try {
    const response = await apiClient.post('/location/nearby-doctors', {
      patientLat: gps.currentPosition.lat,
      patientLng: gps.currentPosition.lng,
      radiusKm: searchRadius.value,
      especialidad: selectedSpecialty.value || undefined
    });

    if (response.success && response.data) {
      nearbyDoctors.value = response.data as typeof nearbyDoctors.value;
      addDoctorMarkers();
      
      // Fit map to show all markers
      if (nearbyDoctors.value.length > 0 && map) {
        const group = L.featureGroup([
          userMarker.value as any,
          ...Array.from(markersRef.value.values() as any)
        ]);
        map.fitBounds(group.getBounds().pad(0.1));
      }
    } else {
      showErrorAlert(response.error || 'Error al buscar doctores');
    }
  } catch (error: any) {
    showErrorAlert(error.message || 'Error de conexión con el servidor');
  } finally {
    loading.value = false;
  }
};

const initializeGPS = async () => {
  loading.value = true;
  loadingMessage.value = 'Obteniendo tu ubicación...';

  try {
    const position = await gps.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    });

    // Update store
    locationStore.setCurrentPosition(position);
    locationStore.setLastUpdateTime(new Date());

    // Center map on user
    if (map) {
      map.setView([position.lat, position.lng], 14);
      addUserMarker(position.lat, position.lng);
    }

    // Load doctors
    await refreshDoctors();
  } catch (error: any) {
    console.error('GPS Error:', error);
    showErrorAlert(error.message || 'No se pudo obtener tu ubicación');
    
    // Use default location (Quito)
    if (map) {
      map.setView([-0.180653, -78.467838], 13);
    }
  } finally {
    loading.value = false;
  }
};

// Lifecycle
onMounted(() => {
  initializeMap();
  loadSpecialties();
  initializeGPS();
});

onUnmounted(() => {
  if (map) {
    map.remove();
    map = null;
  }
});
</script>

<style scoped lang="scss">
.fill-height {
  height: 100vh;
}

.map-container {
  position: relative;
  width: 100%;
  height: calc(100vh - 64px); // Subtract app-bar height
}

.map-element {
  width: 100%;
  height: 100%;
}

.info-panel {
  position: absolute;
  top: 16px;
  left: 16px;
  max-width: 320px;
  max-height: calc(100vh - 128px);
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  z-index: 1000;

  @media (max-width: 600px) {
    max-width: calc(100% - 32px);
    bottom: 16px;
    max-height: 40vh;
  }
}

.search-controls {
  position: absolute;
  bottom: 16px;
  right: 16px;
  width: 280px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  z-index: 1000;

  @media (max-width: 600px) {
    width: calc(100% - 32px);
    left: 16px;
    bottom: auto;
    top: 80px;
  }
}

.doctor-item {
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(33, 150, 243, 0.08);
  }
}

:deep(.leaflet-popup-content-wrapper) {
  border-radius: 8px;
  padding: 0;
}

:deep(.leaflet-popup-content) {
  margin: 12px;
  line-height: 1.5;
}
</style>
