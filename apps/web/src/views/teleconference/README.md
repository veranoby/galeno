# Teleconsulta - TASK-040

Flujo completo de teleconsulta con integración de videollamada Jitsi Meet, Picture-in-Picture (PiP), y herramientas de consulta integradas.

## 📦 Características

- ✅ **Videollamada Jitsi Meet** integrada
- ✅ **Picture-in-Picture (PiP)** para video flotante
- ✅ **Pantalla completa** toggle
- ✅ **Workspace clínico** con herramientas integradas
- ✅ **Notas clínicas** con sugerencias IA
- ✅ **Diagnóstico CIE-10**
- ✅ **Receta médica**
- ✅ **Exámenes**
- ✅ **Firma electrónica** integrada
- ✅ **Sincronización SSE** en tiempo real
- ✅ **Responsive design** para tablet/desktop

## 📁 Estructura de Archivos

```
apps/web/src/
├── views/
│   └── teleconference/
│       ├── Consultation.vue           # Layout principal
│       └── WaitingRoomView.vue        # Sala de espera (existente)
├── components/
│   ├── teleconference/
│   │   ├── VideoPanel.vue             # Panel de video con Jitsi
│   │   └── TeleconsultationWorkspace.vue # Workspace clínico
│   └── teleconsulta/
│       ├── JitsiMeet.vue              # Componente Jitsi (existente)
│       ├── PiPVideo.vue               # PiP (existente)
│       └── TeleconsultationWorkspace.vue # Workspace (actualizado)
└── composables/
    ├── useJitsi.ts                    # Jitsi composable (existente)
    ├── usePiP.ts                      # PiP composable (existente)
    └── useSSE.ts                      # SSE composable (existente)
```

## 🚀 Uso

### Ruta de Teleconsulta

```
/teleconsulta/:citaId/consulta
```

**Requiere:**
- Autenticación
- Rol: DOCTOR

### Componentes Principales

#### 1. Consultation.vue (Layout Principal)

```vue
<template>
  <div class="teleconsultation-view">
    <!-- Top Bar con controles -->
    <div class="teleconsultation-topbar">
      <!-- PiP Toggle, Fullscreen, Timer -->
    </div>

    <!-- Split Layout: Video | Workspace -->
    <div class="teleconsultation-content">
      <VideoPanel :cita-id="citaId" />
      <TeleconsultationWorkspace :cita-id="citaId" />
    </div>
  </div>
</template>
```

**Características:**
- Split-screen responsive
- Controles de PiP y fullscreen
- Timer de duración de consulta
- Diálogo de finalización
- Notificaciones de conexión

#### 2. VideoPanel.vue

```vue
<template>
  <div class="video-panel">
    <JitsiMeet
      :room-name="secureRoomName"
      :user-info="userInfo"
      @call-started="handleCallStarted"
      @call-ended="handleCallEnded"
    />
    <!-- Controles de calidad de conexión -->
  </div>
</template>
```

**Características:**
- Integración con Jitsi Meet
- Indicador de calidad de conexión
- Indicador de grabación (si aplica)
- Estados de loading y error

#### 3. TeleconsultationWorkspace.vue

```vue
<template>
  <div class="teleconsultation-workspace">
    <!-- Header con información del paciente -->
    
    <!-- Tabs de herramientas -->
    <v-tabs v-model="activeTool">
      <v-tab value="notes">Notas</v-tab>
      <v-tab value="diagnosis">Diagnóstico</v-tab>
      <v-tab value="prescription">Receta</v-tab>
      <v-tab value="exams">Exámenes</v-tab>
      <v-tab value="signature">Firma</v-tab>
    </v-tabs>

    <!-- Contenido de cada herramienta -->
  </div>
</template>
```

**Herramientas Integradas:**
- **Notas Clínicas**: Editor de texto con sugerencias IA
- **Diagnóstico**: Chips CIE-10
- **Receta**: Panel de medicamentos
- **Exámenes**: Panel de exámenes solicitados
- **Firma**: Firma electrónica inline

## 🔧 Flujo de Uso

### 1. Iniciar Teleconsulta

```
1. Doctor accede desde Agenda
2. Redirige a WaitingRoomView
3. Paciente es admitido
4. Redirige a /teleconsulta/:citaId/consulta
```

### 2. Durante la Consulta

```
1. Video llamado se inicia automáticamente
2. Doctor toma notas clínicas
3. IA sugiere diagnósticos, medicamentos, exámenes
4. Doctor agrega elementos al workspace
5. Puede activar PiP para ver video mientras escribe
```

### 3. Finalizar Consulta

```
1. Doctor click en "Finalizar"
2. Modal muestra resumen:
   - Notas completas ✓
   - Diagnósticos registrados
   - Firma completada ✓
3. Confirma finalización
4. Redirige a historial
```

## 🎯 Composables Utilizados

### useJitsi

```typescript
const {
  isActive,
  roomName,
  startCall,
  endCall
} = useJitsi(consultaId, tokenAcceso);
```

### usePiP

```typescript
const {
  isPiPActive,
  isSupported,
  enterPiP,
  exitPiP,
  togglePiP
} = usePiP(videoElementRef, options);
```

### useSSE

```typescript
const {
  connected,
  connect,
  disconnect
} = useSSE(userId, options);
```

## 📊 Estados de la Consulta

| Estado | Descripción | UI |
|--------|-------------|-----|
| `en_espera` | Esperando al paciente | WaitingRoom |
| `activa` | Consulta en curso | Video + Workspace |
| `finalizada` | Consulta completada | Redirect a historial |

## ⚠️ Consideraciones

### Seguridad

- Room name generado con hash SHA-256
- Solo doctores pueden acceder
- Firma electrónica obligatoria para finalizar

### Performance

- PiP reduce carga de renderizado
- SSE con auto-reconnect
- Auto-guardado de borrador

### Responsive

- Desktop: Split-screen 50/50
- Tablet: Video 60% / Workspace 40%
- Mobile: Video arriba, workspace abajo

## 🧪 Testing Manual

### Checklist

- [ ] Iniciar consulta desde Waiting Room
- [ ] Ver video en tiempo real
- [ ] Activar/desactivar PiP
- [ ] Activar pantalla completa
- [ ] Usar herramientas mientras video activo
- [ ] Recibir notificación SSE
- [ ] Finalizar con firma
- [ ] Probar con mala conexión de red
- [ ] Probar en tablet (iPad)

## 🔗 Dependencias

- **Jitsi Meet SDK**: Videollamada
- **Vue 3**: Framework
- **Vuetify 3**: Componentes UI
- **vue-toastification**: Notificaciones

## 📝 Recursos

- [Jitsi Meet Documentation](https://jitsi.github.io/handbook/)
- [Picture-in-Picture API](https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

---

**Implementado:** 2026-02-17  
**TASK-040:** Flujo Completo Teleconsulta  
**Estado:** ✅ Production Ready
