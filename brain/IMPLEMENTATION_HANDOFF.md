# GALENO - IMPLEMENTATION HANDOFF & DEEP TECHNICAL CONTEXT

Este documento es una **Cápsula de Memoria Técnica (Handoff)** diseñada específicamente para ser leída por Jules (o cualquier agente IA) al inicio de una nueva sesión. Contiene las sutilezas arquitectónicas, reglas de negocio y diseños profundos que fueron extraídos de la documentación original antes de su consolidación.

---

## 1. MÁQUINA DE ESTADOS DE CONSULTAS (0% Implementado - Prioridad Alta)

La gestión de la consulta médica no es un simple CRUD, sino una Máquina de Estados Estricta (State Machine) sincronizada en tiempo real mediante Server-Sent Events (SSE).

### 1.1 Estados Permitidos y Transiciones

1. **AGENDADA (Scheduled):** Estado inicial. El paciente separó el slot.
2. **EN_SALA_DE_ESPERA (Waiting):** El asistente/paciente confirma llegada.
   - _Trigger:_ Dispara evento SSE a la vista del doctor (`waiting_room_update`).
   - _Acción paralela:_ Inicia proceso de _Triage_ (si aplica) o pre-chequeo por enfermería.
3. **PREPARACION (Preparation - Oculta):** Signos vitales siendo tomados por asistente.
4. **EN_CONSULTA (In Progress):** El doctor llama al paciente.
   - _Trigger:_ Bloquea la edición de la historia clínica para otros, activa auto-guardado en IndexedDB.
   - _Acción:_ Activa IA Copilot en modo "escucha/sugerencia pasiva".
5. **FINALIZADA (Completed):**
   - _Trigger:_ Se procesa la Firma Electrónica (XAdES-BES en cliente). Se generan PDFs (Receta, Certificado).
   - _Post-condición:_ Cierra la edición. Genera XML para SRI si aplica pago.
6. **CANCELADA / NO_ASISTIO:** Libera el slot.

### 1.2 Implementación Requerida

- **Backend:** Crear patrón State en Prisma (`status Enum`). Crear interceptores/middlewares que eviten saltarse pasos (ej. no se puede pasar a FINALIZADA sin pasar por EN_CONSULTA).
- **Frontend:** UI reactiva. Componentes Vue/React deben suscribirse a `useSSE('/api/v1/sse/consultas')` y mutar la vista sin F5.

---

## 2. IA COPILOT Y "BRAIN" DEL DOCTOR (0% Implementado - Innovación Core)

### 2.1 Filosofía de Diseño

- **No Intrusivo:** El doctor odia los chatbots invasivos. La IA debe actuar como un residente invisible.
- **Costo Objetivo:** < $0.005 por consulta. Uso extremo de debouncing, embeddings cacheados y prompts deterministas cortos.

### 2.2 Funcionalidades a implementar

1. **Auto-completado médico (IA Brain):**
   - El sistema debe aprender (vía RAG o vector DB local) las prescripciones frecuentes del doctor para una patología X, sugiriendo el tratamiento completo con 1 click.
2. **Análisis de Interacciones:**
   - Durante la prescripción, cruzar medicamentos contra alergias registradas en los antecedentes usando LLM determinista (llamada a Gemini/OpenAI vía función rápida).
3. **Resumen de Historia (Copilot):**
   - Cuando el paciente entra `EN_CONSULTA`, la IA lee las últimas 3 visitas y genera un bullet-point de 3 líneas: _"Viene por X, última vez se recetó Y, vigilar Z"_.

---

## 3. HEALTH WALLET Y COMPLIANCE LOPDP (0% Implementado - Core Legal)

El paciente es el dueño absoluto de su dato. El doctor solo tiene _permiso de acceso_.

### 3.1 Arquitectura de Compartición (LOPDP Protocol)

- **Criptografía:** Los datos clínicos en la BD deben tener un mecanismo de acceso basado en tokens de consentimiento.
- **Flujo de Acceso:**
  1. Paciente nuevo llega al consultorio.
  2. Sistema genera un QR dinámico o enlace SMS/WhatsApp.
  3. Paciente aprueba desde su celular (Health Wallet).
  4. Esto emite un JWT/Token de delegación que permite al doctor desencriptar o leer la historia por un tiempo limitado (ej. 24h).
- **Audit Trail:** Cada vez que el doctor lee el antecedente, se guarda un registro inmutable en `AuditLog`: `[TIMESTAMP] Doctor X accedió a HC de Paciente Y (IP, Razón)`.

---

## 4. INTEGRACIÓN WHATSAPP Y NOTIFICACIONES (0% Implementado)

- **Arquitectura Asíncrona:** Nunca bloquear el thread de Node.js enviando mensajes. Usar colas (RabbitMQ/Redis BullMQ).
- **Casos de Uso:**
  1. Confirmación inmediata al agendar.
  2. Recordatorio 24h y 2h antes.
  3. Enlace de Health Wallet (LOPDP).
  4. Entrega de Receta Firmada (PDF + XML) post-consulta.
- **Fallback:** Si WhatsApp falla, intentar SMS. Si falla, Email.

---

## 5. MÓDULOS DE ESPECIALIDAD "OCULTOS" (Alto % Implementado, falta cableado)

Durante la auditoría se descubrieron carpetas (`odontograma`, `retina`, `crecimiento`).

- **Instrucción de Handoff:** Estos módulos de UI deben cargarse dinámicamente según el `specialty_id` del doctor autenticado.
- No cargar el paquete completo de odontograma en memoria si el doctor es pediatra (Lazy Loading en Frontend).
- La data generada (ej. coordenadas de dientes con caries) debe serializarse como JSONB en la tabla base de consultas, en un campo `specialty_metadata`.

---

## 6. INSTRUCCIONES PARA LA PRÓXIMA SESIÓN (Prompt de Arranque)

**Cuando leas este archivo, asume las siguientes reglas operativas:**

1. Lee `brain/prd_system.json` para contexto comercial y límites.
2. Trabaja funcionalidad por funcionalidad, priorizando **La Máquina de Estados de Consultas**.
3. Usa TDD (Test Driven Development) siempre que sea posible. Escribe el test de la transición de estado primero, luego implementa la lógica de prisma/rutas.
4. Recuerda que la infraestructura SSE es obligatoria para cambios de estado.
5. No toques lógica de firma XAdES-BES ni facturación SRI, eso ya está al 100% y es extremadamente frágil.
