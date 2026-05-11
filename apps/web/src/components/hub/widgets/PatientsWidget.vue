<!-- apps/web/src/components/hub/widgets/PatientsWidget.vue -->
<template>
  <div class="patients-widget">
    <div class="widget-header">
      <h4 class="text-subtitle-1 font-weight-bold">Pacientes Recientes</h4>
      <v-btn icon size="small" variant="text">
        <v-icon>mdi-magnify</v-icon>
      </v-btn>
    </div>

    <v-list density="compact" class="bg-transparent">
      <v-list-item
        v-for="paciente in patients"
        :key="paciente.id"
        class="mb-2"
        rounded="lg"
        variant="tonal"
      >
        <template v-slot:prepend>
          <v-avatar color="secondary" size="40">
            <v-icon size="20" color="white">mdi-account</v-icon>
          </v-avatar>
        </template>

        <v-list-item-title class="font-weight-medium">
          {{ paciente.nombre }}
        </v-list-item-title>

        <v-list-item-subtitle>
          {{ paciente.ultimaConsulta }}
        </v-list-item-subtitle>

        <template v-slot:append>
          <v-chip size="x-small" :color="paciente.estado === 'activo' ? 'success' : 'grey'">
            {{ paciente.estado }}
          </v-chip>
        </template>
      </v-list-item>
    </v-list>

    <v-card-actions class="pt-0">
      <v-btn block variant="text" size="small">
        Ver todos los pacientes
      </v-btn>
    </v-card-actions>
  </div>
</template>

<script setup lang="ts">
const patients = [
  {
    id: '1',
    nombre: 'Ana García',
    ultimaConsulta: 'Hace 2 días',
    estado: 'activo'
  },
  {
    id: '2',
    nombre: 'Carlos Rodríguez',
    ultimaConsulta: 'Hace 1 semana',
    estado: 'activo'
  },
  {
    id: '3',
    nombre: 'Elena Martínez',
    ultimaConsulta: 'Hace 2 semanas',
    estado: 'inactivo'
  }
];
</script>

<style scoped lang="scss">
.patients-widget {
  .widget-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
}
</style>
