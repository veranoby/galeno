# Especialidades Médicas - Documentación Técnica

## Visión General

El sistema de especialidades médicas de Galeno permite configurar herramientas y características específicas para cada especialidad médica. Cada especialidad tiene:

- **Herramientas**: Configuración de herramientas clínicas disponibles
- **Características**: Features habilitados (teleconsulta, interconsultas, etc.)
- **Metadatos**: Información de versión y autoría

## Modelos de Datos

### Especialidad

```prisma
model Especialidad {
  id          String   @id @default(uuid())
  nombre      String   @unique
  nombreCorto String   @unique
  herramientas Json
  activo      Boolean  @default(true)
  createdAt   DateTime @default(now())

  doctors     DoctorEspecialidad[]

  @@index([nombre])
  @@map("especialidades")
}
```

**Campos:**
- `nombre`: Nombre completo de la especialidad (ej: "Medicina General")
- `nombreCorto`: Identificador único (ej: "medicina-general")
- `herramientas`: JSON con configuración de herramientas y features
- `activo`: Estado de la especialidad

### DoctorEspecialidad

```prisma
model DoctorEspecialidad {
  id                String   @id @default(uuid())
  doctorId          String
  especialidadId    String
  principal         Boolean  @default(false)
  senescytValidada  Boolean  @default(false)
  createdAt         DateTime @default(now())

  doctor         Cuenta
  especialidad   Especialidad

  @@index([doctorId])
  @@index([especialidadId])
  @@map("doctor_especialidades")
}
```

**Campos:**
- `doctorId`: Referencia al doctor
- `especialidadId`: Referencia a la especialidad
- `principal`: Indica si es la especialidad principal del doctor
- `senescytValidada`: Validación del título por SENESCYT

## Estructura de Herramientas

### Schema Zod

```typescript
const SpecialtyConfigSchema = z.object({
  tools: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    category: z.enum(['diagnostic', 'monitoring', 'imaging', 'procedure', 'education', 'admin']),
    enabled: z.boolean(),
    required: z.boolean(),
    order: z.number(),
    config: z.record(z.unknown()).optional()
  })),
  features: z.object({
    teleconsulta: z.boolean(),
    interconsultas: z.boolean(),
    recetasDigitales: z.boolean(),
    examenesDigitales: z.boolean(),
    certificadosDigitales: z.boolean(),
    historiaClinicaAvanzada: z.boolean(),
    iaAsistente: z.boolean()
  }),
  metadata: z.object({
    version: z.string(),
    lastUpdated: z.string().datetime().optional(),
    author: z.string().optional()
  }).optional()
});
```

### Categorías de Herramientas

| Categoría | Descripción | Ejemplos |
|-----------|-------------|----------|
| `diagnostic` | Herramientas de diagnóstico | Estetoscopio, ECG, Tabla de optotipos |
| `monitoring` | Monitoreo de pacientes | Tensiómetro, Curvas de crecimiento |
| `imaging` | Imágenes médicas | Rayos X, Ecocardiograma |
| `procedure` | Procedimientos | Artroscopio |
| `education` | Educación y referencia | Atlas de lesiones |
| `admin` | Administración | Calculadoras |

## Especialidades Disponibles

### 1. Medicina General (`medicina-general`)

**Herramientas:**
- `estetoscopio` - Estetoscopio Digital (requerido)
- `tensiometro` - Tensiómetro (requerido)
- `termometro` - Termómetro Digital (requerido)
- `glucometro` - Glucómetro
- `calculadora-imc` - Calculadora IMC

**Features habilitados:**
- ✅ Teleconsulta
- ✅ Interconsultas
- ✅ Recetas digitales
- ✅ Exámenes digitales
- ✅ Certificados digitales
- ✅ IA Asistente

### 2. Pediatría (`pediatria`)

**Herramientas:**
- `curvas-crecimiento` - Curvas de Crecimiento OMS (requerido)
- `vacunacion` - Esquema de Vacunación PAI (requerido)
- `calculadora-dosis` - Calculadora de Dosis Pediátrica (requerido)
- `estetoscopio-pediatrico` - Estetoscopio Pediátrico
- `oximetro-pediatrico` - Oxímetro Pediátrico

**Features habilitados:**
- ✅ Teleconsulta
- ✅ Interconsultas
- ✅ Recetas digitales
- ✅ Exámenes digitales
- ✅ Certificados digitales
- ✅ Historia clínica avanzada
- ✅ IA Asistente

### 3. Odontología (`odontologia`)

**Herramientas:**
- `odontograma` - Odontograma Digital (requerido)
- `radiografia-dental` - Radiografía Dental (requerido)
- `periodontograma` - Periodontograma
- `camara-intraoral` - Cámara Intraoral

**Features habilitados:**
- ❌ Teleconsulta
- ✅ Interconsultas
- ✅ Recetas digitales
- ✅ Exámenes digitales
- ✅ Certificados digitales
- ✅ Historia clínica avanzada
- ❌ IA Asistente

### 4. Cardiología (`cardiologia`)

**Herramientas:**
- `ecg` - Electrocardiógrafo (requerido)
- `ecocardiograma` - Ecocardiograma (requerido)
- `holter` - Holter de Ritmo 24h
- `mapa` - MAPA (Monitoreo ambulatorio de presión arterial)
- `prueba-esfuerzo` - Prueba de Esfuerzo

**Features habilitados:**
- ✅ Teleconsulta
- ✅ Interconsultas
- ✅ Recetas digitales
- ✅ Exámenes digitales
- ✅ Certificados digitales
- ✅ Historia clínica avanzada
- ✅ IA Asistente

### 5. Oftalmología (`oftalmologia`)

