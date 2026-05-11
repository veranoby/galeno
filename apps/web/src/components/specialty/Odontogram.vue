<template>
  <v-card class="odontograma-card" elevation="2">
    <v-card-title class="d-flex align-center justify-space-between">
      <span>Odontograma</span>
      <v-chip size="small" variant="tonal" color="primary">
        Notación FDI
      </v-chip>
    </v-card-title>

    <v-card-text>
      <!-- Leyenda -->
      <div class="leyenda mb-4">
        <v-chip
          v-for="color in coloresTratamiento"
          :key="color.value"
          :color="color.color"
          size="small"
          class="mr-2 mb-2"
          variant="tonal"
        >
          {{ color.label }}
        </v-chip>
      </div>

      <!-- Arco Superior -->
      <div class="arco-dental arco-superior">
        <div class="cuadrante cuadrante-1">
          <v-chip
            v-for="diente in dientesCuadrante1"
            :key="diente.numero"
            :color="getColorDiente(diente.numero)"
            :class="['diente', { seleccionado: dienteSeleccionado === diente.numero }]"
            @click="seleccionarDiente(diente.numero)"
          >
            {{ diente.numero }}
          </v-chip>
        </div>
        <div class="cuadrante cuadrante-2">
          <v-chip
            v-for="diente in dientesCuadrante2"
            :key="diente.numero"
            :color="getColorDiente(diente.numero)"
            :class="['diente', { seleccionado: dienteSeleccionado === diente.numero }]"
            @click="seleccionarDiente(diente.numero)"
          >
            {{ diente.numero }}
          </v-chip>
        </div>
      </div>

      <!-- Separador -->
      <v-divider class="my-4" />

      <!-- Arco Inferior -->
      <div class="arco-dental arco-inferior">
        <div class="cuadrante cuadrante-3">
          <v-chip
            v-for="diente in dientesCuadrante3"
            :key="diente.numero"
            :color="getColorDiente(diente.numero)"
            :class="['diente', { seleccionado: dienteSeleccionado === diente.numero }]"
            @click="seleccionarDiente(diente.numero)"
          >
            {{ diente.numero }}
          </v-chip>
        </div>
        <div class="cuadrante cuadrante-4">
          <v-chip
            v-for="diente in dientesCuadrante4"
            :key="diente.numero"
            :color="getColorDiente(diente.numero)"
            :class="['diente', { seleccionado: dienteSeleccionado === diente.numero }]"
            @click="seleccionarDiente(diente.numero)"
          >
            {{ diente.numero }}
          </v-chip>
        </div>
      </div>

      <!-- Panel de Información -->
      <v-alert
        v-if="dienteSeleccionado"
        type="info"
        variant="tonal"
        class="mt-4"
        closable
        @click:close="dienteSeleccionado = null"
      >
        <div class="d-flex align-center justify-space-between">
          <div>
            <strong>Diente {{ dienteSeleccionado }}</strong>
            <div class="text-caption">
              {{ obtenerNombreDiente(dienteSeleccionado) }}
            </div>
          </div>
          <v-select
            v-model="tratamientoSeleccionado"
            :items="tratamientos"
            label="Agregar tratamiento"
            density="compact"
            style="width: 200px"
            @update:model-value="aplicarTratamiento"
          />
        </div>
      </v-alert>

      <!-- Lista de tratamientos aplicados -->
      <v-list v-if="tratamientosAplicados.length > 0" class="mt-4" density="compact">
        <v-list-subheader>Tratamientos Aplicados</v-list-subheader>
        <v-list-item
          v-for="(item, index) in tratamientosAplicados"
          :key="index"
          :prepend-color="getColorTratamiento(item.tratamiento)"
        >
          <template v-slot:prepend>
            <v-avatar :color="getColorTratamiento(item.tratamiento)" size="24">
              <v-icon size="small" color="white">mdi-tooth</v-icon>
            </v-avatar>
          </template>
          <v-list-item-title>
            Diente {{ item.numeroDiente }} - {{ item.tratamiento }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{ obtenerNombreDiente(item.numeroDiente) }}
          </v-list-item-subtitle>
          <template v-slot:append>
            <v-btn
              size="small"
              variant="text"
              icon="mdi-close"
              @click="eliminarTratamiento(index)"
            />
          </template>
        </v-list-item>
      </v-list>
    </v-card-text>

    <!-- Acciones -->
    <v-card-actions v-if="mostrarAcciones">
      <v-spacer />
      <v-btn variant="text" @click="limpiarTodo">
        Limpiar Todo
      </v-btn>
      <v-btn
        variant="elevated"
        color="primary"
        :loading="guardando"
        @click="guardarOdontograma"
      >
        Guardar
      </v-btn>
    </v-card-actions>

    <!-- Snackbar -->
    <v-snackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
      location="top right"
    >
      {{ snackbarMessage }}
    </v-snackbar>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

