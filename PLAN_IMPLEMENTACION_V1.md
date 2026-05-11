# PLAN DE IMPLEMENTACIÓN - QWEN CODER

**Fecha:** 2026-02-16
**Versión:** 1.0
**Objetivo:** Implementar 4 tareas de complejidad media en paralelo

---

## ESTRATEGIA DE EJECUCIÓN

Este plan contiene 4 tareas independientes que deben implementarse en **orden secuencial** para evitar conflictos. Cada tarea incluye:

- Título y descripción
- Criterios de aceptación
- Pasos de implementación detallados
- Archivos específicos a crear/modificar
- Código de ejemplo
- Verificaciones intermedias

---

# TAREA 1: TASK-046 - Interconsulta Simplificada

## Descripción
Flujo simplificado de interconsultas con tracking y cierre manual.

## Criterios de Aceptación
- [ ] Flujo simplificado implementado
- [ ] Tracking funcional
- [ ] Cierre manual disponible
- [ ] UX optimizada

## Archivos a Crear/Modificar

### 1. Frontend - Vista Principal
**Archivo:** `apps/web/src/views/consultation/SimpleInterconsultation.vue`

### 2. Router - Nueva Ruta
**Archivo:** `apps/web/src/router/index.ts`

## Pasos de Implementación

### Paso 1.1: Crear el componente SimpleInterconsultation.vue

