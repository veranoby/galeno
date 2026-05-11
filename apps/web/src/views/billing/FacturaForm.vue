<template>
  <v-card>
    <v-toolbar color="primary" density="comfortable">
      <v-toolbar-title class="text-white">Nueva Factura Electrónica</v-toolbar-title>
      <v-spacer />
      <v-btn icon="mdi-close" variant="text" @click="$emit('cancelar')" />
    </v-toolbar>

    <v-card-text class="pa-4">
      <v-stepper v-model="paso" :items="pasos" class="elevation-0">
        <!-- Paso 1: Información del Cliente -->
        <template v-slot:item.1>
          <v-card flat>
            <v-card-title class="text-h6 mb-4">
              <v-icon start>mdi-account-tie</v-icon>
              Información del Cliente
            </v-card-title>

            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="factura.ruc"
                  label="RUC / CI"
                  :rules="[rules.required, rules.ruc]"
                  variant="outlined"
                  density="compact"
                  hint="Número de RUC o Cédula del cliente"
                  persistent-hint
                  counter="13"
                />
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model="factura.razonSocial"
                  label="Razón Social / Nombres"
                  :rules="[rules.required]"
                  variant="outlined"
                  density="compact"
                />
              </v-col>

              <v-col cols="12" sm="6">
                <v-select
                  v-model="factura.tipoIdentificacion"
                  :items="tiposIdentificacion"
                  label="Tipo Identificación"
                  variant="outlined"
                  density="compact"
                />
              </v-col>

              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="factura.direccion"
                  label="Dirección"
                  variant="outlined"
                  density="compact"
                />
              </v-col>

              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="factura.telefono"
                  label="Teléfono"
                  variant="outlined"
                  density="compact"
                />
              </v-col>

              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="factura.email"
                  label="Email"
                  type="email"
                  variant="outlined"
                  density="compact"
                />
              </v-col>
            </v-row>

            <v-btn color="primary" variant="elevated" block class="mt-4" @click="paso = 2">
              Continuar
            </v-btn>
          </v-card>
        </template>

        <!-- Paso 2: Detalles de Factura -->
        <template v-slot:item.2>
          <v-card flat>
            <v-card-title class="text-h6 mb-4">
              <v-icon start>mdi-file-document</v-icon>
              Detalles de la Factura
            </v-card-title>

            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model.number="factura.secuencial"
                  label="Secuencial"
                  :rules="[rules.required]"
                  type="number"
                  variant="outlined"
                  density="compact"
                  hint="Número secuencial de la factura"
                  persistent-hint
                />
              </v-col>

              <v-col cols="12" sm="6">
                <v-select
                  v-model="factura.ambiente"
                  :items="ambientes"
                  label="Ambiente"
                  variant="outlined"
                  density="compact"
                />
              </v-col>

              <v-col cols="12" sm="6">
                <v-select
                  v-model="factura.tipoEmision"
                  :items="tiposEmision"
                  label="Tipo de Emisión"
                  variant="outlined"
                  density="compact"
                />
              </v-col>

              <v-col cols="12" sm="6">
                <v-menu v-model="menuFechaEmision">
                  <template v-slot:activator="{ props }">
                    <v-text-field
                      :model-value="formatDate(factura.fechaEmision)"
                      label="Fecha de Emisión"
                      variant="outlined"
                      density="compact"
                      prepend-icon="mdi-calendar"
                      readonly
                    />
                  </template>
                  <v-date-picker v-model="factura.fechaEmision" />
                </v-menu>
              </v-col>
            </v-row>

            <div class="mt-4">
              <div class="text-subtitle-2 mb-2">Ítems de Factura</div>
              <v-btn size="small" color="primary" variant="tonal" @click="agregarItem">
                <v-icon start>mdi-plus</v-icon>
                Agregar Ítem
              </v-btn>
            </div>

            <v-list>
              <v-list-item v-for="(item, index) in factura.items" :key="index" class="px-0">
                <v-list-item-content class="pt-0">
                  <v-row align="center">
                    <v-col cols="5" sm="4">
                      <v-text-field
                        v-model="item.codigoPrincipal"
                        label="Código"
                        variant="outlined"
                        density="compact"
                        hide-details
                      />
                    </v-col>
                    <v-col cols="7" sm="6">
                      <v-text-field
                        v-model="item.descripcion"
                        label="Descripción"
                        variant="outlined"
                        density="compact"
                        hide-details
                      />
                    </v-col>
                    <v-col cols="6" sm="4">
                      <v-text-field
                        v-model.number="item.cantidad"
                        label="Cantidad"
                        type="number"
                        variant="outlined"
                        density="compact"
                        hide-details
                        @update:model-value="calcularItemTotal(index)"
                      />
                    </v-col>
                    <v-col cols="6" sm="4">
                      <v-text-field
                        v-model.number="item.precioUnitario"
                        label="Precio Unit."
                        type="number"
                        variant="outlined"
                        density="compact"
                        hide-details
                        prefix="$"
                        @update:model-value="calcularItemTotal(index)"
                      />
                    </v-col>
                    <v-col cols="5" sm="3">
                      <v-text-field
                        :model-value="formatCurrency(item.precioTotalSinImpuestos)"
                        label="Total S/I"
                        type="number"
                        variant="outlined"
                        density="compact"
                        hide-details
                        readonly
                      />
                    </v-col>
                    <v-col cols="3" sm="1">
                      <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="eliminarItem(index)" />
                    </v-col>
                  </v-row>
                </v-list-item-content>
              </v-list-item>
            </v-list>

            <v-divider class="my-4" />

            <v-row align="end">
              <v-col cols="12" sm="6">
                <div class="text-h6">Subtotal 12%: {{ formatCurrency(subtotal12) }}</div>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="text-h6">Subtotal 0%: {{ formatCurrency(subtotal0) }}</div>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="text-h6">IVA 12%: {{ formatCurrency(iva12) }}</div>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="text-h6">IVA 0%: {{ formatCurrency(iva0) }}</div>
              </v-col>
              <v-col cols="12">
                <div class="text-h5 primary--text">Total: {{ formatCurrency(total) }}</div>
              </v-col>
            </v-row>

            <v-row class="mt-4">
              <v-col cols="6">
                <v-btn variant="tonal" block @click="paso = 1">Atrás</v-btn>
              </v-col>
              <v-col cols="6">
                <v-btn color="primary" variant="elevated" block @click="generarXML">
                  <v-icon start>mdi-file-xml</v-icon>
                  Generar XML
                </v-btn>
              </v-col>
            </v-row>
          </v-card>
        </template>

        <!-- Paso 3: Confirmar y Firmar -->
        <template v-slot:item.3>
          <v-card flat>
            <v-card-title class="text-h6 mb-4">
              <v-icon start>mdi-fingerprint</v-icon>
              Confirmar y Firmar
            </v-card-title>

            <v-alert type="info" variant="tonal" class="mb-4" density="compact">
              Revise los datos de la factura antes de firmarla electrónicamente.
            </v-alert>

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
                <v-list-item-title>Secuencial:</v-list-item-title>
                <v-list-item-subtitle>{{ factura.secuencial }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Fecha Emisión:</v-list-item-title>
                <v-list-item-subtitle>{{ formatDate(factura.fechaEmision) }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Total:</v-list-item-title>
                <v-list-item-subtitle class="text-h6">{{ formatCurrency(total) }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>

            <div class="mt-4" v-if="!xmlGenerado">
              <v-btn color="primary" variant="elevated" block @click="generarXML">
                <v-icon start>mdi-file-xml</v-icon>
                Generar XML para Firmar
              </v-btn>
            </div>

            <div v-if="xmlGenerado">
              <v-alert type="success" variant="tonal" class="mb-4" density="compact">
                <v-icon start>mdi-check-circle</v-icon>
                XML generado exitosamente. Ahora puede firmar la factura.
              </v-alert>

              <v-btn color="success" variant="elevated" block :disabled="!firmaCompletada" @click="guardarFactura">
                <v-icon start>mdi-check</v-icon>
                Guardar Factura
              </v-btn>
            </div>

            <v-row class="mt-4">
              <v-col cols="6">
                <v-btn variant="tonal" block @click="paso = 2">Atrás</v-btn>
              </v-col>
            </v-row>
          </v-card>
        </template>
      </v-stepper>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface FacturaItem {
  codigoPrincipal: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  precioTotalSinImpuestos: number;
  impuestos: {
    codigo: string;
    codigoPorcentaje: string;
    tarifa: number;
    baseImponible: number;
    valor: number;
  }[];
}

interface Factura {
  ruc: string;
  razonSocial: string;
  tipoIdentificacion: string;
  direccion: string;
  telefono: string;
  email: string;
  secuencial: string;
  ambiente: string;
  tipoEmision: string;
  fechaEmision: Date;
  items: FacturaItem[];
}

const emit = defineEmits<{
  guardar: [factura: any];
  cancelar: [];
}>();

const paso = ref(1);
const menuFechaEmision = ref(false);
const firmaCompletada = ref(false);
const xmlGenerado = ref('');

const factura = ref<Factura>({
  ruc: '',
  razonSocial: '',
  tipoIdentificacion: '04',
  direccion: '',
  telefono: '',
  email: '',
  secuencial: '001',
  ambiente: '1',
  tipoEmision: '01',
  fechaEmision: new Date(),
  items: [
    {
      codigoPrincipal: '001',
      descripcion: 'Consulta Médica General',
      cantidad: 1,
      precioUnitario: 30,
      precioTotalSinImpuestos: 30,
      impuestos: [
        {
          codigo: '2',
          codigoPorcentaje: '0',
          tarifa: 12,
          baseImponible: 30,
          valor: 3.60,
        },
      ],
    },
  ],
});

const pasos = ['Cliente', 'Detalles', 'Confirmar'];

const tiposIdentificacion = [
  { title: 'RUC', value: '04' },
  { title: 'Cédula', value: '05' },
  { title: 'Pasaporte', value: '06' },
  { title: 'Consumidor Final', value: '07' },
  { title: 'Exterior', value: '08' },
];

const ambientes = [
  { title: 'Pruebas (1)', value: '1' },
  { title: 'Producción (2)', value: '2' },
];

const tiposEmision = [
  { title: 'Normal', value: '01' },
  { title: 'Diferida', value: '02' },
  { title: 'Contingencia', value: '03' },
];

// Validaciones
const rules = {
  required: (v: string) => !!v || 'Este campo es obligatorio',
  ruc: (v: string) => v.length === 13 || 'RUC debe tener 13 dígitos',
};

// Computed
const subtotal12 = computed(() => {
  return factura.value.items.reduce((sum, item) => {
    const iva = item.impuestos.find(i => i.codigoPorcentaje === '0');
    return sum + (iva?.valor || 0);
  }, 0);
});

const subtotal0 = computed(() => {
  return factura.value.items.reduce((sum, item) => {
    const iva = item.impuestos.find(i => i.codigoPorcentaje === '6');
    return sum + (iva?.valor || 0);
  }, 0);
});

const iva12 = computed(() => subtotal12.value);
const iva0 = computed(() => subtotal0.value);

const total = computed(() => {
  return factura.value.items.reduce((sum, item) => {
    return sum + (item.cantidad * item.precioUnitario);
  }, 0);
});

const documentoInfo = computed(() => ({
  tipo: 'Factura Electrónica',
  referencia: `FACT-${factura.value.secuencial}`,
  emisor: factura.value.razonSocial,
}));

// Methods
function agregarItem() {
  factura.value.items.push({
    codigoPrincipal: '',
    descripcion: '',
    cantidad: 1,
    precioUnitario: 0,
    precioTotalSinImpuestos: 0,
    impuestos: [],
  });
}

function eliminarItem(index: number) {
  factura.value.items.splice(index, 1);
}

function calcularItemTotal(index: number) {
  const item = factura.value.items[index];
  const precioTotal = item.cantidad * item.precioUnitario;
  item.precioTotalSinImpuestos = precioTotal;

  // Recalcular impuestos (12% IVA por defecto)
  item.impuestos = [
    {
      codigo: '2',
      codigoPorcentaje: '0',
      tarifa: 12,
      baseImponible: precioTotal,
      valor: precioTotal * 0.12,
    },
  ];
}

function generarXML() {
  // Simular generación de XML
  xmlGenerado.value = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.0.0">
  <infoTributaria>
    <ambiente>${factura.value.ambiente}</ambiente>
    <tipoEmision>${factura.value.tipoEmision}</tipoEmision>
    <razonSocial>${factura.value.razonSocial}</razonSocial>
    <ruc>${factura.value.ruc}</ruc>
    <claveAcceso>${Date.now().toString().padStart(49, '0')}</claveAcceso>
    <secuencial>${factura.value.secuencial}</secuencial>
  </infoTributaria>
</factura>`;

  paso.value = 3;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function guardarFactura() {
  emit('guardar', {
    id: `FACT-${Date.now()}`,
    ...factura.value,
    fechaEmision: factura.value.fechaEmision.toISOString(),
    estado: 'recibida',
    montoTotal: total.value,
    xmlGenerado: xmlGenerado.value,
    xmlAutorizado: null,
    claveAcceso: null,
  });
}
</script>
