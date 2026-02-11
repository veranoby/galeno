# Galeno Design System

> Sistema de diseño para Ecuador-Health 360

## 📋 Índice

1. [Overview](#overview)
2. [Colores](#colores)
3. [Tipografía](#tipografía)
4. [Espaciado](#espaciado)
5. [Componentes](#componentes)
6. [Uso](#uso)

---

## Overview

El Design System de Galeno está basado en **Material Design 3** con adaptaciones para el sector médico ecuatoriano. Todos los componentes son consistentes, accesibles y fáciles de usar.

**Principios:**
- ✅ **Claridad**: Información clara y legible
- ✅ **Consistencia**: Mismo look & feel en toda la app
- ✅ **Accesibilidad**: WCAG 2.1 AA compliant
- ✅ **Eficiencia**: Flujos médicos optimizados

---

## Colores

### Colores Principales

| Color | Uso | Hex |
|-------|-----|-----|
| **Primary** | Acciones principales, navegación | `#1565C0` |
| **Secondary** | Acentos, salud | `#2E7D32` |
| **Accent** | CTAs, alertas | `#FF6F00` |

### IA Copilot Chips

| Tipo | Uso | Hex |
|------|-----|-----|
| **Azul** | Sugerencia IA (sin verificar) | `#1976D2` |
| **Verde** | Verificado por humano | `#43A047` |
| **Amarillo** | Requiere atención | `#F57C00` |
| **Rojo** | Contradice/Necesita revisión | `#C62828` |

### Colores de Estado

| Estado | Color | Hex |
|--------|-------|-----|
| Pendiente | Warning | `#F57C00` |
| Confirmada | Success | `#43A047` |
| Completada | Info | `#1976D2` |
| Cancelada | Error | `#C62828` |

---

## Tipografía

### Font Families

```scss
font-family-base: 'Roboto', sans-serif;       // UI general
font-family-heading: 'Roboto', sans-serif;    // Títulos
font-family-medical: 'Open Sans', sans-serif; // Textos largos
font-family-mono: 'Roboto Mono', monospace;   // Datos técnicos
```

### Escala Tipográfica

| Tamaño | Rem | Px | Uso |
|--------|-----|----|-----|
| xs | 0.75rem | 12px | Labels pequeños |
| sm | 0.875rem | 14px | Body text |
| base | 1rem | 16px | Body default |
| lg | 1.125rem | 18px | Subtítulos |
| xl | 1.25rem | 20px | Títulos pequeños |
| 2xl | 1.5rem | 24px | Secciones |
| 3xl | 1.875rem | 30px | Page titles |
| 4xl | 2.25rem | 36px | Hero titles |
| 5xl | 3rem | 48px | Display |

---

## Espaciado

### Sistema 4px Grid

```scss
$spacing-1: 0.25rem;  // 4px
$spacing-2: 0.5rem;   // 8px
$spacing-3: 0.75rem;  // 12px
$spacing-4: 1rem;     // 16px
$spacing-6: 1.5rem;   // 24px
$spacing-8: 2rem;     // 32px
$spacing-12: 3rem;    // 48px
```

**Uso recomendado:**
- `spacing-2`: Padding compacto
- `spacing-4`: Padding estándar
- `spacing-6`: Separación entre secciones
- `spacing-8`: Márgenes grandes

---

## Componentes

### Componentes Base

| Componente | Descripción | Props |
|------------|-------------|-------|
| `AppButton` | Botón con loading state | color, variant, size |
| `AppInput` | Input con validación | rules, errorMessages |
| `AppSelect` | Select con chips | items, multiple, chips |
| `AppDatePicker` | DatePicker médico | min, max, format |
| `AppCard` | Tarjeta reutilizable | title, subtitle, loading |
| `ConfirmDialog` | Diálogo de confirmación | title, message, onConfirm |
| `AppAppBar` | Barra de navegación | title, navClick, actions |
| `AppNavDrawer` | Menú lateral | items, modelValue |
| `AppStatusBadge` | Badge de estado | status (pendiente, confirmada, etc.) |
| `IaChip` | Chip IA Copilot | tipo (azul, verde, amarillo, rojo), confidence |

### Layout

| Componente | Dimensiones |
|------------|-------------|
| AppBar | 64px (56px mobile) |
| NavDrawer | 280px (72px mini) |
| Container Max-width | 1280px |

---

## Uso

### En tu aplicación Vue

```vue
<script setup lang="ts">
import {
  AppButton,
  AppInput,
  AppCard,
  IaChip,
  vuetify
} from '@galeno/ui-components';

// Configurar Vuetify con tema Galeno
import { vuetify } from '@galeno/ui-components';
</script>

<template>
  <v-app>
    <AppAppBar title="Galeno" @nav-click="drawer = true" />

    <AppCard title="Paciente" subtitle="Información básica">
      <AppInput
        v-model="paciente.nombre"
        label="Nombre completo"
        :rules="[(v) => !!v || 'Campo requerido']"
      />
    </AppCard>

    <IaChip
      tipo="azul"
      text="Hipertensión arterial"
      :confidence="0.92"
    />
  </v-app>
</template>
```

### Tokens de diseño

```typescript
import { designTokens } from '@galeno/ui-components';

// Colores
designTokens.colors.primary.base;
designTokens.colors.status.error;

// Espaciado
designTokens.spacing[4]; // '1rem'

// Tipografía
designTokens.typography.fontSize.base;
```

---

## Accesibilidad

- ✅ Contraste mínimo WCAG AA (4.5:1)
- ✅ Focus visible en todos los elementos interactivos
- ✅ Labels descriptivos en formularios
- ✅ Error messages claros
- ✅ Soporte de lector de pantalla

---

## Referencias

- [Material Design 3](https://m3.material.io/)
- [Vuetify 3 Documentation](https://vuetifyjs.com/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Última actualización:** 2026-02-11
**Versión:** 1.0
