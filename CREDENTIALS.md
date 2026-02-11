# Credenciales de Desarrollo - Galeno (Ecuador-Health 360)

> ⚠️ **IMPORTANTE:** Este archivo contiene credenciales de DESARROLLO LOCAL.
> Para producción, usar variables de entorno en el servidor (nunca commitear).

---

## Base de Datos Local (PostgreSQL)

### Conexión

| Parámetro | Valor |
|-----------|-------|
| **Host** | 127.0.0.1 |
| **Port** | 5433 |
| **Database** | galeno_db |
| **Usuario** | galeno_dev |
| **Contraseña** | galeno_dev_pass_2025 |
| **Schema** | public |
| **URL de conexión** | `postgresql://galeno_dev:galeno_dev_pass_2025@127.0.0.1:5433/galeno_db` |

### Crear Base de Datos (Primera vez)

```sql
-- Conectar como postgres
psql -U postgres -h 127.0.0.1 -p 5433

-- Crear usuario
CREATE USER galeno_dev WITH PASSWORD 'galeno_dev_pass_2025';

-- Crear base de datos
CREATE DATABASE galeno_db OWNER galeno_dev;

-- Conceder privilegios
GRANT ALL PRIVILEGES ON DATABASE galeno_db TO galeno_dev;

-- Conectar a la base y crear extensión
\c galeno_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para full-text search
```

### Comandos Útiles

```bash
# Conectar a la base
psql -U galeno_dev -h 127.0.0.1 -p 5433 -d galeno_db

# Ver conexiones activas
psql -U galeno_dev -h 127.0.0.1 -p 5433 -d galeno_db -c "SELECT * FROM pg_stat_activity WHERE datname = 'galeno_db';"

# Matar conexiones bloqueantes
psql -U postgres -h 127.0.0.1 -p 5433 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'galeno_db' AND pid <> pg_backend_pid();"

# Backup
pg_dump -U galeno_dev -h 127.0.0.1 -p 5433 galeno_db > backup_galeno_$(date +%Y%m%d).sql

# Restore
psql -U galeno_dev -h 127.0.0.1 -p 5433 galeno_db < backup_galeno_20250210.sql
```

---

## Redis Local

### Conexión

| Parámetro | Valor |
|-----------|-------|
| **Host** | 127.0.0.1 |
| **Port** | 6380 |
| **Password** | (sin password para desarrollo) |
| **DB** | 0 |
| **URL de conexión** | `redis://127.0.0.1:6380` |

### Comandos Útiles

```bash
# Iniciar Redis (si no está corriendo)
redis-server --port 6380

# Conectar CLI
redis-cli -p 6380

# Ver todas las keys de Galeno
redis-cli -p 6380 KEYS "galeno:*"

# Limpiar cache de Galeno
redis-cli -p 6380 --scan --pattern "galeno:*" | xargs redis-cli -p 6380 DEL

# Ver info de memoria
redis-cli -p 6380 INFO memory
```

---

## Usuarios de Prueba (Aplicación)

| Rol | Username | Email | Contraseña | Plan |
|-----|----------|-------|------------|------|
| **Doctor FREE** | `doctor_free` | doctor@free.dev | `DoctorFree123` | FREE |
| **Doctor PREMIUM** | `doctor_premium` | doctor@premium.dev | `DoctorPrem123` | PREMIUM |
| **Paciente Test** | `paciente_test` | paciente@test.dev | `Paciente123` | - |
| **Enfermera Test** | `enfermera_test` | enfermera@test.dev | `Enfermera123` | - |
| **Admin Sistema** | `admin_galeno` | admin@galeno.dev | `AdminGaleno123` | ADMIN |

### Script de Seed (Prisma)

```bash
# Ejecutar seed
cd apps/api
npx prisma db seed
```

---

## API Keys (Servicios Externos)

### Google Gemini IA (Desarrollo)

```
API Key: (obtener de https://aistudio.google.com/app/apikey)
Modelo: gemini-1.5-flash
Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent
```

### Google Maps API (Opcional - Fase 2)

```
API Key: (obtener de Google Cloud Console)
Endpoints: Maps JavaScript API, Places API, Geocoding API
```

### Jitsi Meet (Open Source)

```
URL Base: https://meet.jit.si/
Formato Sala: meet.jit.si/EcuadorHealth-Cita-{consulta_id}-{token}
Sin API Key requerida (open source)
```

### SRI (Servicio de Rentas Internas)

```
Ambiente: Pruebas (Sandbox)
URL: (definir según documentación SRI)
Certificado: .p12 local del doctor
```

