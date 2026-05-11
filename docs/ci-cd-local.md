# CI/CD Pipeline Local - Galeno

Este documento describe el pipeline de CI/CD local que se ejecuta automáticamente con Git hooks.

## 🎯 Overview

El pipeline NO usa GitHub Actions - todo es ejecutado localmente con Husky Git Hooks.

## 📊 Pipeline Stages

### Pre-Commit (se ejecuta antes de cada commit)

```
┌─────────────────────────────────────────────────────────┐
│ 1. Lint staged files (lint-staged)             │
│    ↓ Fails: Previene commit con errores de lint  │
│                                                  │
│ 2. Type-check API (tsc --noEmit)              │
│    ↓ Fails: Previene commit con errores de tipos  │
│                                                  │
│ 3. Type-check Web (vue-tsc --noEmit)           │
│    ↓ Fails: Previene commit con errores de tipos  │
│                                                  │
│ 4. ✅ Commit permitido                             │
└─────────────────────────────────────────────────────────┘
```

### Pre-Push (se ejecuta antes de cada push)

```
┌─────────────────────────────────────────────────────────┐
│ 1. Build API (tsc)                             │
│    ↓ Fails: Previene push con build roto        │
│                                                  │
│ 2. Build Web (vite build)                        │
│    ↓ Fails: Previene push con build roto        │
│                                                  │
│ 3. ✅ Push permitido                              │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Comandos Disponibles

```bash
# Ejecutar todos los checks de calidad (lint + typecheck)
pnpm ci:check

# Ejecutar tests
pnpm ci:test

# Ejecutar build de todos los paquetes
pnpm ci:build

# Ejecutar pipeline completo (lint + typecheck + test + build)
pnpm ci:all

# Lint con auto-fix
pnpm lint:fix

# Type check individual
pnpm typecheck
# → Ejecuta type-check en apps/api y apps/web

# Test con coverage
pnpm test:coverage
```

## 🔧 Configuración

### Husky Hooks

Ubicación: `.husky/`

- `pre-commit`: Se ejecuta antes de `git commit`
- `pre-push`: Se ejecuta antes de `git push`

### lint-staged

Configurado en `package.json`:

```json
"lint-staged": {
  "*.{ts,tsx,js,jsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{json,md}": [
    "prettier --write"
  ]
}
```

## 🚨 Saltar Hooks (Emergencia)

Si necesitas hacer commit a pesar de los checks:

```bash
# Saltar pre-commit
git commit --no-verify

# Saltar pre-push
git push --no-verify
```

⚠️ **Usar con precaución** - Solo en casos extremos.

## 📋 Quality Gates

| Check | Comando | Estado |
|--------|----------|--------|
| Lint | `eslint` | ✅ Activo en pre-commit |
| Type Check API | `tsc --noEmit` | ✅ Activo en pre-commit |
| Type Check Web | `vue-tsc --noEmit` | ✅ Activo en pre-commit |
| Build API | `tsc` | ✅ Activo en pre-push |
| Build Web | `vite build` | ✅ Activo en pre-push |
| Tests | `vitest` | ⏳ Pendiente de implementar |

## 🔄 Triggers

### Automáticos
- **Pre-commit**: Ejecuta en cada `git commit`
- **Pre-push**: Ejecuta en cada `git push`

### Manual
```bash
# Ejecutar pipeline completo manualmente
pnpm ci:all
```

## 📁 Archivos Relacionados

```
galeno/
├── .husky/
│   ├── pre-commit      # Hook pre-commit
│   └── pre-push       # Hook pre-push
├── package.json        # Scripts de CI
├── apps/api/
│   └── package.json   # Scripts específicos API
└── apps/web/
    └── package.json   # Scripts específicos Web
```

## 🛠️ Mantenimiento

### Actualizar Husky hooks
```bash
pnpm prepare
```

### Reinstalar Husky
```bash
pnpm uninstall husky
rm -rf .husky
pnpm add -D husky
pnpm prepare
```

## 📝 Notas

- Tests NO se ejecutan en pre-commit (por velocidad)
- Tests se pueden agregar cuando tengan suficientes casos
- Los outputs de build se redirigen a `/dev/null` para limpiar la terminal
