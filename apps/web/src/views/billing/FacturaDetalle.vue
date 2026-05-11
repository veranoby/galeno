<template>
  <v-card>
    <v-toolbar color="primary" density="comfortable">
      <v-toolbar-title class="text-white">Detalle de Factura</v-toolbar-title>
      <v-spacer />
      <v-btn icon="mdi-close" variant="text" @click="$emit('cerrar')" />
    </v-toolbar>

    <v-card-text class="pa-4">
      <v-row v-if="factura">
        <v-col cols="12">
          <v-alert
            :type="getEstadoAlertType(factura.estado)"
            variant="tonal"
            class="mb-4"
            density="compact"
          >
            <template v-slot:prepend>
              <v-icon>{{ getEstadoIcon(factura.estado) }}</v-icon>
            </template>
            <div>
              <strong>{{ getEstadoLabel(factura.estado) }}</strong>
              <div v-if="factura.mensajeSRI" class="text-caption mt-1">
                {{ factura.mensajeSRI }}
              </div>
            </div>
          </v-alert>
        </v-col>

        <v-col cols="12" sm="6">
          <div class="text-subtitle-2 mb-2">Información del Cliente</div>
          <v-list density="compact" variant="outlined" class="mb-4">
            <v-list-item>
              <v-list-item-title>RUC / CI:</v-list-item-title>
              <v-list-item-subtitle>{{ factura.ruc }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Razón Social:</v-list-item-title>
              <v-list-item-subtitle>{{ factura.razonSocial }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Dirección:</v-list-item-title>
              <v-list-item-subtitle>{{ factura.direccion || '-' }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Teléfono:</v-list-item-title>
              <v-list-item-subtitle>{{ factura.telefono || '-' }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Email:</v-list-item-title>
              <v-list-item-subtitle>{{ factura.email || '-' }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-col>

        <v-col cols="12" sm="6">
          <div class="text-subtitle-2 mb-2">Información de Factura</div>
          <v-list density="compact" variant="outlined" class="mb-4">
            <v-list-item>
              <v-list-item-title>Secuencial:</v-list-item-title>
              <v-list-item-subtitle>{{ factura.secuencial }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Fecha Emisión:</v-list-item-title>
              <v-list-item-subtitle>{{ formatDate(factura.fechaEmision) }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Ambiente:</v-list-item-title>
              <v-list-item-subtitle>{{ factura.ambiente === '1' ? 'Pruebas' : 'Producción' }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Estado SRI:</v-list-item-title>
              <v-list-item-subtitle>
                <v-chip :color="getEstadoColor(factura.estado)" size="small" variant="flat">
                  {{ getEstadoLabel(factura.estado) }}
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="factura.claveAcceso">
              <v-list-item-title>Clave Acceso:</v-list-item-title>
              <v-list-item-subtitle>{{ factura.claveAcceso }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Nro. Autorización:</v-list-item-title>
              <v-list-item-subtitle>{{ factura.numeroAutorizacion || '-' }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-col>

        <v-col cols="12">
          <v-divider class="my-4" />
        </v-col>

        <!-- Items de Factura -->
        <v-col cols="12" v-if="factura.items && factura.items.length > 0">
          <div class="text-subtitle-2 mb-2">Ítems de Factura</div>
          <v-table density="compact">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th class="text-right">Cantidad</th>
                <th class="text-right">Precio Unit.</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in factura.items" :key="index">
                <td>{{ item.codigoPrincipal }}</td>
                <td>{{ item.descripcion }}</td>
                <td class="text-right">{{ item.cantidad }}</td>
                <td class="text-right">{{ formatCurrency(item.precioUnitario) }}</td>
                <td class="text-right">{{ formatCurrency(item.precioTotalSinImpuestos) }}</td>
              </tr>
            </tbody>
            <tfoot v-if="factura.infoFactura">
              <tr>
                <td colspan="3" class="text-right font-weight-bold">Subtotal:</td>
                <td class="text-right font-weight-bold">
                  {{ formatCurrency(factura.infoFactura.totalSinImpuestos || factura.montoTotal) }}
                </td>
              </tr>
              <tr>
                <td colspan="3" class="text-right font-weight-bold">Total:</td>
                <td class="text-right font-weight-bold primary--text">
                  {{ formatCurrency(factura.montoTotal) }}
                </td>
              </tr>
            </tfoot>
          </v-table>
        </v-col>

        <v-col cols="12">
          <v-divider class="my-4" />
        </v-col>

        <!-- Acciones Disponibles -->
        <v-col cols="12">
          <div class="text-subtitle-2 mb-2">Acciones Disponibles</div>
          <v-row>
            <!-- Descargar XML Generado -->
            <v-col cols="12" sm="6" v-if="factura.xmlGenerado">
              <v-btn block color="info" variant="elevated" @click="descargarXMLGenerado">
                <v-icon start>mdi-code-braces</v-icon>
                Descargar XML Generado
              </v-btn>
            </v-col>

            <!-- Enviar al SRI -->
            <v-col cols="12" sm="6" v-if="factura.estado === 'recibida' || factura.estado === 'rechazada'">
              <v-btn
                block
                color="success"
                variant="elevated"
                @click="$emit('enviarSri', factura)"
                :loading="enviando"
                :disabled="enviando"
              >
                <v-icon start>mdi-send</v-icon>
                Enviar al SRI
              </v-btn>
            </v-col>

            <!-- Descargar XML Autorizado -->
            <v-col cols="12" sm="6" v-if="factura.xmlAutorizado">
              <v-btn block color="success" variant="elevated" @click="descargarXMLAutorizado">
                <v-icon start>mdi-download</v-icon>
                Descargar XML Autorizado
              </v-btn>
            </v-col>

            <!-- Consultar Estado SRI -->
            <v-col cols="12" sm="6" v-if="factura.estado === 'enviada' || factura.estado === 'recibida'">
              <v-btn
                block
                color="warning"
                variant="elevated"
                @click="consultarEstadoSRI"
                :loading="consultando"
                :disabled="consultando"
              >
                <v-icon start>mdi-refresh</v-icon>
                Consultar Estado SRI
              </v-btn>
            </v-col>

            <!-- Imprimir -->
            <v-col cols="12" sm="6">
              <v-btn block color="grey" variant="tonal" @click="imprimirFactura">
                <v-icon start>mdi-printer</v-icon>
                Imprimir
              </v-btn>
            </v-col>
          </v-row>
        </v-col>

        <v-col cols="12" v-if="factura.estado === 'recibida'">
          <v-alert type="info" variant="tonal" class="mt-4" density="compact">
            <v-icon start>mdi-information</v-icon>
            Esta factura aún no ha sido enviada al SRI. Una vez enviada, podrá realizar el seguimiento de la autorización.
          </v-alert>
        </v-col>

        <v-col cols="12" v-if="factura.estado === 'enviada'">
          <v-alert type="warning" variant="tonal" class="mt-4" density="compact">
            <v-icon start>mdi-clock</v-icon>
            La factura ha sido enviada al SRI y está pendiente de autorización. El proceso puede tomar hasta 30 minutos.
          </v-alert>
        </v-col>

        <v-col cols="12" v-if="factura.estado === 'rechazada'">
          <v-alert type="error" variant="tonal" class="mt-4" density="compact">
            <v-icon start>mdi-alert-circle</v-icon>
            La factura ha sido rechazada por el SRI. Por favor revise los datos y genere un nuevo XML.
          </v-alert>
        </v-col>

        <v-col cols="12" v-if="factura.estado === 'autorizada'">
          <v-alert type="success" variant="tonal" class="mt-4" density="compact">
            <v-icon start>mdi-check-circle</v-icon>
            La factura ha sido autorizada exitosamente por el SRI.
          </v-alert>
        </v-col>
      </v-row>

      <!-- Skeleton Loader -->
      <v-row v-else>
        <v-col cols="12">
          <v-skeleton-loader type="card" boilerplate />
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Factura {
  id: string;
  ruc: string;
  razonSocial: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  secuencial: string;
  fechaEmision: Date;
  estado: string;
  montoTotal: number;
  xmlGenerado?: string;
  xmlAutorizado?: string;
  ambiente?: string;
  claveAcceso?: string;
  numeroAutorizacion?: string;
  mensajeSRI?: string;
  items?: FacturaItem[];
  infoFactura?: {
    totalSinImpuestos: number;
  };
}

interface FacturaItem {
  codigoPrincipal: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  precioTotalSinImpuestos: number;
}

const props = defineProps<{
  factura: Factura;
}>();

const emit = defineEmits<{
  enviarSri: [factura: Factura];
  cerrar: [];
}>();

const enviando = ref(false);
const consultando = ref(false);

function getEstadoAlertType(estado: string): 'info' | 'success' | 'error' | 'warning' {
  const tipos: Record<string, 'info' | 'success' | 'error' | 'warning'> = {
    recibida: 'info',
    autorizada: 'success',
    rechazada: 'error',
    enviada: 'warning',
  };
  return tipos[estado] || 'info';
}

function getEstadoIcon(estado: string): string {
  const iconos: Record<string, string> = {
    recibida: 'mdi-information',
    autorizada: 'mdi-check-circle',
    rechazada: 'mdi-alert-circle',
    enviada: 'mdi-clock',
  };
  return iconos[estado] || 'mdi-information';
}

function getEstadoLabel(estado: string): string {
  const labels: Record<string, string> = {
    recibida: 'Recibida',
    autorizada: 'Autorizada',
    rechazada: 'Rechazada',
    enviada: 'Enviada al SRI',
  };
  return labels[estado] || estado;
}

function getEstadoColor(estado: string): string {
  const colores: Record<string, string> = {
    recibida: 'grey',
    autorizada: 'success',
    rechazada: 'error',
    enviada: 'warning',
  };
  return colores[estado] || 'grey';
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function descargarXMLGenerado() {
  if (!props.factura.xmlGenerado) return;
  const blob = new Blob([props.factura.xmlGenerado], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `factura_${props.factura.secuencial}_generado.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function descargarXMLAutorizado() {
  if (!props.factura.xmlAutorizado) return;
  const blob = new Blob([props.factura.xmlAutorizado], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `factura_${props.factura.secuencial}_autorizado.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function consultarEstadoSRI() {
  consultando.value = true;
  // Simular consulta
  setTimeout(() => {
    consultando.value = false;
  }, 2000);
}

function imprimirFactura() {
  window.print();
}
</script>

<style scoped>
.text-right {
  text-align: right;
}

.font-weight-bold {
  font-weight: bold;
}

.primary--text {
  color: #1565C0;
}
</style>