**Herramientas:**
- `tabla-optotipos` - Tabla de Optotipos (requerido)
- `retina-atlas` - Atlas de Retina
- `tonometria` - Tonómetro (requerido)
- `lampara-hendidura` - Lámpara de Hendidura (requerido)
- `fondo-ojo` - Fondo de Ojo / Retinografía

**Features habilitados:**
- ✅ Teleconsulta
- ✅ Interconsultas
- ✅ Recetas digitales
- ✅ Exámenes digitales
- ✅ Certificados digitales
- ✅ Historia clínica avanzada
- ❌ IA Asistente

### 6. Dermatología (`dermatologia`)

**Herramientas:**
- `dermatoscopio` - Dermatoscopio Digital (requerido)
- `atlas-lesiones` - Atlas de Lesiones
- `camara-dermatologica` - Cámara Dermatológica (requerido)
- `luz-wood` - Lámpara de Wood

**Features habilitados:**
- ✅ Teleconsulta
- ✅ Interconsultas
- ✅ Recetas digitales
- ✅ Exámenes digitales
- ✅ Certificados digitales
- ✅ Historia clínica avanzada
- ✅ IA Asistente

### 7. Traumatología (`traumatologia`)

**Herramientas:**
- `rayos-x` - Rayos X (requerido)
- `artroscopio` - Artroscopio
- `resonancia-magnetica` - Resonancia Magnética
- `tomografia` - Tomografía Computarizada
- `densitometria` - Densitometría Ósea

**Features habilitados:**
- ❌ Teleconsulta
- ✅ Interconsultas
- ✅ Recetas digitales
- ✅ Exámenes digitales
- ✅ Certificados digitales
- ✅ Historia clínica avanzada
- ❌ IA Asistente

## Uso del Servicio

### Importar el Servicio

```typescript
import {
  getSpecialtyConfig,
  getSpecialtyConfigByShortName,
  getSpecialtyTools,
  isSpecialtyFeatureEnabled,
  getAllActiveSpecialties
} from '@/services/specialty';
```

### Obtener Configuración por ID

```typescript
const config = await getSpecialtyConfig('especialidad-id');
if (config) {
  console.log(config.tools); // Array de herramientas
  console.log(config.features.teleconsulta); // boolean
}
```

### Obtener Configuración por Nombre Corto

```typescript
const config = await getSpecialtyConfigByShortName('pediatria');
```

### Verificar Feature Habilitado

```typescript
const hasTeleconsulta = await isSpecialtyFeatureEnabled(
  'especialidad-id',
  'teleconsulta'
);
```

### Obtener Herramienta Específica

```typescript
import { getToolConfig } from '@/services/specialty';

const tool = await getToolConfig('especialidad-id', 'estetoscopio');
if (tool?.enabled) {
  // Usar herramienta
}
```

### Obtener Especialidad Principal del Doctor

```typescript
import { getDoctorPrimarySpecialty } from '@/services/specialty';

const config = await getDoctorPrimarySpecialty('doctor-id');
```

## Cache Layer

El servicio implementa cache en dos niveles:

1. **Memory Cache**: Cache en memoria para acceso ultra-rápido
2. **Redis Cache**: Cache distribuido para múltiples instancias

**TTL:** 1 hora (3600 segundos)

### Invalidar Cache

```typescript
// Invalidar cache de una especialidad
await invalidateSpecialtyCache('especialidad-id');

// Invalidar todas las caches
await invalidateAllSpecialtyCaches();
```

## Seed Data

Para poblar la base de datos con especialidades básicas:

```bash
pnpm prisma:seed
```

El seed incluye:
- 7 especialidades médicas con configuraciones completas
- Usuarios de prueba vinculados a especialidades
- Datos de ejemplo para desarrollo

## Agregar Nueva Especialidad

### 1. Definir Configuración

```typescript
// src/services/specialty/seed-data.ts
const nuevaEspecialidadConfig: SpecialtyConfig = {
  tools: [
    {
      id: 'herramienta-1',
      name: 'Nombre Herramienta',
      category: TOOL_CATEGORIES.DIAGNOSTIC,
      enabled: true,
      required: true,
      order: 1
    }
  ],
  features: {
    teleconsulta: true,
    interconsultas: true,
    recetasDigitales: true,
    examenesDigitales: true,
    certificadosDigitales: true,
    historiaClinicaAvanzada: false,
    iaAsistente: false
  },
  metadata: {
    version: '1.0.0'
  }
};
```

### 2. Agregar al Seed Data

```typescript
export const specialtySeedData = [
  // ... especialidades existentes
  {
    nombre: 'Nueva Especialidad',
    nombreCorto: 'nueva-especialidad',
    herramientas: nuevaEspecialidadConfig
  }
];
```

### 3. Ejecutar Seed

```bash
pnpm prisma:seed
```

## Consideraciones de Seguridad

1. **Validación Zod**: Todo JSON de herramientas se valida con schemas Zod
2. **Tipado Seguro**: Uso de `Prisma.EspecialidadGetPayload` para tipos
3. **Sin `any`**: El código no usa tipos `any`
4. **Cache Seguro**: Memory cache como fallback si Redis falla

## Rendimiento

- **Índices**: Schema incluye índices en `nombre` y `nombreCorto`
- **Cache**: Doble capa (Memory + Redis) para reducir queries a DB
- **Lazy Loading**: Configuración se carga bajo demanda

## Archivos del Servicio

```
apps/api/src/services/specialty/
├── types.ts        # Tipos y schemas Zod
├── config.ts       # Servicio principal con cache
├── seed-data.ts    # Datos iniciales
└── index.ts        # Export público
```