```vue
<template>
  <v-container class="simple-interconsultation-container">
    <v-row class="align-center mb-4">
      <v-col cols="12" md="8">
        <h1 class="text-h4 font-weight-bold">
          <v-icon icon="mdi-forum-outline" size="large" class="mr-2" />
          Interconsulta Simplificada
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1">
          Flujo simplificado para solicitudes de interconsulta médica
        </p>
      </v-col>
      <v-col cols="12" md="4" class="text-right">
        <v-btn
          color="primary"
          size="large"
          @click="mostrarDialogoNueva = true"
        >
          <v-icon start>mdi-plus</v-icon>
          Nueva Interconsulta
        </v-btn>
      </v-col>
    </v-row>

    <!-- Filtros -->
    <v-card variant="outlined" class="mb-4">
      <v-card-text>
        <v-row dense>
          <v-col cols="12" sm="4">
            <v-select
              v-model="filtros.estado"
              :items="estadosOptions"
              label="Estado"
              variant="outlined"
              density="compact"
              clearable
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-text-field
              v-model="filtros.busqueda"
              label="Buscar"
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-magnify"
              clearable
              @keyup.enter="cargarInterconsultas"
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-btn
              variant="tonal"
              color="primary"
              block
              @click="cargarInterconsultas"
            >
              <v-icon start>mdi-refresh</v-icon>
              Actualizar
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Lista de interconsultas -->
    <v-card variant="outlined">
      <v-card-text>
        <v-data-table
          :headers="headers"
          :items="interconsultas"
          :loading="loading"
          item-value="id"
        >
          <template v-slot:item.estado="{ item }">
            <v-chip
              :color="getEstadoColor(item.estado)"
              size="small"
            >
              {{ item.estado }}
            </v-chip>
          </template>
          <template v-slot:item.acciones="{ item }">
            <v-btn
              icon="mdi-eye"
              size="small"
              variant="text"
              @click="verDetalle(item)"
            />
            <v-btn
              v-if="item.estado === 'pendiente'"
              icon="mdi-check"
              size="small"
              variant="text"
              color="success"
              @click="cerrarInterconsulta(item)"
            />
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Diálogo Nueva Interconsulta -->
    <v-dialog v-model="mostrarDialogoNueva" max-width="600">
      <v-card>
        <v-card-title>Nueva Interconsulta</v-card-title>
        <v-card-text>
          <v-form ref="formNueva">
            <v-select
              v-model="nuevaInterconsulta.pacienteId"
              :items="pacientes"
              item-title="nombre"
              item-value="id"
              label="Paciente"
              variant="outlined"
              :rules="[v => !!v || 'Required']"
            />
            <v-select
              v-model="nuevaInterconsulta.especialidadDestino"
              :items="especialidades"
              label="Especialidad Destino"
              variant="outlined"
              :rules="[v => !!v || 'Required']"
            />
            <v-textarea
              v-model="nuevaInterconsulta.motivo"
              label="Motivo de la Interconsulta"
              variant="outlined"
              :rules="[v => !!v || 'Required']"
              rows="3"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="mostrarDialogoNueva = false">Cancelar</v-btn>
          <v-btn color="primary" @click="crearInterconsulta">Crear</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useApi } from '@/composables/useApi';

const api = useApi();

interface Interconsulta {
  id: string;
  pacienteId: string;
  pacienteNombre: string;
  especialidadDestino: string;
  motivo: string;
  estado: 'pendiente' | 'en_proceso' | 'completada' | 'cerrada';
  fechaCreacion: string;
}

const interconsultas = ref<Interconsulta[]>([]);
const loading = ref(false);
const mostrarDialogoNueva = ref(false);

const filtros = ref({
  estado: null as string | null,
  busqueda: ''
});

const nuevaInterconsulta = ref({
  pacienteId: '',
  especialidadDestino: '',
  motivo: ''
});

const estadosOptions = [
  { title: 'Pendiente', value: 'pendiente' },
  { title: 'En Proceso', value: 'en_proceso' },
  { title: 'Completada', value: 'completada' },
  { title: 'Cerrada', value: 'cerrada' }
];

const headers = [
  { title: 'ID', key: 'id' },
  { title: 'Paciente', key: 'pacienteNombre' },
  { title: 'Especialidad', key: 'especialidadDestino' },
  { title: 'Estado', key: 'estado' },
  { title: 'Fecha', key: 'fechaCreacion' },
  { title: 'Acciones', key: 'acciones', sortable: false }
];

const getEstadoColor = (estado: string) => {
  const colors = {
    pendiente: 'warning',
    en_proceso: 'info',
    completada: 'success',
    cerrada: 'grey'
  };
  return colors[estado] || 'grey';
};

const cargarInterconsultas = async () => {
  loading.value = true;
  try {
    const response = await api.get('/api/v1/interconsultas/simple', {
      params: filtros.value
    });
    interconsultas.value = response.data;
  } catch (error) {
    console.error('Error cargando interconsultas:', error);
  } finally {
    loading.value = false;
  }
};

const crearInterconsulta = async () => {
  try {
    await api.post('/api/v1/interconsultas/simple', nuevaInterconsulta.value);
    mostrarDialogoNueva.value = false;
    await cargarInterconsultas();
  } catch (error) {
    console.error('Error creando interconsulta:', error);
  }
};

const cerrarInterconsulta = async (item: Interconsulta) => {
  try {
    await api.patch(`/api/v1/interconsultas/simple/${item.id}/cerrar`);
    await cargarInterconsultas();
  } catch (error) {
    console.error('Error cerrando interconsulta:', error);
  }
};

const verDetalle = (item: Interconsulta) => {
  // Implementar vista de detalle
};

onMounted(() => {
  cargarInterconsultas();
});
</script>
```

### Paso 1.2: Agregar ruta al router

**Archivo:** `apps/web/src/router/index.ts`

Agregar después de las rutas de consultation:

```typescript
{
  path: '/interconsulta-simplificada',
  name: 'interconsulta-simplificada',
  component: () => import('@/views/consultation/SimpleInterconsultation.vue'),
  meta: { title: 'Interconsulta Simplificada - Galeno', requiresAuth: true }
}
```

### Verificación Intermedia 1
```bash
# Verificar que el archivo se creó correctamente
ls -la apps/web/src/views/consultation/SimpleInterconsultation.vue

# Verificar que no hay errores de TypeScript
cd apps/web && npm run type-check
```

