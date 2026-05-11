<!-- apps/web/src/components/schedule/LocationSelector.vue -->
<template>
  <div class="location-selector">
    <v-card class="pa-4">
      <v-card-title class="headline">
        Selección de Oficina
        <v-spacer />
        <v-switch
          v-model="locationConsent"
          label="Compartir mi ubicación"
          color="primary"
          @change="handleConsentChange"
          :disabled="!gps.isSupported"
        />
      </v-card-title>

      <v-card-subtitle v-if="!gps.isSupported" class="red--text">
        La geolocalización no es compatible con este navegador.
      </v-card-subtitle>

      <v-card-text>
        <!-- Error display -->
        <v-alert
          v-if="gps.error"
          type="error"
          dismissible
          @input="gps.error = null"
        >
          {{ gps.error }}
        </v-alert>

        <!-- Current position info -->
        <div v-if="gps.currentPosition" class="mb-4">
          <v-chip color="green" text-color="white" small>
            <v-icon left>mdi-map-marker</v-icon>
            Ubicación actual: {{ formatCoordinates(gps.currentPosition) }}
          </v-chip>
          <v-chip v-if="store.getLocationAge && store.getLocationAge < 300000" color="blue" text-color="white" small class="ml-2">
            <v-icon left>mdi-clock</v-icon>
            Actualizado hace {{ formatTimeAgo(store.getLocationAge) }}
          </v-chip>
        </div>

        <!-- Office selection -->
        <v-list three-line>
          <template v-for="office in offices" :key="office.id">
            <v-list-item @click="selectOffice(office)">
              <template v-slot:prepend>
                <v-avatar color="primary" size="40">
                  <v-icon color="white">mdi-domain</v-icon>
                </v-avatar>
              </template>
              
              <v-list-item-content>
                <v-list-item-title>{{ office.nombre }}</v-list-item-title>
                <v-list-item-subtitle>{{ office.direccion }}</v-list-item-subtitle>
                
                <div class="mt-2">
                  <!-- Show if doctor is present in this office -->
                  <v-chip 
                    v-if="isDoctorPresent(office.id)" 
                    color="green" 
                    text-color="white" 
                    small
                    class="mr-2"
                  >
                    <v-icon left small>mdi-check</v-icon>
                    Doctor Presente
                  </v-chip>
                  
                  <!-- Show distance if available -->
                  <v-chip 
                    v-if="getDoctorDistance(office.id)" 
                    color="info" 
                    text-color="white" 
                    small
                  >
                    <v-icon left small>mdi-ruler</v-icon>
                    {{ getDoctorDistance(office.id) }} km
                  </v-chip>
                </div>
              </v-list-item-content>
              
              <v-list-item-action>
                <v-btn 
                  icon 
                  @click.stop="showDirections(office)"
                  :disabled="!selectedOffice"
                >
                  <v-icon>mdi-directions</v-icon>
                </v-btn>
              </v-list-item-action>
            </v-list-item>
            
            <v-divider :key="`divider-${office.id}`" />
          </template>
        </v-list>

        <!-- Action buttons -->
        <div class="d-flex justify-space-between mt-4">
          <v-btn 
            @click="startLocationTracking" 
            :disabled="!locationConsent || gps.isTracking"
            color="primary"
            :loading="requestingPermission"
          >
            <v-icon left>{{ gps.isTracking ? 'mdi-stop' : 'mdi-crosshairs-gps' }}</v-icon>
            {{ gps.isTracking ? 'Detener Seguimiento' : 'Iniciar Seguimiento' }}
          </v-btn>
          
          <v-btn 
            @click="showMap(selectedOffice)" 
            :disabled="!selectedOffice"
            color="secondary"
          >
            <v-icon left>mdi-map</v-icon>
            Ver en Mapa
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- Directions Dialog -->
    <v-dialog v-model="showDirectionsDialog" max-width="600px">
      <v-card>
        <v-card-title class="headline">Cómo llegar</v-card-title>
        <v-card-text>
          <div v-if="directions">
            <p><strong>Desde:</strong> {{ directions.origin }}</p>
            <p><strong>Hacia:</strong> {{ directions.destination }}</p>
            <p><strong>Distancia:</strong> {{ directions.distance }}</p>
            <p><strong>Tiempo estimado:</strong> {{ directions.duration }}</p>
            
            <div class="mt-4">
              <h4>Instrucciones:</h4>
              <ol>
                <li v-for="(step, index) in directions.steps" :key="index" class="mb-2">
                  {{ step.instruction }} <small>({{ step.distance }})</small>
                </li>
              </ol>
            </div>
          </div>
          <div v-else>
            <p>Calculando direcciones...</p>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="showDirectionsDialog = false">Cerrar</v-btn>
          <v-btn color="primary" @click="openMapsApp">Abrir en Maps</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useGPS } from '@/composables/useGPS';
import { useStore } from '@/stores/location';
import type { Position } from '@/composables/useGPS';
import type { Oficina } from '@/types/location';

// Props
interface Props {
  doctorId: string;
  initialOfficeId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  initialOfficeId: undefined
});

// State
const locationConsent = ref(false);
const requestingPermission = ref(false);
const selectedOffice = ref<Oficina | null>(null);
const offices = ref<Oficina[]>([]);
const showDirectionsDialog = ref(false);
const directions = ref<any>(null);