// Props
interface Props {
  pacienteId?: string;
  mostrarAcciones?: boolean;
  tratamientosIniciales?: Array<{ numeroDiente: string; tratamiento: string }>;
}

const props = withDefaults(defineProps<Props>(), {
  pacienteId: undefined,
  mostrarAcciones: true,
  tratamientosIniciales: () => []
});

// Emits
const emit = defineEmits<{
  (e: 'guardar', data: Array<{ numeroDiente: string; tratamiento: string }>): void;
}>();

// Estado
const dienteSeleccionado = ref<string | null>(null);
const tratamientoSeleccionado = ref<string | null>(null);
const tratamientosAplicados = ref<Array<{ numeroDiente: string; tratamiento: string }>>([]);
const guardando = ref(false);
const snackbar = ref(false);
const snackbarColor = ref('success');
const snackbarMessage = ref('');

// Colores de tratamiento
const coloresTratamiento = [
  { value: 'sano', label: 'Sano', color: 'success' },
  { value: 'caries', label: 'Caries', color: 'red' },
  { value: 'obturado', label: 'Obturado', color: 'blue' },
  { value: 'corona', label: 'Corona', color: 'amber' },
  { value: 'extraccion', label: 'Extracción', color: 'grey' },
  { value: 'endodoncia', label: 'Endodoncia', color: 'purple' }
];

// Tratamientos disponibles
const tratamientos = coloresTratamiento.map(t => t.value);

// Dientes por cuadrante (notación FDI)
const dientesCuadrante1 = [
  { numero: '18', nombre: 'Tercer molar superior derecho' },
  { numero: '17', nombre: 'Segundo molar superior derecho' },
  { numero: '16', nombre: 'Primer molar superior derecho' },
  { numero: '15', nombre: 'Segundo premolar superior derecho' },
  { numero: '14', nombre: 'Primer premolar superior derecho' },
  { numero: '13', nombre: 'Canino superior derecho' },
  { numero: '12', nombre: 'Incisivo lateral superior derecho' },
  { numero: '11', nombre: 'Incisivo central superior derecho' }
];

const dientesCuadrante2 = [
  { numero: '21', nombre: 'Incisivo central superior izquierdo' },
  { numero: '22', nombre: 'Incisivo lateral superior izquierdo' },
  { numero: '23', nombre: 'Canino superior izquierdo' },
  { numero: '24', nombre: 'Primer premolar superior izquierdo' },
  { numero: '25', nombre: 'Segundo premolar superior izquierdo' },
  { numero: '26', nombre: 'Primer molar superior izquierdo' },
  { numero: '27', nombre: 'Segundo molar superior izquierdo' },
  { numero: '28', nombre: 'Tercer molar superior izquierdo' }
];

const dientesCuadrante3 = [
  { numero: '31', nombre: 'Incisivo central inferior izquierdo' },
  { numero: '32', nombre: 'Incisivo lateral inferior izquierdo' },
  { numero: '33', nombre: 'Canino inferior izquierdo' },
  { numero: '34', nombre: 'Primer premolar inferior izquierdo' },
  { numero: '35', nombre: 'Segundo premolar inferior izquierdo' },
  { numero: '36', nombre: 'Primer molar inferior izquierdo' },
  { numero: '37', nombre: 'Segundo molar inferior izquierdo' },
  { numero: '38', nombre: 'Tercer molar inferior izquierdo' }
];

