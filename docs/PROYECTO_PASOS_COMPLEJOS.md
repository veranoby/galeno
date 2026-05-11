# Registro de Pasos Complejos - Proyecto Galeno

Este documento detalla los pasos complejos que se pueden implementar en el futuro, con su análisis de complejidad y prerequisitos.

---

## Paso Complejo 1: Arreglar Gradualmente los Errores de TypeScript (275 errores)

### ¿Qué se debe hacer?

Arreglar los 275 errores de TypeScript distribuidos en 69 archivos del proyecto. Los errores son principalmente:

- Tipos incompatibles (`string | null` no asignable a `string`)
- Propiedades faltantes en tipos
- Módulos sin declaraciones de tipo (`vue-snackbar`, `@/api`, etc.)
- Argumentos faltantes en funciones (`useSSE()` requiere `userId`)

### ¿Por qué es complejo?

1. **Cantidad de errores**: 275 errores en 69 archivos requieren mucho tiempo para revisar y corregir.
2. **Riesgo de romper funcionalidad**: Algunos errores están en componentes críticos (teleconsulta, pago, salud wallet), así que cambiar los tipos puede romper la app.
3. **Dependencias externas**: Algunos errores son de librerías sin tipos (como `vue-snackbar`), que requieren workarounds.

### Prerequisitos

- Tener un entorno de desarrollo funcionando (backend + frontend)
- Conocimiento básico de TypeScript y Vue 3
- Tiempo dedicado: ~8-12 horas (estimado)
- Rama de trabajo separada: Crear una rama `fix/typescript-errors` para no afectar `main`

### Pasos de Implementación (Resumidos)

1. Crear rama: `git checkout -b fix/typescript-errors`
2. Priorizar errores por módulo: Empezar por los archivos menos críticos (ej: utils, composables simples)
3. Corregir errores uno por uno:
   - Para `string | null`: Usar operador de coalescencia nula (`?? ''`) o guardias de tipo
   - Para módulos sin tipos: Crear archivos `.d.ts` en `src/types/`
   - Para argumentos faltantes: Añadir los argumentos requeridos o ajustar las funciones
4. Probar cada cambio: Ejecutar `pnpm type-check` en la app correspondiente
5. Mergear gradualmente: Hacer pull requests pequeños para revisar cambios fácilmente

---

## Paso Complejo 2: Configurar ESLint Específicamente para Vue en la App Web

### ¿Qué se debe hacer?

Configurar ESLint en la app web (`apps/web/`) con reglas específicas para Vue 3 y Vuetify, usando el nuevo formato flat config (`eslint.config.js`).

### ¿Por qué es complejo?

1. **Migración de formato**: La app web tiene un `.eslintrc.cjs` (formato obsoleto) y un `eslint.config.js` (nuevo formato), pero no están sincronizados.
2. **Reglas específicas de Vue**: Necesitas configurar reglas como `vue/no-unused-vars`, `vue/component-definition-name-casing`, etc., sin romper el código existente.
3. **Compatibilidad con TypeScript**: Asegurar que ESLint funcione con `vue-tsc` y los archivos `.vue`.

### Prerequisitos

- Tener ESLint v9+ instalado (ya lo está: `eslint@^9.0.0` en `package.json`)
- Tener `eslint-plugin-vue` instalado (ya lo está: `eslint-plugin-vue@^10.7.0`)
- Conocimiento básico de ESLint flat config

### Pasos de Implementación (Resumidos)

1. Navegar a la app web: `cd apps/web/`
2. Eliminar el archivo obsoleto: `rm .eslintrc.cjs`
3. Actualizar el `eslint.config.js` existente para incluir todas las reglas necesarias (sincronizar con el `.eslintrc.cjs` eliminado)
4. Probar la configuración: `pnpm lint`
5. Ajustar reglas que rompen el código existente (cambiar de `error` a `warn` si es necesario)
6. Commitear los cambios: `git add eslint.config.js && git commit -m "chore: update ESLint config for Vue web app"`

---

## Paso Complejo 3: Configurar GitHub Actions para CI/CD

### ¿Qué se debe hacer?

Crear workflows de GitHub Actions para:

1. **CI**: Ejecutar linters y tests automáticamente en cada `push` y `pull request`.
2. **CD (opcional)**: Desplegar la app a producción automáticamente cuando se mergea a `main`.

### ¿Por qué es complejo?

1. **Configuración de workflows**: Necesitas escribir archivos YAML que definan los pasos correctamente.
2. **Manejo de secrets**: Si usas servicios externos (como Stripe, Resend, etc.), necesitas guardar los secrets en GitHub de forma segura.
3. **Cache de dependencias**: Configurar caché para `pnpm` y Turbo para acelerar los builds.
4. **Pruebas en múltiples entornos**: Si quieres probar en diferentes versiones de Node.js, necesitas matrices de build.

### Prerequisitos

- Tener el repositorio en GitHub (ya lo está: `https://github.com/veranoby/galeno`)
- Conocimiento básico de YAML
- (Opcional) Cuentas en servicios de despliegue (Vercel, Render, etc.) si quieres CD

### Pasos de Implementación (Resumidos)

1. Crear la carpeta de workflows: `mkdir -p .github/workflows/`
2. Crear el workflow de CI: `.github/workflows/ci.yml`
3. Configurar el workflow para:
   - Ejecutarse en `push` a `main` y en `pull_request`
   - Usar caché para `pnpm` y Turbo
   - Ejecutar `pnpm install`, `pnpm lint`, `pnpm type-check`, `pnpm test`
4. Probar el workflow: Hacer un push a una rama y verificar que se ejecute en GitHub
5. (Opcional) Crear workflow de CD: `.github/workflows/cd.yml` para desplegar a producción

---

## Notas Finales

- **Prioridad**: Implementa los pasos en este orden:
  1. Configurar caché de Turbo (ya hecho)
  2. Configurar GitHub Actions para CI
  3. Configurar ESLint para Vue
  4. Arreglar errores de TypeScript
- **Ramas**: Siempre usa ramas separadas para pasos complejos, nunca trabaja directamente en `main`.
- **Pruebas**: Ejecuta `pnpm build` y `pnpm test` antes de mergear cualquier cambio.