---

# TAREA 2: TASK-024 - GPS Dinámico y Geolocalización

## Descripción
Sistema de GPS dinámico para multi-oficina y búsqueda de doctores cercanos.

## Criterios de Aceptación
- [ ] GPS del paciente funcional
- [ ] Búsqueda por cercanía
- [ ] Multi-oficina soportada
- [ ] Privacy respetado

## Archivos a Crear/Modificar

### 1. Composable GPS (ya existe, solo actualizar)
**Archivo:** `apps/web/src/composables/useGPS.ts`

### 2. Servicio Backend
**Archivo:** `apps/api/src/services/geo/location.service.ts`

### 3. Rutas Backend
**Archivo:** `apps/api/src/routes/v1/geo.routes.ts` (nuevo)

## Pasos de Implementación

### Paso 2.1: Crear servicio de ubicación en backend

```typescript
// apps/api/src/services/geo/location.service.ts
import { PrismaClient } from '@prisma/client';

export interface Location {
  lat: number;
  lng: number;
}

export interface NearbyDoctorRequest {
  patientLat: number;
  patientLng: number;
  radiusKm?: number;
  especialidad?: string;
}

export interface DoctorLocation {
  doctorId: string;
  doctorName: string;
  especialidad: string;
  oficinaName: string;
  distanciaKm: number;
  ubicacion: Location;
}

export class LocationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Calcula distancia entre dos coordenadas usando fórmula Haversine
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Busca doctores cercanos a la ubicación del paciente
   */
  async findNearbyDoctors(
    request: NearbyDoctorRequest
  ): Promise<DoctorLocation[]> {
    const { patientLat, patientLng, radiusKm = 10, especialidad } = request;

    // Obtener todas las oficinas con ubicación
    const oficinas = await this.prisma.oficina.findMany({
      where: {
        ubicacion: {
          isEmpty: false
        }
      },
      include: {
        doctores: {
          where: especialidad ? { especialidad } : undefined,
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                apellido: true
              }
            }
          }
        }
      }
    });

    // Calcular distancias y filtrar por radio
    const results: DoctorLocation[] = [];

    for (const oficina of oficinas) {
      const oficinaLat = oficina.ubicacion.lat;
      const oficinaLng = oficina.ubicacion.lng;

      if (!oficinaLat || !oficinaLng) continue;

      const distancia = this.calculateDistance(
        patientLat,
        patientLng,
        oficinaLat,
        oficinaLng
      );

      if (distancia <= radiusKm) {
        for (const doctor of oficina.doctores) {
          results.push({
            doctorId: doctor.id,
            doctorName: `${doctor.user.nombre} ${doctor.user.apellido}`,
            especialidad: doctor.especialidad,
            oficinaName: oficina.nombre,
            distanciaKm: Math.round(distancia * 10) / 10,
            ubicacion: {
              lat: oficinaLat,
              lng: oficinaLng
            }
          });
        }
      }
    }

    // Ordenar por distancia
    return results.sort((a, b) => a.distanciaKm - b.distanciaKm);
  }

  /**
   * Actualiza la ubicación de un paciente (con consentimiento)
   */
  async updatePatientLocation(
    pacienteId: string,
    location: Location,
    consentimiento: boolean
  ): Promise<void> {
    if (!consentimiento) {
      throw new Error('Se requiere consentimiento para guardar ubicación');
    }

    await this.prisma.paciente.update({
      where: { id: pacienteId },
      data: {
        ultimaUbicacion: location,
        ubicacionConsentimiento: consentimiento,
        ubicacionUpdatedAt: new Date()
      }
    });
  }

  /**
   * Revoca el consentimiento de ubicación y elimina los datos
   */
  async revokeLocationConsent(pacienteId: string): Promise<void> {
    await this.prisma.paciente.update({
      where: { id: pacienteId },
      data: {
        ultimaUbicacion: null,
        ubicacionConsentimiento: false,
        ubicacionUpdatedAt: null
      }
    });
  }
}
```