---

## JWT Secrets (Desarrollo)

```
ACCESS_TOKEN_SECRET=galeno_access_secret_dev_2025_change_in_prod
REFRESH_TOKEN_SECRET=galeno_refresh_secret_dev_2025_change_in_prod
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
```

---

## Variables de Entorno (.env.example)

```bash
# ============= DATABASE =============
DATABASE_URL="postgresql://galeno_dev:galeno_dev_pass_2025@127.0.0.1:5433/galeno_db"
DIRECT_URL="postgresql://galeno_dev:galeno_dev_pass_2025@127.0.0.1:5433/galeno_db"

# ============= REDIS =============
REDIS_URL="redis://127.0.0.1:6380"

# ============= JWT =============
JWT_ACCESS_SECRET="galeno_access_secret_dev_2025_change_in_prod"
JWT_REFRESH_SECRET="galeno_refresh_secret_dev_2025_change_in_prod"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# ============= AI (GEMINI) =============
GEMINI_API_KEY="your_gemini_api_key_here"

# ============= GOOGLE MAPS (Opcional) =============
GOOGLE_MAPS_API_KEY="your_google_maps_key_here"

# ============= SRI =============
SRI_ENVIRONMENT="sandbox"
SRI_API_URL="https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantes?wsdl"

# ============= PAYMENT GATEWAYS =============
PAYPHONE_CLIENT_ID="your_payphone_client_id"
PAYPHONE_CLIENT_SECRET="your_payphone_client_secret"
KUSHKI_API_KEY="your_kushki_api_key"

# ============= WEBRTC (Opcional - Módulo) =============
JITSI_DOMAIN="meet.jit.si"
TURN_SERVER_URL="" (opcional, para WebRTC Pro)

# ============= APP =============
APP_URL="http://localhost:5173"
API_URL="http://localhost:3000"
NODE_ENV="development"

# ============= CORS =============
ALLOWED_ORIGINS="http://localhost:5173,http://localhost:3000"
```

---

## Notas Importantes

1. **Port 5433 vs 5432:** Se usa puerto 5433 para no conflictuar con el proyecto `sports-bets` que usa 5432.

2. **Port 6380 vs 6379:** Se usa puerto 6380 para Redis para no conflictuar con otras instancias.

3. **Nunca commitear `.env`:** El archivo `.env` debe estar en `.gitignore`.

4. **Para producción:** Usar secretos management (Vercel env vars, Railway env, AWS Secrets Manager, etc.).

---

## 🚀 REFERENCIA: Servidor de Producción (Futuro)

> ⚠️ **NOTA:** Esta sección es SOLO REFERENCIA para cuando Galeno se despliegue en producción.
> El servidor Hetzner actualmente aloja el proyecto `sports-bets` (galleros.net).
> **NO hacer deploy de Galeno aún.**

### Servidor Hetzner (Compartido con sports-bets)

| Parámetro | Valor |
|-----------|-------|
| **Provider** | Hetzner |
| **Server Type** | AX42 Dedicated |
| **IP** | 136.243.174.157 |
| **SSH User** | root |
| **SSH Key** | ~/.ssh/id_ed25519 |
| **SSH Command** | `ssh -i ~/.ssh/id_ed25519 root@136.243.174.157` |
| **Remote Path (futuro)** | `/var/www/galeno.ec` |
| **Deployment Script** | `scripts/deploy-production.sh` (por crear) |

### Base de Datos Producción (Referencia)

| Parámetro | Valor (Referencia) |
|-----------|-------------------|
| **Type** | PostgreSQL |
| **Version** | 16.11 |
| **Host** | localhost (desde servidor) |
| **Port** | 5432 |
| **Database** | galeno_db (por crear) |
| **Application User** | galeno_app (por crear) |
| **System User** | admin_system (por crear) |

#### Escenarios de Acceso a BD (Producción)

**Scenario 1: DENTRO del servidor (vía SSH previo)**
```bash
# Primero: SSH al servidor
ssh -i ~/.ssh/id_ed25519 root@136.243.174.157

# Luego: Conectar a PostgreSQL
PGPASSWORD='password_prod' psql -h localhost -p 5432 -U admin_system -d galeno_db
```

**Scenario 2: Desde máquina local (SSH tunnel)**
```bash
# Ejecutar comando SQL vía SSH remoto
ssh -i ~/.ssh/id_ed25519 root@136.243.174.157 "sudo -u postgres psql -h localhost -p 5432 -d galeno_db -c 'SELECT * FROM users;'"
```

