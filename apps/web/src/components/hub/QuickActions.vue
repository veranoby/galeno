<!-- apps/web/src/components/hub/QuickActions.vue -->
<template>
  <v-card class="quick-actions" variant="outlined" rounded="lg">
    <v-card-title class="text-h6 font-weight-bold pb-2">
      <v-icon start color="primary">mdi-lightning-bolt</v-icon>
      Acciones Rápidas
    </v-card-title>

    <v-card-text>
      <v-row dense>
        <!-- Nueva Cita -->
        <v-col cols="6" sm="4">
          <v-btn
            block
            variant="tonal"
            color="primary"
            class="action-btn"
            @click="$emit('action', 'new-appointment')"
          >
            <v-icon size="32" class="mb-2">mdi-calendar-plus</v-icon>
            <div class="action-label">Nueva Cita</div>
          </v-btn>
        </v-col>

        <!-- Nuevo Paciente -->
        <v-col cols="6" sm="4">
          <v-btn
            block
            variant="tonal"
            color="success"
            class="action-btn"
            @click="$emit('action', 'new-patient')"
          >
            <v-icon size="32" class="mb-2">mdi-account-plus</v-icon>
            <div class="action-label">Nuevo Paciente</div>
          </v-btn>
        </v-col>

        <!-- Nueva Consulta -->
        <v-col cols="6" sm="4">
          <v-btn
            block
            variant="tonal"
            color="warning"
            class="action-btn"
            @click="$emit('action', 'new-consulta')"
          >
            <v-icon size="32" class="mb-2">mdi-file-document-plus</v-icon>
            <div class="action-label">Nueva Consulta</div>
          </v-btn>
        </v-col>

        <!-- Interconsulta -->
        <v-col cols="6" sm="4">
          <v-btn
            block
            variant="tonal"
            color="info"
            class="action-btn"
            @click="$emit('action', 'new-interconsulta')"
          >
            <v-icon size="32" class="mb-2">mdi-account-arrow-right</v-icon>
            <div class="action-label">Interconsulta</div>
          </v-btn>
        </v-col>

        <!-- Receta -->
        <v-col cols="6" sm="4">
          <v-btn
            block
            variant="tonal"
            color="secondary"
            class="action-btn"
            @click="$emit('action', 'new-receta')"
          >
            <v-icon size="32" class="mb-2">mdi-pill</v-icon>
            <div class="action-label">Receta</div>
          </v-btn>
        </v-col>

        <!-- Examen -->
        <v-col cols="6" sm="4">
          <v-btn
            block
            variant="tonal"
            color="purple"
            class="action-btn"
            @click="$emit('action', 'new-examen')"
          >
            <v-icon size="32" class="mb-2">mdi-test-tube</v-icon>
            <div class="action-label">Examen</div>
          </v-btn>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
defineEmits<{
  (e: 'action', type: 'new-appointment' | 'new-patient' | 'new-consulta' | 'new-interconsulta' | 'new-receta' | 'new-examen'): void;
}>();
</script>

<style scoped lang="scss">
.quick-actions {
  .action-btn {
    height: 100%;
    min-height: 100px;
    flex-direction: column;
    padding: 16px 8px;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
    }

    .action-label {
      font-size: 0.75rem;
      font-weight: 500;
      text-align: center;
    }
  }
}
</style>