### Paso 2.2: Crear rutas de geolocalización

```typescript
// apps/api/src/routes/v1/geo.routes.ts
import { Router, Request, Response } from 'express';
import { LocationService } from '../../services/geo/location.service';
import { authMiddleware } from '../../middleware/auth';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const locationService = new LocationService(prisma);

/**
 * @openapi
 * /geo/nearby-doctors:
 *   post:
 *     summary: Buscar doctores cercanos
 *     tags: [Geolocation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               patientLat:
 *                 type: number
 *               patientLng:
 *                 type: number
 *               radiusKm:
 *                 type: number
 *                 default: 10
 *               especialidad:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lista de doctores cercanos
 */
router.post(
  '/nearby-doctors',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const results = await locationService.findNearbyDoctors(req.body);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: 'Error buscando doctores cercanos' });
    }
  }
);

/**
 * @openapi
 * /geo/location:
 *   put:
 *     summary: Actualizar ubicación del paciente
 *     tags: [Geolocation]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/location',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { pacienteId } = req.user;
      const { lat, lng, consentimiento } = req.body;

      await locationService.updatePatientLocation(
        pacienteId,
        { lat, lng },
        consentimiento
      );

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @openapi
 * /geo/location/revoke:
 *   post:
 *     summary: Revocar consentimiento de ubicación
 *     tags: [Geolocation]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/location/revoke',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { pacienteId } = req.user;
      await locationService.revokeLocationConsent(pacienteId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
```

### Paso 2.3: Registrar rutas en el index

**Archivo:** `apps/api/src/routes/v1/index.ts`

```typescript
import geoRoutes from './geo.routes.js';

// Agregar al router:
router.use('/geo', geoRoutes);
```

### Verificación Intermedia 2
```bash
# Verificar que los archivos se crearon
ls -la apps/api/src/services/geo/location.service.ts
ls -la apps/api/src/routes/v1/geo.routes.ts

# Type check
cd apps/api && npm run type-check
```

---

# TAREA 3: TASK-050 - PWA Responsive

## Descripción
Adaptación responsive para Desktop/Tablet/Celular con experiencia optimizada por dispositivo.

## Criterios de Aceptación
- [ ] Responsive design implementado
- [ ] Experiencia optimizada por dispositivo
- [ ] Breakpoints definidos
- [ ] Touch-friendly en móvil

## Archivos a Crear

### 1. Archivo de breakpoints
**Archivo:** `apps/web/src/assets/styles/breakpoints.scss`

### 2. Archivo de estilos responsive
**Archivo:** `apps/web/src/assets/styles/responsive.scss`

## Pasos de Implementación

### Paso 3.1: Crear archivo de breakpoints

```scss
// apps/web/src/assets/styles/breakpoints.scss
// Breakpoints de Vuetify 3
$grid-breakpoints: (
  'xs': 0,
  'sm': 600px,
  'md': 960px,
  'lg': 1280px,
  'xl': 1920px,
  'xxl': 2560px
);

// Breakpoints personalizados para dispositivo específicos
$mobile-max: 599px;
$tablet-min: 600px;
$tablet-max: 959px;
$desktop-min: 960px;
$desktop-max: 1279px;
$wide-min: 1280px;

// Mixins para media queries
@mixin mobile {
  @media (max-width: $mobile-max) {
    @content;
  }
}

@mixin tablet {
  @media (min-width: $tablet-min) and (max-width: $tablet-max) {
    @content;
  }
}

@mixin desktop {
  @media (min-width: $desktop-min) {
    @content;
  }
}

@mixin touch-device {
  @media (hover: none) and (pointer: coarse) {
    @content;
  }
}

@mixin not-touch-device {
  @media (hover: hover) and (pointer: fine) {
    @content;
  }
}
```

