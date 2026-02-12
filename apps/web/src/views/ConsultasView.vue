<template>
  <v-container fluid>
    <div class="d-flex align-center justify-space-between mb-4">
      <div>
        <h1 class="text-h4">Consultas</h1>
        <p class="text-body-1 text-grey-darken-1">Gestión de consultas médicas</p>
      </div>
      <v-btn color="primary" variant="elevated" @click="crearNuevaConsulta">
        <v-icon start>mdi-plus</v-icon>
        Nueva Consulta
      </v-btn>
    </div>

    <!-- Consultas List -->
    <v-card>
      <v-card-title>
        <v-text-field
          v-model="busqueda"
          prepend-icon="mdi-magnify"
          label="Buscar consultas..."
          single-line
          hide-details
          variant="outlined"
          density="compact"
        />
      </v-card-title>

      <v-data-table
        :headers="headers"
        :items="consultas"
        :search="busqueda"
        :loading="cargando"
        item-value="id"
      >
        <!-- Status Column -->
        <template v-slot:item.estado="{ item }">
          <v-chip :color="getEstadoColor(item.estado)" size="small">
            {{ getEstadoLabel(item.estado) }}
          </v-chip>
        </template>

        <!-- Signed Column -->
        <template v-slot:item.firmado="{ item }">
          <v-icon v-if="item.firmado" color="success" icon="mdi-check-circle" />
          <v-icon v-else color="grey" icon="mdi-circle-outline" />
        </template>

        <!-- Actions Column -->
        <template v-slot:item.acciones="{ item }">
          <v-btn
            icon="mdi-eye"
            size="small"
            variant="text"
            @click="verDetalle(item)"
          />
          <v-btn
            v-if="!item.firmado && item.estado === 'finalizada'"
            icon="mdi-draw-pen"
            size="small"
            variant="text"
            color="primary"
            @click="abrirDialogoFirma(item)"
          />
          <v-btn
            v-if="item.firmado"
            icon="mdi-certificate"
            size="small"
            variant="text"
            color="success"
            @click="verFirma(item)"
          />
        </template>
      </v-data-table>
    </v-card>

    <!-- Firma Dialog -->
    <FirmaDialog
      v-model="dialogoFirmaAbierto"
      :datos-consulta="datosConsultaAFirmar"
      @firma-completada="onFirmaCompletada"
      @cancelada="onFirmaCancelada"
    />

    <!-- Detalle Dialog -->
    <v-dialog v-model="dialogoDetalleAbierto" max-width="800">
      <v-card v-if="consultaSeleccionada">
        <v-toolbar color="primary" density="comfortable">
          <v-toolbar-title class="text-white">Detalle de Consulta</v-toolbar-title>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="dialogoDetalleAbierto = false" />
        </v-toolbar>

        <v-card-text class="pa-4">
          <v-list>
            <v-list-item>
              <v-list-item-title>Paciente</v-list-item-title>
              <v-list-item-subtitle>{{ consultaSeleccionada.paciente?.nombre }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Motivo</v-list-item-title>
              <v-list-item-subtitle>{{ consultaSeleccionada.motivoConsulta || 'N/A' }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Estado</v-list-item-title>
              <v-list-item-subtitle>{{ getEstadoLabel(consultaSeleccionada.estado) }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="consultaSeleccionada.firmado">
              <v-list-item-title>Firma</v-list-item-title>
              <v-list-item-subtitle class="text-success">
                Firmada electrónicamente
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn @click="dialogoDetalleAbierto = false">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.visible" :color="snackbar.color">
      {{ snackbar.mensaje }}
      <template v-slot:actions>
        <v-btn variant="text" @click="snackbar.visible = false">Cerrar</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import FirmaDialog from './components/FirmaDialog.vue';
import type { DatosConsulta } from '@/composables/useFirmaElectronica';

// ============= DATOS DE EJEMPLO =============
// En producción, estos datos vendrían de la API

interface Consulta {
  id: string;
  pacienteId: string;
  paciente: {
    id: string;
    nombre: string;
    cedula: string;
  };
  doctorId: string;
  doctor: {
    id: string;
    nombre: string;
  };
  estado: string;
  motivoConsulta?: string;
  evolucion?: string;
  diagnostico?: string;
  firmado: boolean;
  fechaCreacion: Date;
}

// State
const consultas = ref<Consulta[]>([]);
const busqueda = ref('');
const cargando = ref(false);
const dialogoFirmaAbierto = ref(false);
const dialogoDetalleAbierto = ref(false);
const consultaSeleccionada = ref<Consulta | null>(null);
const datosConsultaAFirmar = ref<DatosConsulta | undefined>();

const snackbar = ref({
  visible: false,
  mensaje: '',
  color: 'info'
});

// Table headers
const headers = [
  { title: 'ID', key: 'id', sortable: true },
  { title: 'Paciente', key: 'paciente.nombre', sortable: true },
  { title: 'Doctor', key: 'doctor.nombre', sortable: true },
  { title: 'Fecha', key: 'fechaCreacion', sortable: true },
  { title: 'Estado', key: 'estado', sortable: true },
  { title: 'Firmado', key: 'firmado', sortable: true, align: 'center' as const },
  { title: 'Acciones', key: 'acciones', sortable: false, align: 'end' as const },
];

// Methods
onMounted(() => {
  cargarConsultas();
});

const cargarConsultas = async () => {
  cargando.value = true;
  try {
    // Simular carga de datos
    // En producción: const response = await api.get('/api/consultas');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Datos de ejemplo
    consultas.value = [
      {
        id: '1',
        pacienteId: 'pac-001',
        paciente: {
          id: 'pac-001',
          nombre: 'Juan Pérez García',
          cedula: '1712345678'
        },
        doctorId: 'doc-001',
        doctor: {
          id: 'doc-001',
          nombre: 'Dr. Carlos Mendoza'
        },
        estado: 'finalizada',
        motivoConsulta: 'Dolor de cabeza persistente',
        evolucion: 'Paciente refiere dolor de tipo tensional...',
        diagnostico: 'Cefalea tensional',
        firmado: false,
        fechaCreacion: new Date('2024-01-15')
      },
      {
        id: '2',
        pacienteId: 'pac-002',
        paciente: {
          id: 'pac-002',
          nombre: 'María González López',
          cedula: '0987654321'
        },
        doctorId: 'doc-001',
        doctor: {
          id: 'doc-001',
          nombre: 'Dr. Carlos Mendoza'
        },
        estado: 'finalizada',
        motivoConsulta: 'Control de hipertensión',
        evolucion: 'Paciente estable con tratamiento actual...',
        diagnostico: 'Hipertensión arterial esencial',
        firmado: true,
        fechaCreacion: new Date('2024-01-14')
      },
      {
        id: '3',
        pacienteId: 'pac-003',
        paciente: {
          id: 'pac-003',
          nombre: 'Carlos Rodríguez Silva',
          cedula: '1712345679'
        },
        doctorId: 'doc-002',
        doctor: {
          id: 'doc-002',
          nombre: 'Dra. Ana Martínez'
        },
        estado: 'en_atencion',
        motivoConsulta: 'Dolor abdominal',
        firmado: false,
        fechaCreacion: new Date()
      }
    ];
  } catch (error) {
    mostrarSnackbar('Error al cargar consultas', 'error');
  } finally {
    cargando.value = false;
  }
};

const crearNuevaConsulta = () => {
  // Navegar a vista de creación de consulta
  console.log('Crear nueva consulta');
};

const verDetalle = (consulta: Consulta) => {
  consultaSeleccionada.value = consulta;
  dialogoDetalleAbierto.value = true;
};

const abrirDialogoFirma = (consulta: Consulta) => {
  // Preparar datos para firma
  datosConsultaAFirmar.value = {
    id: consulta.id,
    pacienteId: consulta.pacienteId,
    pacienteNombre: consulta.paciente.nombre,
    pacienteCedula: consulta.paciente.cedula,
    doctorNombre: consulta.doctor.nombre,
    motivoConsulta: consulta.motivoConsulta,
    diagnostico: consulta.diagnostico,
    fecha: consulta.fechaCreacion
  };

  dialogoFirmaAbierto.value = true;
};

const onFirmaCompletada = async (resultado: any, consultaId: string) => {
  // Actualizar consulta en la lista
  const consulta = consultas.value.find(c => c.id === consultaId);
  if (consulta) {
    consulta.firmado = true;
  }

  // En producción, enviar el XML firmado al servidor
  try {
    // await api.put(`/api/consultas/${consultaId}/firma`, {
    //   xmlFirmado: resultado.xmlFirmado,
    //   firmaBase64: resultado.firmaBase64
    // });

    mostrarSnackbar('Consulta firmada correctamente', 'success');
  } catch (error) {
    mostrarSnackbar('Error al guardar la firma', 'error');
  }
};

const onFirmaCancelada = () => {
  console.log('Firma cancelada');
};

const verFirma = (consulta: Consulta) => {
  // Ver detalles de la firma existente
  mostrarSnackbar('La consulta ya está firmada', 'info');
};

const getEstadoColor = (estado: string): string => {
  const colores: Record<string, string> = {
    borrador: 'grey',
    triaje: 'info',
    pendiente: 'warning',
    en_atencion: 'primary',
    finalizada: 'success',
    interconsulta: 'purple'
  };
  return colores[estado] || 'grey';
};

const getEstadoLabel = (estado: string): string => {
  const labels: Record<string, string> = {
    borrador: 'Borrador',
    triaje: 'Triaje',
    pendiente: 'Pendiente',
    en_atencion: 'En Atención',
    finalizada: 'Finalizada',
    interconsulta: 'Interconsulta'
  };
  return labels[estado] || estado;
};

const mostrarSnackbar = (mensaje: string, color: string = 'info') => {
  snackbar.value = {
    visible: true,
    mensaje,
    color
  };
};
</script>

<style scoped>
/* Estilos específicos si son necesarios */
</style>