// Composables
const gps = useGPS();
const store = useStore();

// Computed properties
const isDoctorPresent = (officeId: string) => {
  const doctor = store.getTrackedDoctor(props.doctorId);
  return doctor && doctor.lastSeen && (Date.now() - doctor.lastSeen.getTime()) < 300000; // Last 5 minutes
};

const getDoctorDistance = (officeId: string) => {
  const doctor = store.getTrackedDoctor(props.doctorId);
  return doctor?.distance ? doctor.distance.toFixed(2) : null;
};

// Methods
const handleConsentChange = async () => {
  if (!locationConsent.value) {
    // Revoke consent and stop tracking
    gps.stopTracking();
    await revokeConsentOnServer();
  } else {
    // Ensure permission is granted
    try {
      requestingPermission.value = true;
      await gps.requestPermission();
    } catch (error) {
      console.error('Error requesting permission:', error);
      locationConsent.value = false;
    } finally {
      requestingPermission.value = false;
    }
  }
};

const startLocationTracking = async () => {
  if (gps.isTracking) {
    gps.stopTracking();
    return;
  }

  if (!selectedOffice.value) {
    alert('Por favor seleccione una oficina antes de iniciar el seguimiento.');
    return;
  }

  try {
    await gps.startTracking(
      props.doctorId,
      selectedOffice.value.id,
      (position: Position) => {
        // Callback when position updates
        console.log('Position updated:', position);
      }
    );
  } catch (error) {
    console.error('Error starting location tracking:', error);
  }
};

const selectOffice = (office: Oficina) => {
  selectedOffice.value = office;
  store.setActiveOffice(office.id);
};

const showDirections = async (office: Oficina) => {
  if (!gps.currentPosition) {
    alert('No se puede calcular direcciones sin acceso a su ubicación.');
    return;
  }

  showDirectionsDialog.value = true;
  
  // Simulate getting directions (in a real app, this would call a directions API)
  setTimeout(() => {
    directions.value = {
      origin: `${gps.currentPosition?.lat.toFixed(6)}, ${gps.currentPosition?.lng.toFixed(6)}`,
      destination: `${office.lat.toFixed(6)}, ${office.lng.toFixed(6)}`,
      distance: '2.5 km',
      duration: '8 mins',
      steps: [
        { instruction: 'Conducir hacia el norte en Av. Principal', distance: '500m' },
        { instruction: 'Girar a la derecha en Calle 12', distance: '300m' },
        { instruction: 'Continuar recto por 2km', distance: '2km' },
        { instruction: 'Llegada a destino', distance: '0m' }
      ]
    };
  }, 1000);
};

const showMap = (office: Oficina | null) => {
  if (!office) return;
  
  // In a real app, this would open a map view
  alert(`Mostrando ${office.nombre} en el mapa`);
};

const openMapsApp = () => {
  if (!selectedOffice.value || !gps.currentPosition) return;
  
  // Construct a Google Maps URL
  const url = `https://www.google.com/maps/dir/?api=1&origin=${gps.currentPosition.lat},${gps.currentPosition.lng}&destination=${selectedOffice.value.lat},${selectedOffice.value.lng}&travelmode=driving`;
  window.open(url, '_blank');
};

const formatCoordinates = (pos: Position) => {
  return `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
};

const formatTimeAgo = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
};

const revokeConsentOnServer = async () => {
  try {
    const response = await fetch('/api/location/consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        doctorId: props.doctorId,
        activated: false
      })
    });

    const result = await response.json();
    if (!result.success) {
      console.error('Error revoking consent on server:', result.error);
    }
  } catch (error) {
    console.error('Error revoking consent:', error);
  }
};

// Load offices on component mount
onMounted(async () => {
  try {
    // In a real app, this would fetch from the API
    // For now, we'll use mock data
    offices.value = [
      {
        id: '1',
        nombre: 'Consultorio Central',
        direccion: 'Av. Principal 123, Ciudad',
        lat: -33.4489,
        lng: -70.6693,
        telefono: '+56 2 12345678',
        indicaciones: 'Edificio principal, piso 3'
      },
      {
        id: '2',
        nombre: 'Sucursal Norte',
        direccion: 'Av. Norte 456, Ciudad',
        lat: -33.4369,
        lng: -70.6523,
        telefono: '+56 2 87654321',
        indicaciones: 'Centro comercial, local 15'
      },
      {
        id: '3',
        nombre: 'Sucursal Sur',
        direccion: 'Av. Sur 789, Ciudad',
        lat: -33.4609,
        lng: -70.6863,
        telefono: '+56 2 11223344',
        indicaciones: 'Edificio corporativo, entrada principal'
      }
    ];

    // Set initial office if provided
    if (props.initialOfficeId) {
      const initialOffice = offices.value.find(office => office.id === props.initialOfficeId);
      if (initialOffice) {
        selectOffice(initialOffice);
      }
    }

    // Check if user has previously given consent
    // In a real app, this would check the store or make an API call
    locationConsent.value = store.consentGiven;
  } catch (error) {
    console.error('Error loading offices:', error);
  }
});
</script>

<style scoped>
.location-selector {
  max-width: 800px;
  margin: 0 auto;
}
</style>