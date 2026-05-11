<template>
  <v-container fluid class="facturas-view">
    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between mb-4">
          <div>
            <h1 class="text-h4">Facturación Electrónica</h1>
            <p class="text-body-1 text-grey-darken-1">Gestión de facturas SRI</p>
          </div>
          <v-btn
            color="primary"
            variant="elevated"
            prepend-icon="mdi-plus"
            @click="crearNuevaFactura"
          >
            Nueva Factura
          </v-btn>
        </div>
        <p class="text-body-2 text-medium-emphasis mb-6">
          Sistema de facturación electrónica compatible con SRI Ecuador
        </p>
      </v-col>
    </v-row>

    <!-- Filtros -->
    <v-row>
      <v-col cols="12">
        <v-card elevation="1" class="mb-4">
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="filtros.busqueda"
                  prepend-icon="mdi-magnify"
                  label="Buscar..."
                  single-line
                  hide-details
                  variant="outlined"
                  density="compact"
                  clearable
                />
              </v-col>
              <v-col cols="6" sm="3">
                <v-select
                  v-model="filtros.estado"
                  :items="estadosFactura"
                  label="Estado"
                  variant="outlined"
                  density="compact"
                  hide-details
                  clearable
                >
                  <template #prepend-inner>
                    <v-icon>mdi-filter-variant</v-icon>
                  </template>
                </v-select>
              </v-col>
              <v-col cols="6" sm="3">
                <v-select
                  v-model="filtros.periodo"
                  :items="periodos"
                  label="Período"
                  variant="outlined"
                  density="compact"
                  hide-details
                  clearable
                />
              </v-col>
              <v-col cols="12" sm="2">
                <v-btn
                  block
                  color="grey"
                  variant="tonal"
                  height="40"
                  @click="exportarFacturas"
                >
                  <v-icon start>mdi-download-multiple</v-icon>
                  Exportar
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Tabla de Facturas -->
    <v-row>
      <v-col cols="12">
        <v-card elevation="1">
          <v-data-table
            :headers="headers"
            :items="facturas"
            :search="filtros.busqueda"
            :loading="cargando"
            item-value="id"
          >
            <!-- Estado Column -->
            <template v-slot:item.estado="{ item }">
              <v-chip :color="getEstadoColor(item.estado)" size="small" variant="flat">
                {{ getEstadoLabel(item.estado) }}
              </v-chip>
            </template>

            <!-- Fecha Column -->
            <template v-slot:item.fechaEmision="{ item }">
              {{ formatDate(item.fechaEmision) }}
            </template>

            <!-- Monto Column -->
            <template v-slot:item.montoTotal="{ item }">
              {{ formatCurrency(item.montoTotal) }}
            </template>

            <!-- Autorizada Column -->
            <template v-slot:item.xmlAutorizado="{ item }">
              <v-icon v-if="item.xmlAutorizado" color="success" icon="mdi-check-circle" />
              <v-icon v-else color="grey" icon="mdi-clock-outline" />
            </template>

            <!-- Actions Column -->
            <template v-slot:item.acciones="{ item }">
              <v-btn icon="mdi-eye" size="small" variant="text" @click="verFactura(item)" />
              <v-btn icon="mdi-download" size="small" variant="text" color="primary" @click="descargarXML(item)" />
              <v-btn v-if="!item.xmlAutorizado" icon="mdi-send" size="small" variant="text" color="success" @click="enviarAlSRI(item)" />
              <v-btn icon="mdi-dots-vertical" size="small" variant="text" />
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog: Nueva Factura -->
    <v-dialog v-model="dialogoNuevaFactura" max-width="900">
      <FacturaForm
        @guardar="onFacturaGuardada"
        @cancelar="dialogoNuevaFactura = false"
      />
    </v-dialog>

    <!-- Dialog: Ver Factura -->
    <v-dialog v-model="dialogoVerFactura" max-width="900">
      <FacturaDetalle
        v-if="facturaSeleccionada"
        :factura="facturaSeleccionada"
        @enviarSri="onEnviarSRI"
        @cerrar="dialogoVerFactura = false"
      />
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.visible" :color="snackbar.color">
      {{ snackbar.mensaje }}
      <template #actions>
        <v-btn variant="text" @click="snackbar.visible = false">Cerrar</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import FacturaForm from './FacturaForm.vue';
import FacturaDetalle from './FacturaDetalle.vue';

interface Factura {
  id: string;
  ruc: string;
  razonSocial: string;
  secuencial: string;
  fechaEmision: Date;
  estado: string;
  montoTotal: number;
  xmlAutorizado?: string;
  claveAcceso?: string;
}

