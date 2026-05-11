<!-- apps/web/src/components/hub/widgets/StatsWidget.vue -->
<template>
  <div class="stats-widget">
    <div class="widget-header">
      <h4 class="text-subtitle-1 font-weight-bold">Estadísticas del Mes</h4>
    </div>

    <v-row dense>
      <v-col cols="6">
        <v-card variant="tonal" color="primary" class="stat-card">
          <v-card-text class="text-center">
            <v-icon size="32" class="mb-2">mdi-calendar-check</v-icon>
            <div class="text-h4 font-weight-bold">124</div>
            <div class="text-caption">Citas</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="6">
        <v-card variant="tonal" color="success" class="stat-card">
          <v-card-text class="text-center">
            <v-icon size="32" class="mb-2">mdi-account-group</v-icon>
            <div class="text-h4 font-weight-bold">89</div>
            <div class="text-caption">Pacientes</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="6">
        <v-card variant="tonal" color="warning" class="stat-card">
          <v-card-text class="text-center">
            <v-icon size="32" class="mb-2">mdi-file-document</v-icon>
            <div class="text-h4 font-weight-bold">156</div>
            <div class="text-caption">Consultas</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="6">
        <v-card variant="tonal" color="secondary" class="stat-card">
          <v-card-text class="text-center">
            <v-icon size="32" class="mb-2">mdi-star</v-icon>
            <div class="text-h4 font-weight-bold">4.8</div>
            <div class="text-caption">Rating</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped lang="scss">
.stats-widget {
  .widget-header {
    margin-bottom: 12px;
  }

  .stat-card {
    transition: all 0.3s ease;
    
    &:hover {
      transform: translateY(-4px);
    }
  }
}
</style>
