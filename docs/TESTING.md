# Testing — FINSA Trazabilidad

## Objetivo

La suite debe proteger reglas de negocio y flujos críticos sin perseguir cobertura artificial. Backend/RPC sigue siendo la autoridad final; los unit tests validan helpers y prevalidaciones, los integration tests validan DB/RPC/RLS y los E2E validan el sistema desde navegador.

## Capas

### Unit

Comando:

```bash
npm run test:unit
```

Vitest ejecuta `src/**/*.test.ts` y excluye tests de integración. Esta capa no debe depender de Supabase remoto ni de datos productivos.

Cobertura crítica actual:

- transiciones de estado y reapertura: `src/lib/deliveries/state.test.ts`
- permisos/RBAC de UX: `src/lib/deliveries/permissions.test.ts`
- progreso: `src/lib/deliveries/progress.test.ts`
- etapas FLOOR/DISPATCH: `src/lib/deliveries/stages.test.ts`
- filtro de modalidad de listados: `src/lib/deliveries/queries.test.ts`
- búsqueda: `src/lib/deliveries/search.test.ts`
- cierre excepcional/prevalidación: `src/lib/actions/bulk-close.test.ts`
- alertas: `src/lib/deliveries/alerts.test.ts`
- validación de entregas: `src/lib/validations/delivery.test.ts`
- MIME y paths de evidencias/Storage: `src/lib/evidence/mime.test.ts`, `src/lib/storage/path.test.ts`

Los cierres normales y la reapertura también están cubiertos a nivel de transición en `state.test.ts`; la autoridad RPC se valida en integración.

### Integration

Comando:

```bash
npm run test:integration
```

Vitest usa `vitest.integration.config.mts`. Los archivos se ejecutan sin paralelismo de archivos porque comparten una única instancia efímera de DB durante el job.

En CI la capa de integración levanta **Supabase local efímero** en GitHub Actions:

```text
checkout
→ Supabase CLI 2.114.0
→ supabase start
→ aplicar todas las migraciones
→ exportar credenciales locales
→ seed sintético
→ npm run test:integration
→ supabase stop --no-backup
```

No usa Supabase productivo, no requiere un development branch pago y el entorno se destruye al terminar el job.

Cobertura efectiva de Sprint 3.2:

- creación y edición mediante `save_delivery`, incluido control de estado esperado;
- PUBLISHED → IN_PICKING mediante operación/evidencia;
- transición a READY con requisitos FLOOR;
- FLOOR y DISPATCH según etapa/estado;
- revisión de evidencia y rechazo por rol;
- cierre normal y observaciones;
- reapertura y auditoría;
- cierre excepcional con confirmación/motivo y auditoría de bypass;
- archive/soft delete Admin-only;
- RLS sobre `deliveries`, `evidences` y `audit_events`;
- persistencia real en Storage local, descarga y validación;
- rechazo de operaciones no autorizadas.

La suite evita depender del estado mutable de fixtures compartidos cuando una prueba realiza operaciones globales, como el cierre excepcional.

### E2E

Comando:

```bash
npm run test:e2e
```

Playwright cubre pocos flujos críticos de navegador contra **Supabase local + Next local**. No usa producción, Vercel ni datos reales.

#### Requisitos locales

- Docker Desktop en ejecución
- Chromium de Playwright: `npx playwright install chromium`
- Variables de `.env.local` apuntando al stack local (`127.0.0.1` / `localhost`)
- Usuarios sintéticos del seed: `ilan@cat.local` (ADMIN) y `emilio@cat.local` (PICKING)

#### Lifecycle

```bash
npx supabase start          # migraciones + seed SQL
npm run db:seed             # usuarios y fixtures sintéticos
npm run test:e2e            # Playwright levanta `npm run dev:http` si el puerto 3000 está libre
```

Si la app ya corre en `http://127.0.0.1:3000`, Playwright reutiliza ese servidor. En CI el job hace `npm run build` + `npm run start`.

`E2E_SKIP_WEBSERVER=1` omite el webServer cuando el proceso se arranca por fuera. `E2E_BASE_URL` sólo puede ser local; el global setup rechaza hosts remotos.

Playwright inyecta las variables de `.env.local` en el servidor de prueba. Así `.env.development.local` (que puede apuntar a otro proyecto) no contamina los E2E. Si reutilizás un `next dev` ya levantado, tiene que ser `npm run dev:http` con env local, no el stack HTTPS/productivo.

Reset limpio entre corridas:

```bash
npx supabase db reset
npm run db:seed
npm run test:e2e
```

Cada test crea números de entrega únicos. No dependen del orden ni de mutaciones de otro E2E.

#### Fixtures

- `tests/e2e/fixtures/evidence.png`: PNG sintético 32×32. No usar fotos reales de Finning/clientes ni paths externos.

#### Qué cubre la suite

- `tests/e2e/despacho.spec.ts`: DESPACHO completo (crear/publicar, inbox Despachos, claim, FLOOR, READY, DISPATCH, revisión, cierre, historial).
- `tests/e2e/customer-pickup.spec.ts`: RETIRA CLIENTE completo (sólo inbox de retiros, evidencias FLOOR, READY, revisión/cierre, historial).
- `tests/e2e/regressions.spec.ts`: observación abierta bloquea cierre; FLOOR bloqueado en READY; evidencia anulada; reapertura; Publicar se deshabilita durante el envío.
- `tests/e2e/mobile-smoke.spec.ts`: un smoke de login PICKING en viewport Pixel 7. El resto corre en Chromium desktop.

#### Artifacts

Ante fallo, Playwright deja `playwright-report/` y `test-results/` (trace, screenshot, video). En GitHub Actions se suben 14 días. No se suben `.env`, tokens ni dumps de DB.

#### Qué queda deliberadamente en integration

No se duplican en navegador:

- INSERT/UPDATE RLS directos y grants
- SECURITY DEFINER / `search_path`
- constraints DB y MIME magic bytes
- `storage_key` arbitrario
- rol inválido llamando RPC
- stale `expected_status`
- claim concurrente de dos pickers
- cierre excepcional / archive internals
- usuario desactivado

La autoridad de esas reglas ya está en `npm run test:integration`.

## Verificación general

```bash
npm run verify
npm run test:integration
npm run test:e2e
```

`verify` ejecuta typecheck, lint, unit tests y build. GitHub Actions ejecuta además `integration` y `e2e` sobre Supabase local efímero, y `dependency-security`. El workflow Security (Gitleaks + CodeQL) corre aparte. Sprint 3.4 cubrirá required checks / branch protection; este sprint sólo agrega el job.

## Reglas

- No usar datos reales de producción como fixtures.
- No ejecutar integration tests contra producción.
- No probar detalles internos triviales si una regla observable ofrece mejor señal.
- Un bug de producción debe recibir una prueba de regresión cuando sea razonable.
- Las reglas de permisos deben probar tanto el caso permitido como el rechazado.
- Los cambios de DB/RPC requieren integración; ocultar un botón nunca cuenta como control de seguridad.
- Los E2E deben cubrir pocos flujos críticos, estables y representativos; no duplicar toda la suite unit/integration en navegador.