### Paso 3.2: Crear estilos responsive

```scss
// apps/web/src/assets/styles/responsive.scss
@import './breakpoints.scss';

// Contenedores responsive
.responsive-container {
  padding: 16px;

  @include desktop {
    padding: 24px;
    max-width: 1400px;
    margin: 0 auto;
  }
}

// Tamaños de texto responsive
.responsive-text-h1 {
  font-size: 1.5rem;
  line-height: 2rem;

  @include tablet {
    font-size: 2rem;
    line-height: 2.5rem;
  }

  @include desktop {
    font-size: 2.5rem;
    line-height: 3rem;
  }
}

// Botones touch-friendly
.touch-friendly {
  min-height: 48px;
  min-width: 48px;

  @include touch-device {
    min-height: 44px;
  }
}

// Grid responsive
.responsive-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr;

  @include tablet {
    grid-template-columns: repeat(2, 1fr);
  }

  @include desktop {
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }
}

// Tarjetas responsive
.responsive-card {
  @include mobile {
    border-radius: 8px;
  }

  @include desktop {
    border-radius: 12px;
    transition: transform 0.2s, box-shadow 0.2s;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
  }
}

// Navegación responsive
.responsive-nav {
  @include mobile {
    .nav-text {
      display: none;
    }
  }

  @include desktop {
    .nav-icon {
      margin-right: 8px;
    }
  }
}

// Tablas responsive
.responsive-table-wrapper {
  overflow-x: auto;

  @include mobile {
    // En móvil, mostrar las filas como cards
    table {
      display: block;
    }

    thead {
      display: none;
    }

    tbody {
      display: block;
    }

    tr {
      display: block;
      margin-bottom: 16px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
    }

    td {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;

      &:before {
        content: attr(data-label);
        font-weight: 600;
        margin-right: 16px;
      }
    }
  }
}

// Formularios responsive
.responsive-form {
  @include mobile {
    .v-row {
      flex-direction: column;
    }

    .v-col {
      width: 100% !important;
    }
  }
}
```

### Paso 3.3: Importar estilos en main.ts

**Archivo:** `apps/web/src/main.ts`

```typescript
import '@/assets/styles/responsive.scss';
```

### Verificación Intermedia 3
```bash
# Verificar que los archivos se crearon
ls -la apps/web/src/assets/styles/breakpoints.scss
ls -la apps/web/src/assets/styles/responsive.scss

# Build para verificar
cd apps/web && npm run build
```

---

# TAREA 4: TASK-044C - Validación Senescyt

## Descripción
Implementar validación de títulos médicos contra API Senescyt.

## Criterios de Aceptación
- [ ] API Senescyt integrada
- [ ] Validación de títulos funcional
- [ ] Estado de validación almacenado
- [ ] Error handling implementado

## Archivos a Crear

### 1. Servicio de validación
**Archivo:** `apps/api/src/services/senescyt/validation.service.ts`

### 2. Componente de validación
**Archivo:** `apps/web/src/components/senescyt/Validation.vue`

### 3. Rutas de validación
**Archivo:** `apps/api/src/routes/v1/senescyt.routes.ts`

## Pasos de Implementación

### Paso 4.1: Crear servicio de validación Senescyt

