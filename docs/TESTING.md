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

Los cierres normales y la reapertura también están cubiertos a nivel de transición en `state.test.ts`; la autoridad RPC se valida en integración durante Sprint 3.2.

### Integration

Comando:

```bash
npm run test:integration
```

Vitest usa `vitest.integration.config.mts`. Esta capa puede depender de una instancia Supabase aislada y debe probar RPC, RLS, Storage y rechazo de operaciones no autorizadas. No debe apuntar a producción como parte de CI.

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

Actualmente ejecuta typecheck, lint, unit tests y build. Integration y E2E se incorporarán al pipeline obligatorio cuando exista el entorno aislado correspondiente.

## Reglas

- No usar datos reales de producción como fixtures.
- No probar detalles internos triviales si una regla observable ofrece mejor señal.
- Un bug de producción debe recibir una prueba de regresión cuando sea razonable.
- Las reglas de permisos deben probar tanto el caso permitido como el rechazado.
- Los cambios de DB/RPC requieren integración; ocultar un botón nunca cuenta como control de seguridad.
- Los E2E deben cubrir pocos flujos críticos, estables y representativos; no duplicar toda la suite unit/integration en navegador.
