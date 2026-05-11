<template>
  <div class="teleconsulta-dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <h1 class="dashboard-title">
        <i class="mdi mdi-chart-timeline-variant"></i>
        Dashboard de Teleconsulta
      </h1>
      <div class="dashboard-actions">
        <button
          class="btn btn-outline"
          @click="refreshAll"
          :disabled="isLoading"
          title="Refresh metrics"
        >
          <i :class="['mdi', isLoading ? 'mdi-loading' : 'mdi-refresh', { 'mdi-spin': isLoading }]"></i>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading && !aggregatedMetrics" class="loading-container">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
      <p>Cargando métricas...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <v-alert type="error" variant="tonal">
        <strong>Error:</strong> {{ error }}
      </v-alert>
      <button class="btn btn-primary" @click="refreshAll">
        <i class="mdi mdi-refresh"></i>
        Reintentar
      </button>
    </div>

    <!-- Dashboard Content -->
    <div v-else class="dashboard-content">
      <!-- Overview Cards -->
      <div class="metrics-grid">
        <!-- Active Connections -->
        <div class="metric-card">
          <div class="metric-icon" :style="{ backgroundColor: getHealthColor(healthStatus) + '20' }">
            <i class="mdi mdi-wifi" :style="{ color: getHealthColor(healthStatus) }"></i>
          </div>
          <div class="metric-info">
            <div class="metric-label">Conexiones Activas</div>
            <div class="metric-value">{{ sseStatus?.activeConnections || 0 }}</div>
            <div class="metric-subtext">
              <span :style="{ color: getHealthColor(healthStatus) }">
                {{ healthStatus === 'healthy' ? '✓ Saludables' : '⚠ Problemas' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Average Latency -->
        <div class="metric-card">
          <div class="metric-icon" :style="{ backgroundColor: getLatencyColor(aggregatedMetrics?.avgLatency || 0) + '20' }">
            <i class="mdi mdi-timer-outline" :style="{ color: getLatencyColor(aggregatedMetrics?.avgLatency || 0) }"></i>
          </div>
          <div class="metric-info">
            <div class="metric-label">Latencia Promedio</div>
            <div class="metric-value">{{ formatLatency(aggregatedMetrics?.avgLatency || 0) }}</div>
            <div class="metric-subtext">
              <span :style="{ color: getLatencyColor(aggregatedMetrics?.avgLatency || 0) }">
                {{ getLatencyLabel(aggregatedMetrics?.avgLatency || 0) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Average Jitter -->
        <div class="metric-card">
          <div class="metric-icon" :style="{ backgroundColor: getJitterColor(aggregatedMetrics?.avgJitter || 0) + '20' }">
            <i class="mdi mdi-waveform" :style="{ color: getJitterColor(aggregatedMetrics?.avgJitter || 0) }"></i>
          </div>
          <div class="metric-info">
            <div class="metric-label">Jitter Promedio</div>
            <div class="metric-value">{{ formatLatency(aggregatedMetrics?.avgJitter || 0) }}</div>
            <div class="metric-subtext">
              <span :style="{ color: getJitterColor(aggregatedMetrics?.avgJitter || 0) }">
                {{ getJitterLabel(aggregatedMetrics?.avgJitter || 0) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Total Sessions -->
        <div class="metric-card">
          <div class="metric-icon" style="background-color: #3b82f620">
            <i class="mdi mdi-video-box" style="color: #3b82f6"></i>
          </div>
          <div class="metric-info">
            <div class="metric-label">Sesiones Totales</div>
            <div class="metric-value">{{ aggregatedMetrics?.totalSessions || 0 }}</div>
            <div class="metric-subtext">
              Duración: {{ formatDuration(aggregatedMetrics?.avgDuration || 0) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Connection Quality Distribution -->
      <div class="dashboard-section">
        <h2 class="section-title">Calidad de Conexión</h2>
        <div class="quality-distribution">
          <div
            v-for="(count, quality) in aggregatedMetrics?.connectionQualityDistribution"
            :key="quality"
            class="quality-item"
          >
            <div class="quality-header">
              <span class="quality-label">{{ getQualityLabel(quality) }}</span>
              <span class="quality-count">{{ count }}</span>
            </div>
            <v-progress-linear
              :model-value="getQualityPercentage(quality)"
              :color="getQualityColor(quality)"
              height="8"
              rounded
            ></v-progress-linear>
          </div>
        </div>
      </div>

      <!-- SSE Status -->
      <div class="dashboard-section">
        <h2 class="section-title">
          <i class="mdi mdi-server-network"></i>
          Estado de Conexiones SSE
        </h2>
        <div class="sse-status-grid">
          <div class="status-card healthy">
            <div class="status-value">{{ sseStatus?.healthyConnections || 0 }}</div>
            <div class="status-label">Conexiones Saludables</div>
          </div>
          <div class="status-card silent-disconnect">
            <div class="status-value">{{ sseStatus?.silentDisconnections || 0 }}</div>
            <div class="status-label">Desconexiones Silenciosas</div>
          </div>
          <div class="status-card total">
            <div class="status-value">{{ sseStatus?.activeConnections || 0 }}</div>
            <div class="status-label">Total Conexiones</div>
          </div>
        </div>
      </div>

      <!-- Recent Sessions Table -->
      <div class="dashboard-section">
        <h2 class="section-title">
          <i class="mdi mdi-history"></i>
          Sesiones Recientes
        </h2>
        <div class="sessions-table-container">
          <table class="sessions-table">
            <thead>
              <tr>
                <th>Cita ID</th>
                <th>Doctor</th>
                <th>Paciente</th>
                <th>Duración</th>
                <th>Latencia</th>
                <th>Jitter</th>
                <th>Reconexiones</th>
                <th>Calidad</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="session in sessions"
                :key="session.citaId"
                :class="['session-row', { 'active-session': !session.endTime }]"
              >
                <td class="cell-id">{{ formatCitaId(session.citaId) }}</td>
                <td class="cell-doctor">{{ formatUserId(session.doctorId) }}</td>
                <td class="cell-patient">{{ formatUserId(session.pacienteId) }}</td>
                <td class="cell-duration">{{ formatDuration(session.duration) }}</td>
                <td class="cell-latency">
                  <span :style="{ color: getLatencyColor(calculateAvg(session.latencySamples)) }">
                    {{ formatLatency(calculateAvg(session.latencySamples)) }}
                  </span>
                </td>
                <td class="cell-jitter">
                  <span :style="{ color: getJitterColor(calculateAvg(session.jitterSamples)) }">
                    {{ formatLatency(calculateAvg(session.jitterSamples)) }}
                  </span>
                </td>
                <td class="cell-reconnections">
                  <span :class="['reconnection-badge', { 'high-reconnections': session.reconnectionCount > 5 }]">
                    {{ session.reconnectionCount }}
                  </span>
                </td>
                <td class="cell-quality">
                  <span
                    class="quality-badge"
                    :style="{ backgroundColor: getQualityColor(session.connectionQuality) + '20', color: getQualityColor(session.connectionQuality) }"
                  >
                    {{ getQualityLabel(session.connectionQuality) }}
                  </span>
                </td>
                <td class="cell-status">
                  <span :class="['status-badge', session.endTime ? 'completed' : 'active']">
                    <i :class="['mdi', session.endTime ? 'mdi-check-circle' : 'mdi-circle']"></i>
                    {{ session.endTime ? 'Completada' : 'En Curso' }}
                  </span>
                </td>
              </tr>
              <tr v-if="sessions.length === 0">
                <td colspan="9" class="empty-state">No hay sesiones registradas</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Alerts and Recommendations -->
      <div class="dashboard-section" v-if="hasAlerts">
        <h2 class="section-title">
          <i class="mdi mdi-alert-circle"></i>
          Alertas y Recomendaciones
        </h2>
        <div class="alerts-container">
          <v-alert
            v-if="hasHighLatency"
            type="warning"
            variant="tonal"
            class="alert-item"
          >
            <template v-slot:title>
              <strong>⚠ Latencia Elevada Detectada</strong>
            </template>
            <div>
              La latencia promedio ({{ formatLatency(aggregatedMetrics?.avgLatency || 0) }}) supera el umbral recomendado.
              Considere verificar la conexión de red de los usuarios.
            </div>
          </v-alert>

          <v-alert
            v-if="hasHighJitter"
            type="warning"
            variant="tonal"
            class="alert-item"
          >
            <template v-slot:title>
              <strong>⚠ Jitter Elevado Detectado</strong>
            </template>
            <div>
              El jitter promedio ({{ formatLatency(aggregatedMetrics?.avgJitter || 0) }}) indica inestabilidad en la conexión.
              Esto puede causar problemas de audio/video.
            </div>
          </v-alert>

          <v-alert
            v-if="hasSilentDisconnections"
            type="error"
            variant="tonal"
            class="alert-item"
          >
            <template v-slot:title>
              <strong>🔴 Desconexiones Silenciosas Detectadas</strong>
            </template>
            <div>
              Se detectaron {{ sseStatus?.silentDisconnections || 0 }} conexiones silenciosas.
              Revise los logs del servidor para identificar la causa raíz.
            </div>
          </v-alert>

          <v-alert
            v-if="hasHighReconnections"
            type="error"
            variant="tonal"
            class="alert-item"
          >
            <template v-slot:title>
              <strong>🔴 Múltiples Reconexiones Detectadas</strong>
            </template>
            <div>
              Algunas sesiones tienen más de 5 reconexiones por minuto.
              Esto indica inestabilidad en las conexiones SSE.
            </div>
          </v-alert>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useTeleconsultaMetrics, type TeleconsultaSession } from '@/composables/useTeleconsultaMetrics';

// Use composable
const {
  aggregatedMetrics,
  sessions,
  sseStatus,
  isLoading,
  error,
  refreshAll,
  formatDuration,
  formatLatency,
  getQualityColor,
  getHealthColor
} = useTeleconsultaMetrics();

// Helper functions
const getQualityLabel = (quality: string): string => {
  const labels: Record<string, string> = {
    excellent: 'Excelente',
    good: 'Buena',
    poor: 'Pobre',
    critical: 'Crítica'
  };
  return labels[quality] || quality;
};

const getQualityPercentage = (quality: string): number => {
  if (!aggregatedMetrics.value) return 0;
  
  const { connectionQualityDistribution } = aggregatedMetrics.value;
  const total = Object.values(connectionQualityDistribution).reduce((sum, val) => sum + val, 0);
  
  if (total === 0) return 0;
  
  return ((connectionQualityDistribution[quality] || 0) / total) * 100;
};

const getLatencyColor = (latency: number): string => {
  if (latency < 200) return '#22c55e'; // green
  if (latency < 500) return '#84cc16'; // lime
  if (latency < 1000) return '#f59e0b'; // amber
  return '#ef4444'; // red
};

const getLatencyLabel = (latency: number): string => {
  if (latency < 200) return 'Óptimo';
  if (latency < 500) return 'Aceptable';
  if (latency < 1000) return 'Elevado';
  return 'Crítico';
};

const getJitterColor = (jitter: number): string => {
  if (jitter < 50) return '#22c55e'; // green
  if (jitter < 100) return '#84cc16'; // lime
  if (jitter < 300) return '#f59e0b'; // amber
  return '#ef4444'; // red
};

const getJitterLabel = (jitter: number): string => {
  if (jitter < 50) return 'Estable';
  if (jitter < 100) return 'Moderado';
  if (jitter < 300) return 'Inestable';
  return 'Crítico';
};

const calculateAvg = (samples: number[]): number => {
  if (!samples || samples.length === 0) return 0;
  return samples.reduce((sum, val) => sum + val, 0) / samples.length;
};

const formatCitaId = (citaId: string): string => {
  return citaId.substring(0, 8) + '...';
};

const formatUserId = (userId: string): string => {
  return userId.substring(0, 8) + '...';
};

// Computed alerts
const hasAlerts = computed(() => {
  return hasHighLatency.value || hasHighJitter.value || hasSilentDisconnections.value || hasHighReconnections.value;
});

const hasHighLatency = computed(() => {
  return (aggregatedMetrics.value?.avgLatency || 0) > 500;
});

const hasHighJitter = computed(() => {
  return (aggregatedMetrics.value?.avgJitter || 0) > 100;
});

const hasSilentDisconnections = computed(() => {
  return (sseStatus.value?.silentDisconnections || 0) > 0;
});

const hasHighReconnections = computed(() => {
  return sessions.value.some(s => s.reconnectionCount > 5);
});

// Lifecycle
onMounted(() => {
  refreshAll();
});
</script>

<style scoped>
.teleconsulta-dashboard {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.dashboard-title {
  font-size: 28px;
  font-weight: 600;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 12px;
}

.dashboard-title i {
  font-size: 32px;
  color: #3b82f6;
}

.dashboard-actions .btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.dashboard-actions .btn-outline {
  background: white;
  border: 1px solid #e5e7eb;
  color: #6b7280;
}

.dashboard-actions .btn-outline:hover {
  background: #f9fafb;
  border-color: #3b82f6;
  color: #3b82f6;
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px;
  gap: 16px;
}

.loading-container p {
  color: #6b7280;
  font-size: 16px;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.metric-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  gap: 16px;
  align-items: flex-start;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.metric-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.metric-icon i {
  font-size: 24px;
}

.metric-info {
  flex: 1;
}

.metric-label {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 4px;
}

.metric-subtext {
  font-size: 13px;
  color: #9ca3af;
}

.dashboard-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title i {
  color: #3b82f6;
}

.quality-distribution {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.quality-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quality-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.quality-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.quality-count {
  font-size: 14px;
  color: #6b7280;
}

.sse-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.status-card {
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}

.status-card.healthy {
  background: #dcfce7;
}

.status-card.silent-disconnect {
  background: #fee2e2;
}

.status-card.total {
  background: #dbeafe;
}

.status-value {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 4px;
}

.status-card.healthy .status-value {
  color: #16a34a;
}

.status-card.silent-disconnect .status-value {
  color: #dc2626;
}

.status-card.total .status-value {
  color: #2563eb;
}

.status-label {
  font-size: 14px;
  color: #6b7280;
}

.sessions-table-container {
  overflow-x: auto;
}

.sessions-table {
  width: 100%;
  border-collapse: collapse;
}

.sessions-table th {
  text-align: left;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  border-bottom: 1px solid #e5e7eb;
}

.sessions-table td {
  padding: 12px 16px;
  font-size: 14px;
  border-bottom: 1px solid #f3f4f6;
}

.sessions-table tr:hover {
  background: #f9fafb;
}

.sessions-table tr.active-session {
  background: #eff6ff;
}

.cell-id {
  font-family: 'Courier New', monospace;
  color: #6b7280;
}

.cell-latency,
.cell-jitter {
  font-weight: 500;
}

.reconnection-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  background: #f3f4f6;
  color: #374151;
}

.reconnection-badge.high-reconnections {
  background: #fee2e2;
  color: #dc2626;
}

.quality-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
}

.status-badge.active {
  background: #dbeafe;
  color: #2563eb;
}

.status-badge.completed {
  background: #dcfce7;
  color: #16a34a;
}

.empty-state {
  text-align: center;
  color: #9ca3af;
  padding: 32px !important;
}

.alerts-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.alert-item {
  margin-bottom: 0;
}

@media (max-width: 768px) {
  .teleconsulta-dashboard {
    padding: 16px;
  }

  .dashboard-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .sse-status-grid {
    grid-template-columns: 1fr;
  }

  .sessions-table {
    font-size: 12px;
  }

  .sessions-table th,
  .sessions-table td {
    padding: 8px;
  }
}
</style>
