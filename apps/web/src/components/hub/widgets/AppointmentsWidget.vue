<!-- apps/web/src/components/hub/widgets/AppointmentsWidget.vue -->
<template>
  <div class="appointments-widget">
    <div class="widget-header">
      <h4 class="text-subtitle-1 font-weight-bold">Próximas Citas</h4>
      <v-btn icon size="small" variant="text" @click="$emit('refresh')">
        <v-icon>mdi-refresh</v-icon>
      </v-btn>
    </div>

    <div v-if="loading" class="widget-loading">
      <v-progress-circular indeterminate size="24" />
    </div>

    <div v-else-if="appointments.length === 0" class="widget-empty">
      <v-icon size="48" color="grey-lighten-2">mdi-calendar-blank</v-icon>
      <p class="text-caption text-grey">No hay citas próximas</p>
    </div>

    <v-list v-else density="compact" class="bg-transparent">
      <v-list-item
        v-for="cita in appointments"
        :key="cita.id"
        class="mb-2"
        rounded="lg"
        variant="tonal"
      >
        <template v-slot:prepend>
          <v-avatar :color="getCitaColor(cita.estado)" size="40">
            <v-icon size="20" color="white">
              {{ getCitaIcon(cita.estado) }}
            </v-icon>
          </v-avatar>
        </template>

        <v-list-item-title class="font-weight-medium">
          {{ cita.pacienteNombre }}
        </v-list-item-title>

        <v-list-item-subtitle>
          {{ formatTime(cita.fechaHora) }}
          <v-chip v-if="cita.tipo === 'teleconsulta'" size="x-small" color="primary" class="ml-2">
            Video
          </v-chip>
        </v-list-item-subtitle>

        <template v-slot:append>
          <v-btn icon size="x-small" variant="text">
            <v-icon>mdi-dots-vertical</v-icon>
          </v-btn>
        </template>
      </v-list-item>
    </v-list>

    <v-card-actions class="pt-0">
      <v-btn block variant="text" size="small" @click="$emit('view-all')">
        Ver todas las citas
      </v-btn>
    </v-card-actions>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface Cita {
  id: string;
  pacienteId: string;
  pacienteNombre: string;
  fechaHora: string;
  tipo: 'presencial' | 'teleconsulta';
  estado: 'programada' | 'confirmada' | 'en_progreso' | 'completada' | 'cancelada';
}

defineEmits<{
  (e: 'refresh'): void;
  (e: 'view-all'): void;
}>();

const loading = ref(true);
const appointments = ref<Cita[]>([]);

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('es-EC', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getCitaColor = (estado: string): string => {
  const colors: Record<string, string> = {
    programada: 'primary',
    confirmada: 'success',
    en_progreso: 'warning',
    completada: 'grey',
    cancelada: 'error'
  };
  return colors[estado] || 'grey';
};

const getCitaIcon = (estado: string): string => {
  const icons: Record<string, string> = {
    programada: 'mdi-calendar',
    confirmada: 'mdi-check-circle',
    en_progreso: 'mdi-clock-outline',
    completada: 'mdi-check-circle-outline',
    cancelada: 'mdi-close-circle'
  };
  return icons[estado] || 'mdi-calendar';
};

onMounted(() => {
  // TODO: Load appointments from API
  appointments.value = [
    {
      id: '1',
      pacienteId: 'p1',
      pacienteNombre: 'Juan Pérez',
      fechaHora: new Date(Date.now() + 3600000).toISOString(),
      tipo: 'presencial',
      estado: 'confirmada'
    },
    {
      id: '2',
      pacienteId: 'p2',
      pacienteNombre: 'María López',
      fechaHora: new Date(Date.now() + 7200000).toISOString(),
      tipo: 'teleconsulta',
      estado: 'programada'
    }
  ];
  loading.value = false;
});
</script>

<style scoped lang="scss">
.appointments-widget {
  .widget-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .widget-loading,
  .widget-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;
    text-align: center;
  }
}
</style>