const facturas = ref<Factura[]>([]);
const cargando = ref(false);
const dialogoNuevaFactura = ref(false);
const dialogoVerFactura = ref(false);
const facturaSeleccionada = ref<Factura | null>(null);

const snackbar = ref({
  visible: false,
  mensaje: '',
  color: 'info'
});

const filtros = ref({
  busqueda: '',
  estado: null as string | null,
  periodo: null as string | null,
});

const headers = [
  { title: 'Secuencial', key: 'secuencial', sortable: true },
  { title: 'RUC', key: 'ruc', sortable: true },
  { title: 'Razón Social', key: 'razonSocial', sortable: true },
  { title: 'Fecha', key: 'fechaEmision', sortable: true },
  { title: 'Monto', key: 'montoTotal', sortable: true },
  { title: 'Estado', key: 'estado', sortable: true },
  { title: 'Autorizada', key: 'xmlAutorizado', sortable: false, align: 'center' as const },
  { title: 'Acciones', key: 'acciones', sortable: false, align: 'end' as const },
];

const estadosFactura = [
  { title: 'Recibida', value: 'recibida' },
  { title: 'Autorizada', value: 'autorizada' },
  { title: 'Rechazada', value: 'rechazada' },
  { title: 'Enviada', value: 'enviada' },
];

const periodos = [
  { title: 'Hoy', value: 'hoy' },
  { title: 'Esta semana', value: 'semana' },
  { title: 'Este mes', value: 'mes' },
  { title: 'Este año', value: 'anio' },
];

// Methods
onMounted(() => {
  cargarFacturas();
});

async function cargarFacturas() {
  cargando.value = true;
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/billing/facturas`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
      },
    });

    if (response.ok) {
      const data = await response.json();
      facturas.value = data.facturas || [];
    } else {
      mostrarSnackbar('Error al cargar facturas', 'error');
    }
  } catch (e) {
    console.error('Error cargando facturas:', e);
    mostrarSnackbar('Error de comunicación', 'error');
  } finally {
    cargando.value = false;
  }
}

function crearNuevaFactura() {
  dialogoNuevaFactura.value = true;
}

function verFactura(factura: Factura) {
  facturaSeleccionada.value = factura;
  dialogoVerFactura.value = true;
}

async function descargarXML(factura: Factura) {
  if (!factura.xmlAutorizado) {
    mostrarSnackbar('La factura no ha sido autorizada aún', 'warning');
    return;
  }

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/billing/facturas/${factura.id}/descargar-xml`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
      },
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura_${factura.secuencial}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      mostrarSnackbar('XML descargado exitosamente', 'success');
    }
  } catch (e) {
    console.error('Error descargando XML:', e);
    mostrarSnackbar('Error al descargar XML', 'error');
  }
}

async function enviarAlSRI(factura: Factura) {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/billing/facturas/${factura.id}/enviar-sri`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
      },
      body: JSON.stringify({ ambiente: '1' }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.estado === 'RECIBIDA') {
        mostrarSnackbar('Factura enviada al SRI exitosamente', 'success');
        await cargarFacturas(); // Recargar lista
      }
    } else {
      mostrarSnackbar('Error al enviar factura al SRI', 'error');
    }
  } catch (e) {
    console.error('Error enviando al SRI:', e);
    mostrarSnackbar('Error de comunicación con SRI', 'error');
  }
}

function onFacturaGuardada(factura: Factura) {
  facturas.value.unshift(factura);
  dialogoNuevaFactura.value = false;
  mostrarSnackbar('Factura creada exitosamente', 'success');
}

function onEnviarSRI(factura: Factura) {
  enviarAlSRI(factura);
  dialogoVerFactura.value = false;
}

function exportarFacturas() {
  mostrarSnackbar('Función de exportación en desarrollo', 'info');
}

function getEstadoColor(estado: string): string {
  const colores: Record<string, string> = {
    recibida: 'grey',
    autorizada: 'success',
    rechazada: 'error',
    enviada: 'info',
  };
  return colores[estado] || 'grey';
}

function getEstadoLabel(estado: string): string {
  const labels: Record<string, string> = {
    recibida: 'Recibida',
    autorizada: 'Autorizada',
    rechazada: 'Rechazada',
    enviada: 'Enviada',
  };
  return labels[estado] || estado;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

function mostrarSnackbar(mensaje: string, color: string = 'info') {
  snackbar.value = {
    visible: true,
    mensaje,
    color
  };
}
</script>

<style scoped>
.facturas-view {
  max-width: 1400px;
  margin: 0 auto;
}
</style>
