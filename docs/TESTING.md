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

Playwright usa `tests/e2e`. Los flujos críticos completos se amplían en Sprint 3.3.

## Verificación general

```bash
npm run verify
```

`verify` ejecuta typecheck, lint, unit tests y build. GitHub Actions ejecuta además el job `integration` sobre Supabase local y el job de dependency-security. E2E se incorpora al pipeline en Sprint 3.3/3.4.

## Reglas

- No usar datos reales de producción como fixtures.
- No ejecutar integration tests contra producción.
- No probar detalles internos triviales si una regla observable ofrece mejor señal.
- Un bug de producción debe recibir una prueba de regresión cuando sea razonable.
- Las reglas de permisos deben probar tanto el caso permitido como el rechazado.
- Los cambios de DB/RPC requieren integración; ocultar un botón nunca cuenta como control de seguridad.
- Los E2E deben cubrir pocos flujos críticos, estables y representativos; no duplicar toda la suite unit/integration en navegador.