const dientesCuadrante4 = [
  { numero: '48', nombre: 'Tercer molar inferior derecho' },
  { numero: '47', nombre: 'Segundo molar inferior derecho' },
  { numero: '46', nombre: 'Primer molar inferior derecho' },
  { numero: '45', nombre: 'Segundo premolar inferior derecho' },
  { numero: '44', nombre: 'Primer premolar inferior derecho' },
  { numero: '43', nombre: 'Canino inferior derecho' },
  { numero: '42', nombre: 'Incisivo lateral inferior derecho' },
  { numero: '41', nombre: 'Incisivo central inferior derecho' }
];

// Obtener nombre del diente
function obtenerNombreDiente(numero: string): string {
  const todosDientes = [
    ...dientesCuadrante1,
    ...dientesCuadrante2,
    ...dientesCuadrante3,
    ...dientesCuadrante4
  ];
  return todosDientes.find(d => d.numero === numero)?.nombre || '';
}

// Obtener color del tratamiento
function getColorTratamiento(tratamiento: string): string {
  return coloresTratamiento.find(t => t.value === tratamiento)?.color || 'grey';
}

// Obtener color del diente
function getColorDiente(numero: string): string | undefined {
  const tratamiento = tratamientosAplicados.value.find(t => t.numeroDiente === numero);
  return tratamiento ? getColorTratamiento(tratamiento.tratamiento) : undefined;
}

// Seleccionar diente
function seleccionarDiente(numero: string) {
  dienteSeleccionado.value = numero;
  tratamientoSeleccionado.value = null;
}

// Aplicar tratamiento
function aplicarTratamiento() {
  if (!dienteSeleccionado.value || !tratamientoSeleccionado.value) return;

  // Remover tratamiento existente si lo hay
  const index = tratamientosAplicados.value.findIndex(
    t => t.numeroDiente === dienteSeleccionado.value
  );
  if (index !== -1) {
    tratamientosAplicados.value.splice(index, 1);
  }

  // Agregar nuevo tratamiento (si no es 'sano')
  if (tratamientoSeleccionado.value !== 'sano') {
    tratamientosAplicados.value.push({
      numeroDiente: dienteSeleccionado.value,
      tratamiento: tratamientoSeleccionado.value
    });
  }

  mostrarSnackbar('Tratamiento aplicado', 'success');
}

// Eliminar tratamiento
function eliminarTratamiento(index: number) {
  tratamientosAplicados.value.splice(index, 1);
  mostrarSnackbar('Tratamiento eliminado', 'success');
}

// Limpiar todo
function limpiarTodo() {
  tratamientosAplicados.value = [];
  dienteSeleccionado.value = null;
  tratamientoSeleccionado.value = null;
  mostrarSnackbar('Odontograma limpiado', 'success');
}

// Guardar odontograma
async function guardarOdontograma() {
  guardando.value = true;
  emit('guardar', tratamientosAplicados.value);
  mostrarSnackbar('Odontograma guardado correctamente', 'success');
  guardando.value = false;
}

// Mostrar snackbar
function mostrarSnackbar(message: string, color: string) {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

// Inicializar con tratamientos existentes
if (props.tratamientosIniciales.length > 0) {
  tratamientosAplicados.value = [...props.tratamientosIniciales];
}
</script>

<style scoped>
.odontograma-card {
  max-width: 900px;
  margin: 0 auto;
}

.leyenda {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.arco-dental {
  display: flex;
  justify-content: center;
  gap: 32px;
}

.arco-superior {
  flex-direction: column;
}

.arco-inferior {
  flex-direction: column;
}

.cuadrante {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 280px;
}

.diente {
  width: 48px !important;
  height: 48px !important;
  font-size: 14px !important;
  font-weight: bold !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
}

.diente:hover {
  transform: scale(1.1);
}

.diente.seleccionado {
  border-width: 3px !important;
  border-style: solid !important;
  border-color: rgb(var(--v-theme-primary)) !important;
}

.cuadrante-1,
.cuadrante-4 {
  order: 1;
}

.cuadrante-2,
.cuadrante-3 {
  order: 2;
}

@media (max-width: 600px) {
  .arco-dental {
    gap: 16px;
  }

  .cuadrante {
    max-width: 200px;
  }

  .diente {
    width: 40px !important;
    height: 40px !important;
    font-size: 12px !important;
  }
}
</style>
