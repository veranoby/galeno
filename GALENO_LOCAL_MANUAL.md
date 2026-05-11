# 📖 Guía de Ejecución Local - Proyecto Galeno

Sigue estos pasos para correr la plataforma Galeno en tu entorno de desarrollo.

## 🚀 Inicio Rápido

1.  **Requisitos:** Node.js v18+, PostgreSQL (local), Redis (local), pnpm.
2.  **Instalar dependencias:**
    ```bash
    pnpm install
    ```
3.  **Configurar DB:** Crea una base de datos `galeno_db` en tu Postgres local y asegúrate de que el usuario `galeno` tenga acceso.
4.  **Sincronizar Schema:**
    ```bash
    cd apps/api && npx prisma migrate dev
    ```
5.  **Ejecutar Plataforma:**
    ```bash
    pnpm dev
    ```

## 🛠️ Procedimientos según Perfil de Usuario

### 👤 Super Administrador (Admin Global)
1.  Inicia sesión en `http://localhost:5173/login` con las credenciales de Super Admin.
2.  Ve al módulo `/admin/dashboard`.
3.  Acciones: Gestión de usuarios, configuración de planes de suscripción y auditoría de logs globales.

### 🩺 Médico (Ecuador)
1.  Registrarse o iniciar sesión con el Dr. Andrade.
2.  Configurar consultorio físico o teleconsulta.
3.  Pagos de suscripción se procesan a través de la integración de PayPhone localmente (ambiente sandbox).

### 🩺 Médico (Internacional)
1.  Al detectar que el país es distinto a Ecuador, la plataforma activará automáticamente PayPal.
2.  Los precios de los planes se mostrarán en USD para evitar discrepancias.

### 🏥 Personal de Salud (Enfermería / Asistente)
1.  Ingresa con su cuenta asociada al médico.
2.  Acceso limitado: Solo puede realizar Triaje y Gestión de Citas. No puede firmar recetas ni ver historial sensible sin autorización explícita.

### 👤 Paciente
1.  Accede a su portal en `http://localhost:5173/portal-paciente`.
2.  Gestión de su Health Wallet, descarga de recetas y autorización de consentimiento LOPDP.

### 🏪 Farmacia
1.  Acceso a `http://localhost:5173/farmacia`.
2.  Validación de recetas vía escaneo de código QR del paciente.