### Runtime (Referencia)

| Componente | Valor |
|------------|-------|
| **Node Manager** | NVM |
| **Process Manager** | PM2 |
| **Backend Port** | 3001 (por definir para Galeno) |
| **PM2 Config** | `/var/www/galeno.ec/ecosystem.config.js` |
| **Restart Command** | `pm2 reload ecosystem.config.js --env production` |

### Nginx (Referencia)

| Configuración | Ubicación |
|---------------|-----------|
| **Main Config** | `/etc/nginx/nginx.conf` |
| **Sites Available** | `/etc/nginx/sites-available/galeno.ec` |
| **Sites Enabled** | `/etc/nginx/sites-enabled/galeno.ec` |
| **Reload Command** | `nginx -t && nginx -s reload` |
| **Backup Command** | `cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak-$(date +%Y%m%d-%H%M%S)` |

### Redis (Referencia)

| Parámetro | Valor |
|-----------|-------|
| **Host** | localhost |
| **Port** | 6379 |
| **Connection Pool** | max 50 connections |
| **Cache TTLs** | Sesiones: 86400s, IA Brain: 86400s |

### Backups (Referencia)

| Configuración | Valor |
|---------------|-------|
| **Directory** | `/var/backups/galeno` |
| **Retention** | 10 backups |
| **Schedule** | On deploy |

### Flujo de Deploy (Referencia - 10 fases)

```
1. Pre-flight checks (git status, SSH, disk space)
2. Local build (backend + frontend)
3. Database backup (automatic, 10 retained)
4. File sync preview (dry-run)
5. File sync (rsync with delete)
6. Remote operations (npm ci --production)
7. Database migrations (Prisma o SQL directo)
8. PM2 restart (zero-downtime reload)
9. Health checks (API, DB, Redis)
10. Deployment report (deployments/*.log)
```

### Flags de Deploy (Referencia)

| Flag | Descripción |
|------|-------------|
| `--dry-run` | Preview cambios sin ejecutar |
| `--skip-migrations` | Saltar fase de migraciones |
| `--skip-tests` | Saltar ejecución de tests |
| `--skip-backup` | Saltar backup de BD |
| `--force` | Saltar confirmaciones |

### Health Checks (Referencia)

```bash
# API
curl https://galeno.ec/api/health

# Database (desde servidor)
PGPASSWORD='***' psql -h localhost -U galeno_app -d galeno_db -c 'SELECT 1'

# Redis
redis-cli ping

# PM2 status
pm2 status
pm2 logs galeno-backend --lines 50
```

### Operaciones Útiles (Referencia)

```bash
# Ver logs de aplicación
ssh -i ~/.ssh/id_ed25519 root@136.243.174.157 "pm2 logs galeno-backend"

# Monitorear en tiempo real
ssh -i ~/.ssh/id_ed25519 root@136.243.174.157 "pm2 monit"

# Ver uso de disco
ssh -i ~/.ssh/id_ed25519 root@136.243.174.157 "df -h"

# Ver conexiones a BD
ssh -i ~/.ssh/id_ed25519 root@136.243.174.157 "psql -U postgres -c 'SELECT * FROM pg_stat_activity;'"

# Restart aplicación
ssh -i ~/.ssh/id_ed25519 root@136.243.174.157 "cd /var/www/galeno.ec && pm2 reload ecosystem.config.js --env production"
```

### Secrets Management (Referencia)

```bash
# Generar nuevos secrets
openssl rand -hex 32   # Para STREAM_SECRET_KEY
openssl rand -base64 32 # Para JWT_SECRET
openssl rand -hex 16   # Para API keys

# Almacenamiento
# - Producción: /var/www/galeno.ec/backend/.env
# - Backup: Gestor de contraseñas externo (1Password, Bitwarden)
# - Rotación recomendada: Cada 90 días
```

### Compatibilidad con Sports-Bets

| Recurso | Sports-Bets | Galeno (Futuro) |
|---------|-------------|-----------------|
| **Servidor** | 136.243.174.157 | 136.243.174.157 (compartido) |
| **DB Port** | 5432 | 5432 (mismo) |
| **Redis Port** | 6379 | 6379 (mismo) |
| **Remote Path** | /var/www/galleros.net | /var/www/galeno.ec |
| **PM2 App Name** | galleros-backend | galeno-backend |
| **Domain** | galleros.net | galeno.ec (por definir) |

---

**Última actualización:** 2026-02-10
**Versión:** 1.1