```typescript
// apps/api/src/services/senescyt/validation.service.ts
import axios, { AxiosError } from 'axios';

export interface SenescytValidationRequest {
  cedula: string;
  numeroTitulo: string;
  codigoUniversidad: string;
}

export interface SenescytValidationResponse {
  valido: boolean;
  nombreProfesional: string;
  tituloProfesional: string;
  universidad: string;
  fechaRegistro: string;
  fechaExpedicion: string;
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'CANCELADO';
}

export interface ValidationStatus {
  doctorId: string;
  validado: boolean;
  fechaValidacion: Date;
  respuesta?: SenescytValidationResponse;
}

export class SenescytValidationService {
  private readonly API_BASE_URL = process.env.SENECYT_API_URL || 'https://api.senescyt.gob.ec/v1';

  /**
   * Valida un título médico contra la API de Senescyt
   */
  async validateTitulo(
    request: SenescytValidationRequest
  ): Promise<SenescytValidationResponse> {
    try {
      const response = await axios.post<SenescytValidationResponse>(
        `${this.API_BASE_URL}/titlos/validar`,
        {
          cedula: request.cedula,
          numeroTitulo: request.numeroTitulo,
          codigoUniversidad: request.codigoUniversidad
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SENECYT_API_KEY}`
          },
          timeout: 10000
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 404) {
          throw new Error('Título no encontrado en registros de Senescyt');
        }
        if (axiosError.response?.status === 401) {
          throw new Error('Error de autenticación con API de Senescyt');
        }
      }
      throw new Error('Error al validar título con Senescyt');
    }
  }

  /**
   * Valifica el título de un doctor y actualiza su estado
   */
  async validarDoctor(
    doctorId: string,
    cedula: string,
    numeroTitulo: string,
    codigoUniversidad: string
  ): Promise<ValidationStatus> {
    try {
      const response = await this.validateTitulo({
        cedula,
        numeroTitulo,
        codigoUniversidad
      });

      // Guardar el resultado en la base de datos
      const status: ValidationStatus = {
        doctorId,
        validado: response.validado && response.estado === 'ACTIVO',
        fechaValidacion: new Date(),
        respuesta: response
      };

      // Aquí se actualizaría la base de datos con Prisma
      // await prisma.doctor.update({
      //   where: { id: doctorId },
      //   data: {
      //     senescytValidado: status.validado,
      //     senescytFechaValidacion: status.fechaValidacion
      //   }
      // });

      return status;
    } catch (error) {
      throw new Error(`Error validando doctor: ${error.message}`);
    }
  }

  /**
   * Obtiene el estado de validación de un doctor
   */
  async getValidationStatus(doctorId: string): Promise<ValidationStatus | null> {
    // Aquí se consultaría la base de datos
    // const doctor = await prisma.doctor.findUnique({
    //   where: { id: doctorId },
    //   select: {
    //     id: true,
    //     senescytValidado: true,
    //     senescytFechaValidacion: true
    //   }
    // });

    return null; // Implementación placeholder
  }
}
```

### Paso 4.2: Crear rutas de Senescyt

```typescript
// apps/api/src/routes/v1/senescyt.routes.ts
import { Router, Request, Response } from 'express';
import { SenescytValidationService } from '../../services/senescyt/validation.service';
import { authMiddleware } from '../../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = Router();
const senescytService = new SenescytValidationService();

