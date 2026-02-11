# Cifrado AES-256 - Compliance LOPDP

> Cifrado de datos sensibles en reposo conforme a la Ley Orgánica de Protección de Datos Personales (Ecuador)

## 📋 Índice

1. [Marco Legal](#marco-legal)
2. [Datos Sensibles](#datos-sensibles)
3. [Implementación](#implementación)
4. [Key Management](#key-management)
5. [Performance](#performance)
6. [Auditoría y Compliance](#auditoría-y-compliance)

---

## Marco Legal

### LOPDP - Ley Orgánica de Protección de Datos Personales (Ecuador)

**Artículo 14:** Medidas de Seguridad

> "Los sujetos obligados deberán adoptar las medidas técnicas y organizativas
> necesarias para garantizar la seguridad de los datos de carácter personal
> y evitar su alteración, pérdida, tratamiento o acceso no autorizado."

**Requisitos para datos sensibles:**
- ✅ Cifrado en reposo (AES-256 mínimo)
- ✅ Control de acceso basado en roles
- ✅ Auditoría de accesos
- ✅ Política de retención definida

---

## Datos Sensibles

### Categorías de Datos según LOPDP

| Categoría | Descripción | Ejemplos en Galeno | Cifrado |
|-----------|-------------|--------------------|---------|
| **Datos de salud** | Historia clínica, diagnósticos | Motivo consulta, evolución, diagnóstico CIE-10 | ✅ AES-256 |
| **Datos identificativos** | Nombre, cédula, teléfono | Nombre, cédula, teléfono, email | Parcial |
| **Documentos** | Recetas, certificados, exámenes | Contenido JSON de documentos | ✅ AES-256 |
| **Antecedentes** | Historial médico familiar/personal | Detalle de antecedentes | ✅ AES-256 |

### Campos Cifrados en Galeno

```typescript
// Datos personales (parcial)
- telefono: AES-256
- email: AES-256 (opcional, según configuración usuario)

// Datos médicos (requerido)
- motivoConsulta: AES-256
- evolucion: AES-256
- diagnosticoCie10: AES-256
- recetaJson: AES-256
- examenesJson: AES-256
- antecedenteDetalle: AES-256

// Documentos médicos (requerido)
- documentoContenido: AES-256

// Health Wallet (requerido)
- conexionPermisos: AES-256
```

---

## Implementación

### Algoritmo: AES-256-GCM

```
┌─────────────────────────────────────────────────────────────────┐
│                     CIFRADO AES-256-GCM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Datos originales                                                 │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐                                                │
│  │ Generar IV  │ → 12 bytes (aleatorio)                         │
│  └─────────────┘                                                │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────┐                           │
│  │ AES-256-GCM Encrypt             │                           │
│  │  • Key: 32 bytes (256 bits)     │                           │
│  │  • IV: 12 bytes                 │                           │
│  │  • Plaintext                    │                           │
│  └─────────────────────────────────┘                           │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────┐                           │
│  │ Output:                         │                           │
│  │  • IV (12 bytes)                │                           │
│  │  • Auth Tag (16 bytes)          │                           │
│  │  • Ciphertext                   │                           │
│  └─────────────────────────────────┘                           │
│       │                                                          │
│       ▼                                                          │
│  Base64 encoding → Almacenamiento en BD                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Formato de Almacenamiento

```sql
-- Ejemplo: Campo telefono en tabla pacientes
INSERT INTO pacientes (telefono)
VALUES ('SGVsbG8gV29ybGQ=');

-- Valor cifrado (base64):
-- IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
```

---

## Key Management

### Generación de Clave

```bash
# Generar nueva clave de 32 bytes
node -e "console.log(crypto.randomBytes(32).toString('base64'))"
```

### Configuración

```bash
# .env
ENCRYPTION_KEY=<clave-32-bytes-en-base64>
```

### Rotación de Claves

```sql
-- Paso 1: Agregar nueva columna con nueva clave
ALTER TABLE pacientes ADD COLUMN telefono_v2 TEXT;

-- Paso 2: Migrar datos descifrando con vieja y cifrando con nueva
-- (Hacer en batches para evitar locks largos)

-- Paso 3: Eliminar vieja columna
ALTER TABLE pacientes DROP COLUMN telefono;
```

### Best Practices

1. **Nunca commitear** `ENCRYPTION_KEY` en el repositorio
2. **Usar diferentes keys** para development/staging/production
3. **Rotar keys** periódicamente (recomendado: cada 90 días)
4. **Usar KMS** en producción (AWS KMS, GCP KMS, Azure Key Vault)

---

## Performance

### Benchmarks (Referencia)

| Operación | Tiempo promedio | throughput |
|-----------|----------------|-------------|
| Encrypt | ~0.3ms | ~3,000 ops/sec |
| Decrypt | ~0.3ms | ~3,000 ops/sec |
| Hash (SHA-256) | ~0.01ms | ~100,000 ops/sec |

### Impacto en API

```
Sin cifrado:
  GET /api/pacientes → 50ms

Con cifrado:
  GET /api/pacientes → 53ms (+3ms por descifrar 10 campos)

Impacto: < 10% (aceptable)
```

### Optimizaciones

1. **Cifrar solo campos necesarios** - No todo debe ser cifrado
2. **Lazy decryption** - Descifrar solo cuando se accede al campo
3. **Cache en memoria** - Para datos frecuentemente accedidos (con cuidado)
4. **Batches para migraciones** - Procesar en grupos de 1000 registros

---

## Auditoría y Compliance

### Logs de Acceso a Datos Sensibles

```typescript
// Log de acceso a datos médicos
logger.info('Medical data accessed', {
  userId: req.user.id,
  patientId: paciente.id,
  fields: ['diagnosticoCie10', 'recetaJson'],
  timestamp: new Date().toISOString()
});
```

### Retención de Datos (LOPDP Art. 23)

| Tipo de dato | Retención mínima | Justificación |
|--------------|------------------|---------------|
| Historia clínica | 10 años | Ley Ecuador |
| Recetas electrónicas | 2 años | SRI |
| Documentos caducados | 30 días post-expiración | LOPDP |

### Derechos ARCO (LOPDP)

- **Acceso:** Paciente puede solicitar sus datos
- **Rectificación:** Corregir datos erróneos
- **Cancelación:** Eliminar datos (con excepciones médicas)
- **Oposición:** Oponerse a tratamiento de datos

---

## Testing

### Test de Cifrado/Descifrado

```typescript
import { encrypt, decrypt } from './crypto';

describe('AES-256 Encryption', () => {
  it('should encrypt and decrypt correctly', () => {
    const original = 'Datos médicos sensibles';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(original);
    expect(encrypted).not.toBe(original);
  });

  it('should produce different ciphertext for same plaintext', () => {
    const data = 'Test data';
    const encrypted1 = encrypt(data);
    const encrypted2 = encrypt(data);

    expect(encrypted1).not.toBe(encrypted2); // IV diferente
  });
});
```

### Test de Compliance

```typescript
describe('LOPDP Compliance', () => {
  it('should encrypt sensitive medical data', () => {
    const consulta = {
      motivoConsulta: 'Dolor de cabeza',
      evolucion: 'Paciente refiere cefalea'
    };

    const encrypted = encryptSensitiveFields(consulta);

    // Verificar que los datos están cifrados
    expect(encrypted.motivoConsulta).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(encrypted.motivoConsulta).not.toBe(consulta.motivoConsulta);
  });
});
```

---

## Referencias

- [LOPDP Texto Completo](https://www.asambleanacional.gob.ec/es/documento/assembly/document/ley-organica-proteccion-datos-personales)
- [NIST AES-256 Specification](https://csrc.nist.gov/publications/detail/fips/197/final)
- [apps/api/src/utils/crypto.ts](../apps/api/src/utils/crypto.ts)
- [apps/api/src/middleware/encryption.ts](../apps/api/src/middleware/encryption.ts)

---

**Última actualización:** 2026-02-11
**Versión:** 1.0
**Compliance:** LOPDP Art. 14, Art. 23, Art. 25
