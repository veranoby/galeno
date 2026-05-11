<!-- apps/web/src/components/hub/widgets/ConsultasWidget.vue -->
<template>
  <div class="consultas-widget">
    <div class="widget-header">
      <h4 class="text-subtitle-1 font-weight-bold">Consultas Recientes</h4>
      <v-btn icon size="small" variant="text" @click="handleRefresh" :loading="loading">
        <v-icon>mdi-refresh</v-icon>
      </v-btn>
    </div>

    <div v-if="loading" class="widget-loading">
      <v-progress-circular indeterminate size="24" />
    </div>

    <div v-else-if="error" class="widget-error">
      <v-icon size="48" color="error">mdi-alert-circle-outline</v-icon>
      <p class="text-caption text-error">{{ error }}</p>
      <v-btn size="small" variant="text" @click="handleRefresh">
        Reintentar
      </v-btn>
    </div>

    <div v-else-if="consultas.length === 0" class="widget-empty">
      <v-icon size="48" color="grey-lighten-2">mdi-file-document-outline</v-icon>
      <p class="text-caption text-grey">No hay consultas recientes</p>
    </div>

    <v-list v-else density="compact" class="bg-transparent">
      <v-list-item
        v-for="consulta in consultas"
        :key="consulta.id"
        class="mb-2"
        rounded="lg"
        variant="tonal"
      >
        <template v-slot:prepend>
          <v-avatar :color="getConsultaColor(consulta.estado)" size="40">
            <v-icon size="20" color="white">
              {{ getConsultaIcon(consulta.estado) }}
            </v-icon>
          </v-avatar>
        </template>

        <v-list-item-title class="font-weight-medium">
          {{ consulta.paciente.nombre }}
        </v-list-item-title>

        <v-list-item-subtitle>
          {{ fechaRelativa(consulta.createdAt) }}
          <v-chip v-if="consulta.esPrimeraVez" size="x-small" color="info" class="ml-2">
            1ra vez
          </v-chip>
        </v-list-item-subtitle>

        <template v-slot:append>
          <v-chip size="x-small" :color="getEstadoColor(consulta.estado)">
            {{ getEstadoLabel(consulta.estado) }}
          </v-chip>
        </template>
      </v-list-item>
    </v-list>

    <v-card-actions class="pt-0">
      <v-btn block variant="text" size="small" @click="$emit('view-all')">
        Ver todas las consultas
      </v-btn>
    </v-card-actions>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useConsultas } from '@/composables/useConsultas';
import type { EstadoConsulta } from '@galeno/shared-types';

defineEmits<{
  (e: 'refresh'): void;
  (e: 'view-all'): void;
}>();

const { consultas, loading, error, fetchConsultas } = useConsultas();

const fechaRelativa = (fecha: string | Date): string => {
  try {
    return formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es });
  } catch {
    return 'Fecha desconocida';
  }
};

const getConsultaColor = (estado: EstadoConsulta): string => {
  const colors: Record<string, string> = {
    borrador: 'grey',
    triaje: 'warning',
    pendiente: 'warning',
    en_atencion: 'primary',
    finalizada: 'success',
    interconsulta: 'info'
  };
  return colors[estado] || 'grey';
};

const getConsultaIcon = (estado: EstadoConsulta): string => {
  const icons: Record<string, string> = {
    borrador: 'mdi-file-outline',
    triaje: 'mdi-file-edit',
    pendiente: 'mdi-clock-outline',
    en_atencion: 'mdi-file-document-edit',
    finalizada: 'mdi-file-check',
    interconsulta: 'mdi-file-send'
  };
  return icons[estado] || 'mdi-file';
};

const getEstadoColor = (estado: EstadoConsulta): string => {
  return getConsultaColor(estado);
};

const getEstadoLabel = (estado: EstadoConsulta): string => {
  const labels: Record<string, string> = {
    borrador: 'Borrador',
    triaje: 'Triaje',
    pendiente: 'Pendiente',
    en_atencion: 'En atención',
    finalizada: 'Finalizada',
    interconsulta: 'Interconsulta'
  };
  return labels[estado] || estado;
};

const handleRefresh = () => {
  fetchConsultas({ limit: 5 });
};

onMounted(() => {
  fetchConsultas({ limit: 5 });
});
</script>

<style scoped lang="scss">
.consultas-widget {
  .widget-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .widget-loading,
  .widget-error,
  .widget-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;
    text-align: center;
    gap: 8px;
  }
}
</style>