/**
 * @openapi
 * /senescyt/validar:
 *   post:
 *     summary: Validar título médico con Senescyt
 *     tags: [Senescyt]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/validar',
  authMiddleware,
  [
    body('cedula').notEmpty().isString(),
    body('numeroTitulo').notEmpty().isString(),
    body('codigoUniversidad').notEmpty().isString()
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { doctorId } = req.user;
      const { cedula, numeroTitulo, codigoUniversidad } = req.body;

      const result = await senescytService.validarDoctor(
        doctorId,
        cedula,
        numeroTitulo,
        codigoUniversidad
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @openapi
 * /senescyt/status:
 *   get:
 *     summary: Obtener estado de validación
 *     tags: [Senescyt]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/status',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { doctorId } = req.user;
      const status = await senescytService.getValidationStatus(doctorId);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
```

### Paso 4.3: Registrar rutas

**Archivo:** `apps/api/src/routes/v1/index.ts`

```typescript
import senescytRoutes from './senescyt.routes.js';

// Agregar al router:
router.use('/senescyt', senescytRoutes);
```

### Paso 4.4: Crear componente de validación

```vue
<!-- apps/web/src/components/senescyt/Validation.vue -->
<template>
  <v-card variant="outlined">
    <v-card-title>
      <v-icon icon="mdi-certificate" start />
      Validación Senescyt
      <v-spacer />
      <v-chip
        v-if="validationStatus"
        :color="validationStatus.validado ? 'success' : 'warning'"
        size="small"
      >
        {{ validationStatus.validado ? 'Validado' : 'Pendiente' }}
      </v-chip>
    </v-card-title>

    <v-card-text>
      <v-alert
        v-if="validationStatus?.validado"
        type="success"
        variant="tonal"
        class="mb-4"
      >
        Título validado exitosamente
      </v-alert>

      <v-form ref="form">
        <v-text-field
          v-model="formData.cedula"
          label="Cédula"
          variant="outlined"
          :rules="[v => !!v || 'Required']"
        />

        <v-text-field
          v-model="formData.numeroTitulo"
          label="Número de Título"
          variant="outlined"
          :rules="[v => !!v || 'Required']"
        />

        <v-select
          v-model="formData.codigoUniversidad"
          :items="universidades"
          label="Universidad"
          variant="outlined"
          :rules="[v => !!v || 'Required']"
        />

        <v-btn
          color="primary"
          block
          :loading="loading"
          @click="validarTitulo"
        >
          <v-icon start>mdi-check-circle</v-icon>
          Validar Título
        </v-btn>
      </v-form>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '@/composables/useApi';

const api = useApi();

const formData = ref({
  cedula: '',
  numeroTitulo: '',
  codigoUniversidad: ''
});

const validationStatus = ref(null);
const loading = ref(false);

const universidades = [
  { title: 'Universidad Central del Ecuador', value: 'UCE' },
  { title: 'Universidad de Guayaquil', value: 'UG' },
  { title: 'Universidad de las Américas', value: 'UDLA' },
  { title: 'Universidad San Francisco de Quito', value: 'USFQ' }
];

const validarTitulo = async () => {
  loading.value = true;
  try {
    const response = await api.post('/api/v1/senescyt/validar', formData.value);
    validationStatus.value = response.data;
  } catch (error) {
    console.error('Error validando título:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  try {
    const response = await api.get('/api/v1/senescyt/status');
    validationStatus.value = response.data;
  } catch (error) {
    console.error('Error cargando estado:', error);
  }
});
</script>
```

### Verificación Intermedia 4
```bash
# Verificar archivos creados
ls -la apps/api/src/services/senescyt/validation.service.ts
ls -la apps/api/src/routes/v1/senescyt.routes.ts
ls -la apps/web/src/components/senescyt/Validation.vue

# Type check
cd apps/api && npm run type-check
cd apps/web && npm run type-check
```

---

# VERIFICACIÓN FINAL

## Ejecutar todos los checks

```bash
# Type check completo
npm run type-check

# Linting
npm run lint

# Build
npm run build

# Tests (si existen)
npm run test
```

## Checklist Final

- [ ] TASK-046: SimpleInterconsultation.vue creado y ruta agregada
- [ ] TASK-024: Servicio GPS creado, rutas agregadas, useGPS actualizado
- [ ] TASK-050: Breakpoints y estilos responsive creados
- [ ] TASK-044C: Servicio Senescyt, rutas y componente creados
- [ ] Sin errores de TypeScript
- [ ] Build exitoso
- [ ] Todos los archivos nuevos están versionados

---

# NOTAS PARA QWEN CODER

1. **Orden de ejecución:** Implementar las tareas en orden (TASK-046 → TASK-024 → TASK-050 → TASK-044C)

2. **Dependencias:** Todas las dependencias están completadas según el backlog

3. **Conflictos:** Estas tareas están en diferentes fases, pero siempre verificar antes de sobrescribir archivos

4. **Testing:** Cada tarea incluye sus propias verificaciones intermedias

5. **Completitud:** Al finalizar cada tarea, marcarla como completada en el backlog

---

**Fin del Plan**
