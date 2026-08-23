# FINSA Trazabilidad — Enterprise Readiness Plan

## Objetivo

Convertir FINSA Trazabilidad en un producto corporativo robusto, medible, auditable y mantenible, listo para evaluación formal por IT y una eventual propuesta comercial interna.

Objetivo final: `v1.0.0` con calidad de **Enterprise Release Candidate**, seguridad validada, ambientes separados, pruebas automatizadas, observabilidad, recuperación ante incidentes, métricas operativas y documentación suficiente para que un equipo distinto del autor pueda operar y mantener el sistema.

## Convenciones del dominio

- Modalidad técnica `DESPACHO` → UI **Despacho**.
- Modalidad técnica `CUSTOMER_PICKUP` → UI **Retira cliente**.
- `ANDREANI` es transportista (`carrier`), no modalidad.
- Backend/RPC = autoridad final de mutaciones críticas.
- Helpers TypeScript = representación para UX/prevalidación.
- UI = consume reglas; no las inventa.

## Principios de ejecución

- No agregar features grandes mientras existan riesgos críticos de arquitectura, seguridad o integridad.
- Toda regla crítica debe validarse del lado servidor.
- Todo cambio de base debe existir como migración versionada.
- Ningún cambio relevante debe probarse por primera vez en producción.
- Usar PRs pequeños, revisables y reversibles.
- Preservar datos históricos.
- Acciones excepcionales: explícitas, justificadas y auditables.
- No inventar métricas, permisos ni requisitos corporativos.
- Evitar overengineering y dependencias innecesarias.

---

# Estado ejecutivo

- [x] Sprint 1 — Baseline, inventario y auditoría.
- [x] Sprint 2.1 — Normalización modalidad/transportista.
- [x] Sprint 2.2 — Fuente única de reglas de negocio.
- [x] Sprint 2.3 — Matriz RBAC formal.
- [x] Sprint 2.4 — Hardening Supabase.
- [x] Sprint 2.5 — Supply-chain security.
- [x] Sprint 3 — Testing, CI y ambientes.
- [ ] Sprint 4 — Observabilidad, auditoría y recuperación.
- [ ] Sprint 5 — Métricas, UX y performance.
- [ ] Sprint 6 — Documentación IT, release y paquete comercial.

**Sprint 2 — Dominio definitivo y seguridad: COMPLETO ✅**

**Sprint 3.1 — Unit tests: COMPLETO ✅**

**Sprint 3.2 — Integration tests: COMPLETO ✅**

**Sprint 3.3 — E2E críticos: COMPLETO ✅**

**Sprint 3.4 — Pipeline CI obligatorio: COMPLETO ✅**

**Sprint 3.5 — DEV / STAGING / PROD: COMPLETO ✅**

**Sprint 3 — Testing, CI y ambientes: COMPLETO ✅**

**Sprint 4.5 — Auditoría visible: CLOSED ✅**

**Próxima unidad:** Sprint 4.6 — Backup / restore — NOT STARTED.

---

# Sprint 1 — Baseline, inventario y auditoría ✅

## 1.1 Línea base estable

- [x] Identificar commit productivo estable.
- [x] Crear tag `v0.9-baseline`.
- [x] Registrar versiones críticas del stack.
- [x] Guardar snapshot del esquema `public`.
- [x] Documentar Storage y policies.
- [x] Documentar variables de entorno sin secretos.
- [x] Generar backup de DB y evidencias.
- [x] Cifrar/verificar backup y documentar recuperación/retención.
- [x] Reconciliar migraciones locales/remotas.
- [x] Verificar que la base pueda reconstruirse desde migraciones.

Documentación principal:

- `docs/BACKUP.md`
- `docs/STORAGE.md`
- `docs/ENVIRONMENT_VARIABLES.md`
- `docs/MIGRATION_RECONCILIATION.md`
- `supabase/schema-baselines/v0.9-baseline-public.sql`

## 1.2 Auditoría completa

- [x] Rutas `src/app`.
- [x] Server Actions y API routes.
- [x] Permisos y transiciones.
- [x] Cálculo de progreso.
- [x] Evidencias: carga/anulación/revisión.
- [x] PDF/ZIP/Excel.
- [x] PWA/móvil.
- [x] Componentes compartidos.
- [x] Consultas Supabase.
- [x] RPCs.
- [x] RLS.
- [x] Migraciones.
- [x] Índices/constraints.
- [x] Dependencias externas.
- [x] Código muerto/TODO/FIXME/casts inseguros.
- [x] Lógica duplicada frontend/backend.
- [x] Secretos accidentales en Git.

Entregables:

- [x] `docs/ARCHITECTURE_CURRENT.md`
- [x] `docs/AUDIT_REPORT.md`
- [x] `docs/RISK_REGISTER.md`
- [x] diagrama de arquitectura actual
- [x] inventario de RPCs/tablas/policies/buckets

**Salida cumplida:** baseline recuperable y comportamiento crítico entendido/documentado.

---

# Sprint 2 — Dominio definitivo y seguridad

## 2.1 Modalidad y transportista ✅

Modelo efectivo:

```text
Modalidad
- DESPACHO
- CUSTOMER_PICKUP   # UI: Retira cliente

Transportista
- ANDREANI
```

- [x] Diseñar migración `ANDREANI` modalidad → `DESPACHO` + carrier.
- [x] Agregar `deliveries.carrier`.
- [x] Migrar históricos conservando IDs/evidencias/auditoría/fechas/estados.
- [x] Actualizar TypeScript.
- [x] Actualizar Zod.
- [x] Actualizar filtros.
- [x] Actualizar templates.
- [x] Actualizar RPCs.
- [x] Actualizar reportes.
- [x] Actualizar tests.
- [x] Eliminar uso de `ANDREANI` como modalidad de aplicación.

Referencias:

- `docs/DOMAIN_MODEL.md`
- `docs/MODALITY_MIGRATION_PLAN.md`
- migración `20260821153000...`

## 2.2 Fuente única de reglas de negocio ✅

- [x] Inventariar transiciones.
- [x] Inventariar cierre normal/excepcional.
- [x] Inventariar FLOOR/DISPATCH.
- [x] Inventariar reglas por rol.
- [x] Eliminar contradicciones frontend/backend conocidas.
- [x] Definir DRAFT/PUBLISHED/IN_PICKING/READY/CLOSED.
- [x] Hacer que UI consuma helpers coherentes con backend.
- [x] Añadir tests unitarios/integración de reglas críticas.

Fuente: `docs/BUSINESS_RULES.md`.

Autoridad final: RPCs. Helpers: `src/lib/deliveries/permissions.ts`, `state.ts`, `progress.ts`.

## 2.3 Matriz RBAC formal ✅

- [x] Crear `docs/RBAC_MATRIX.md`.
- [x] Definir permisos efectivos de PICKING.
- [x] Definir permisos efectivos de SUPERVISOR.
- [x] Definir permisos efectivos de ADMIN.
- [x] Documentar restricciones por estado.
- [x] Documentar autoridad técnica por acción.
- [x] Resolver diferencias entre tabla preliminar y comportamiento real.
- [x] Confirmar que 2.3 no necesita ampliar permisos ni cambiar código.

Decisiones formales:

| Acción | PICKING | SUPERVISOR | ADMIN |
| --- | ---: | ---: | ---: |
| Ver no-borrador | Sí | Sí | Sí |
| Ver DRAFT | No | Sí | Sí |
| Crear/editar/publicar | No | No | Sí |
| Claim/release propio | Sí, según estado | No | No |
| Asignación masiva de responsables | No | Sí | Sí |
| Cargar FLOOR/DISPATCH | Sí, según estado | No | Sí |
| Revisar evidencia | No | No | Sí |
| Marcar READY | Sí, según regla | No | Sí |
| Cierre normal | No | No | Sí |
| Reabrir | No | No | Sí |
| Cierre excepcional | No | No | Sí |
| Reportes/tablero/día | No | Sí | Sí |
| Usuarios/catálogo | No | No | Sí |

**Nota:** el borrador anterior del plan sugería revisión de evidencia para SUPERVISOR. La matriz formal confirma que el comportamiento implementado vigente es **ADMIN únicamente**.

### Evidencia de cierre 2.3

- Documento: `docs/RBAC_MATRIX.md`.
- PR: #38.
- Merge: `94641d5ab3ecf2da385a8f485c3dacd70a36285b`.
- Preview Vercel: `READY`.
- Producción del merge: `READY`.
- Sin cambios de código, DB o permisos en esta unidad.

## 2.4 Hardening Supabase ✅

Las tres mutaciones directas HIGH detectadas en Sprint 1 ya fueron remediadas (`deliveries` UPDATE, `evidences` UPDATE, `audit_events` INSERT). El hardening restante fue completado y documentado.

- [x] Revisar todas las policies RLS.
- [x] Confirmar RLS en cada tabla sensible.
- [x] Revisar todas las funciones `SECURITY DEFINER`.
- [x] Fijar/verificar `search_path` en RPCs privilegiadas.
- [x] Revisar grants a `anon`, `authenticated`, `service_role`.
- [x] Evitar autorización basada sólo en inputs del cliente.
- [x] Validar ownership/acceso de Storage.
- [x] Revisar signed URLs y expiración.
- [x] Validar MIME real y extensiones.
- [x] Validar límites de tamaño.
- [x] Prevenir paths arbitrarios.
- [x] Revisar eliminación/anulación de evidencias.
- [x] Confirmar que usuarios deshabilitados pierdan acceso efectivo.
- [x] Resolver o registrar explícitamente los hallazgos de seguridad pendientes del `RISK_REGISTER`.

Evidencia de cierre:

- `docs/SECURITY_MODEL.md`.
- `docs/RISK_REGISTER.md` actualizado.
- PRs #40 y #41.
- Merge final técnico: `b6c18ffcc8db93ccf290273b5062d47feb7e06a8`.
- Preview y producción Vercel: `READY`.
- Warnings operativos restantes (`pg_trgm` en `public` y leaked-password protection) registrados explícitamente; no bloquean el cierre técnico de 2.4.

## 2.5 Supply-chain security ✅

- [x] Dependabot o equivalente.
- [x] `npm audit`/scanner en CI.
- [x] Secret scanning.
- [x] Code scanning si está disponible.
- [x] Revisar dependencias sin mantenimiento.
- [x] Generar SBOM inicial.

Evidencia de cierre:

- `.github/dependabot.yml` para npm y GitHub Actions.
- `.github/workflows/ci.yml`: `npm audit --audit-level=high` bloqueante y SBOM CycloneDX como artifact.
- `.github/workflows/security.yml`: Gitleaks + CodeQL en PR/main y ejecución semanal.
- `docs/DEPENDENCY_SECURITY.md`.
- `docs/RISK_REGISTER.md` actualizado.
- PR #43.
- Merge técnico: `406db893cdd18d48b1c3ab579f6ead024b206861`.
- CI quality: `success`.
- Dependency security: `success`.
- Gitleaks: `success`.
- CodeQL: `success`.
- Vercel Preview: `success`.
- SBOM inicial generado correctamente como artifact `sbom-cyclonedx`.
- `npm audit`: cero HIGH/CRITICAL; dos MODERATE transitivas vía `exceljs → uuid@8.3.2`, registradas y aceptadas temporalmente sin forzar cambios breaking.

### Entregables Sprint 2

- [x] `docs/DOMAIN_MODEL.md`
- [x] `docs/RBAC_MATRIX.md`
- [x] `docs/SECURITY_MODEL.md`
- [x] `docs/DEPENDENCY_SECURITY.md`
- [x] migración de modalidad
- [x] suite base de reglas/permisos
- [x] supply-chain scanning + SBOM inicial

**Sprint 2 — Dominio definitivo y seguridad: COMPLETO ✅**

---

# Sprint 3 — Testing, CI y ambientes

## 3.1 Unit tests ✅

- [x] transiciones de estado
- [x] permisos
- [x] cálculo de progreso
- [x] FLOOR/DISPATCH
- [x] filtros por modalidad
- [x] búsquedas
- [x] cierres normales/excepcionales
- [x] reaperturas
- [x] alertas

Objetivo: cobertura alta del dominio crítico, no cobertura artificial de componentes triviales.

Evidencia de cierre:

- estrategia y comandos documentados en `docs/TESTING.md`.
- transiciones/cierres/reapertura: `src/lib/deliveries/state.test.ts`.
- permisos: `src/lib/deliveries/permissions.test.ts`.
- progreso: `src/lib/deliveries/progress.test.ts`.
- FLOOR/DISPATCH: `src/lib/deliveries/stages.test.ts`.
- modalidades: `src/lib/deliveries/queries.test.ts`.
- búsquedas: `src/lib/deliveries/search.test.ts`.
- cierre excepcional: `src/lib/actions/bulk-close.test.ts` sobre helper usado por producción.
- alertas: `src/lib/deliveries/alerts.test.ts`.
- CI `npm run verify`: `success` tras corregir el mock hoisted del test de modalidad.
- La autoridad final de RPC/RLS/cierres se valida en Sprint 3.2; 3.1 cubre lógica unitaria y prevalidación.

## 3.2 Integration tests ✅

- [x] creación/edición RPC
- [x] PUBLISHED → IN_PICKING
- [x] IN_PICKING/PUBLISHED → READY
- [x] FLOOR
- [x] DISPATCH en READY
- [x] revisión
- [x] cierre normal
- [x] reapertura
- [x] cierre excepcional
- [x] archive/soft delete
- [x] RLS por rol
- [x] Storage access
- [x] rechazo de operaciones no autorizadas

Evidencia de cierre:

- CI levanta Supabase local efímero; no usa producción ni recursos pagos.
- Todas las migraciones versionadas se aplican desde cero antes de la suite.
- Seed sintético crea usuarios/fixtures de ADMIN y PICKING; Supervisor se crea en tests cuando corresponde.
- `src/lib/supabase/business-rules.integration.test.ts`: workflow, FLOOR/DISPATCH, READY, cierre, observaciones, claim/release y bulk assignment.
- `src/lib/supabase/workflow-lifecycle.integration.test.ts`: save/edit, review, reapertura, archive y cierre excepcional.
- `src/lib/supabase/rls-*.integration.test.ts`: remediaciones RLS y operaciones directas prohibidas.
- `src/lib/supabase/modality-carrier.integration.test.ts`: modelo DESPACHO/CUSTOMER_PICKUP y carrier.
- `src/lib/evidence/persist.test.ts`: Storage real local, registro/descarga y rechazos; aislado de fixtures mutables compartidos.
- Supabase CLI fijada en `2.114.0` para evitar dependencia de resolución `latest` y mejorar reproducibilidad.
- GitHub Actions `quality`, `integration` y `dependency-security`: `success` en la validación final de la unidad.

## 3.3 E2E críticos ✅

### DESPACHO

- [x] Admin crea/publica.
- [x] Picking lo ve sólo en Despachos.
- [x] Picking toma.
- [x] Carga FLOOR.
- [x] Marca READY.
- [x] Carga DISPATCH.
- [x] Admin revisa.
- [x] Admin cierra.
- [x] Auditoría correcta.

### RETIRA CLIENTE (`CUSTOMER_PICKUP`)

- [x] Admin crea/publica.
- [x] Aparece sólo en Retira cliente.
- [x] Picking toma/carga evidencias.
- [x] Marca READY.
- [x] Revisión/cierre según regla.
- [x] Auditoría correcta.

### Regresiones

E2E de navegador en este sprint:

- [x] doble submit (Publicar se deshabilita durante pending)
- [x] evidencia anulada
- [x] observación abierta
- [x] reapertura
- [x] evidencia prohibida por etapa (FLOOR en READY)

Quedan cubiertos por integration, no duplicados en navegador:

- [ ] dos pickers intentando claim simultáneo — integration
- [ ] evidencia rechazada — integration (`workflow-lifecycle`)
- [ ] cierre excepcional — integration
- [ ] refresh/error de red durante upload — no automatizado; frágil en browser
- [ ] usuario desactivado — integration/RLS
- [ ] RPC restringida llamada directamente — integration
- [ ] entrega archivada — integration

Evidencia de cierre:

- Playwright Chromium contra Supabase local + Next local. Rechaza `E2E_BASE_URL` remoto.
- `tests/e2e/despacho.spec.ts` y `tests/e2e/customer-pickup.spec.ts`.
- Regresiones operativas en `tests/e2e/regressions.spec.ts`.
- Un smoke móvil en `tests/e2e/mobile-smoke.spec.ts` (Pixel 7). El resto no corre en móvil.
- Job CI `e2e`: Supabase CLI `2.114.0`, seed sintético, `npm run build` + `npm run start`, artifacts 14 días ante fallo.
- Comandos y límites documentados en `docs/TESTING.md`.
- Branch protection / required checks: Sprint 3.4.

## 3.4 CI obligatorio ✅

Cada PR a `main` debe pasar, como jobs reales de GitHub Actions:

```text
quality            # typecheck + lint + unit + build via npm run verify
integration
e2e
dependency-security
CodeQL
Secret scan
```

- [x] typecheck verde como requisito sistemático (dentro de `quality`)
- [x] lint verde como requisito sistemático (dentro de `quality`)
- [x] unit verde (dentro de `quality`)
- [x] integration verde
- [x] E2E crítico verde
- [x] build verde como requisito sistemático (dentro de `quality`)
- [x] CI requerido para merge
- [x] bloquear merge ante fallos críticos
- [x] conservar artifacts útiles
- [x] documentar comandos locales equivalentes

No se crearon contexts separados `typecheck`/`lint`/`unit`/`build`: GitHub exige el job `quality`.

Vercel Preview no es required: un PR de tests/docs puede ignorar el build; `quality` ya construye.

Evidencia de cierre:

- Repository ruleset `Protect main` id `21181628`, `enforcement: active`.
- `main.protected: true`.
- Required checks observados en check-runs: `quality`, `integration`, `e2e`, `dependency-security`, `CodeQL`, `Secret scan` (GitHub Actions app id `15368`).
- PR obligatorio con 0 approvals (un mantenedor).
- `strict_required_status_checks_policy`: la rama debe estar al día.
- Force push bloqueado (`non_fast_forward`). Eliminación de `main` bloqueada (`deletion`).
- Bypass vacío; `current_user_can_bypass: never`.
- Artifacts: SBOM 30 días; Playwright report/traces 14 días ante fallo E2E.
- Comandos y consulta de fallos en `docs/TESTING.md`.
- Ningún required job usa `paths:`/`if:` que lo saltee en un PR normal a `main`.
- Merge methods (merge/squash/rebase) sin cambios.

## 3.5 DEV / STAGING / PROD

**Estado: COMPLETO ✅ — validado el 2026-08-22.**

DEV:
- local
- datos sintéticos
- reset permitido

STAGING:
- Supabase independiente
- Vercel preview/staging
- sin datos reales sensibles
- migraciones antes que PROD

PROD:
- acceso restringido
- release aprobada
- backups/monitoreo

Completado:

- [x] Supabase staging independiente (`FINSA Staging`, ref `wbvilfeswdbredgnucjv`, `sa-east-1`).
- [x] Variables aisladas para DEV, STAGING y PROD, sin secretos versionados.
- [x] DB, Auth y Storage separados; bucket privado `evidences` replicado desde migraciones.
- [x] Seed exclusivamente sintético y guardrail que bloquea explícitamente PROD.
- [x] Las 35 migraciones Git aplicadas y reconciliadas 35/35 en staging.
- [x] Branch permanente `staging` y Preview branch-specific en el proyecto Vercel Hobby existente.
- [x] Preview general inerte y builds de branches no autorizadas ignorados para proteger PROD y cuota.
- [x] Smoke remoto crítico DESPACHO + CUSTOMER_PICKUP aprobado (2/2) sobre deployment `849facc`.
- [x] Promoción a PROD documentada con required checks y estrategia expand/contract.
- [x] Rollback de APP/DB/STAGING documentado.
- [x] Runbook ON/OFF zero-cost documentado y ejecutado de punta a punta.
- [x] Costo mensual adicional confirmado: USD 0; sin planes, add-ons ni trials pagos.

Entregables:

- [x] `docs/TESTING.md`
- [x] `docs/ENVIRONMENTS.md`
- [x] pipeline CI estable con Supabase local efímero y seis required checks
- [x] staging funcional, probado y dejado `INACTIVE` fuera de la ventana on-demand

Evidencia de cierre:

- `FinningCAT / jbhbjazagiwyryujnenv`: `ACTIVE_HEALTHY`; no fue pausado.
- `ilara-app / qbbnvdmadgomfmrsfxlo`: restaurado a `ACTIVE_HEALTHY` después de la rotación temporal.
- `FINSA Staging / wbvilfeswdbredgnucjv`: pausado en `INACTIVE` después del smoke.
- Deployment staging validado: `dpl_3sPKmSHaRb9GeL7vh3nGRAPQV8bh`, estado `READY`.
- Smoke staging: DESPACHO y CUSTOMER_PICKUP, 2 aprobados; health y login HTTP 200.
- PR de cierre: `#53`, sujeto a `quality`, `integration`, `e2e`, `dependency-security`, `CodeQL` y `Secret scan`.

---

# Sprint 4 — Observabilidad, auditoría y recuperación

## 4.1 Logging estructurado

Definir timestamp, environment, operation/request ID, route/action, user/delivery ID cuando corresponda, duración, resultado y error code.

Nunca loguear passwords, access tokens, service-role keys ni datos sensibles innecesarios.

## 4.2 Error tracking

- [x] herramienta evaluada e integración técnica aprobable por IT
- [x] errores server/client relevantes con kill switch
- [x] agrupación y stack traces con sanitización allowlist
- [x] separación STAGING/PROD y envío OFF por defecto
- [x] política de datos enviados, redacción y zero-send verificada

**Estado: CLOSED / COMPLETE WITH PROVIDER PRIVACY BLOCKER.** La integración técnica está completa, pero Sentry SaaS queda **DISABLED**: Relay/SaaS deriva `user.geo` server-side desde la IP de conexión aun con `sdk.settings.infer_ip="never"`. La geografía observada corresponde con alta confianza al egress de Vercel `gru1`, no al usuario final. Los metadatos `Trace ID` / `Span ID` / `Trace Preview` son sintéticos de Relay/Sentry y no implican performance tracing de la aplicación. STAGING queda OFF, PROD permanece sin cambios y el costo adicional es USD 0. El bloqueo de privacidad del proveedor está documentado en `docs/ADR_ERROR_TRACKING.md`; Sprint 4.3 queda habilitado como siguiente unidad, pero no se inicia con este cierre.

## 4.3 Health

- [x] proceso web
- [x] conectividad Supabase
- [x] consulta DB
- [x] dependencias críticas

**Sprint 4.3 Health — CLOSED.** `GET /api/health` valida en paralelo proceso web, PostgREST/DB mediante una consulta mínima, Supabase Auth y el bucket privado `evidences` de Storage en modo read-only. Aplica timeout de 5 s, respuesta binaria 200/503, `Cache-Control: no-store, no-cache, must-revalidate`, payload seguro y logging estructurado reutilizado. Evidencia final: unit tests Health PASS (10), integration Health PASS (1), suite completa de integración 44/44 PASS, `npm run verify` PASS (138 tests, build OK; 3 warnings preexistentes), `git diff --check` PASS, y `quality`, `integration`, `e2e`, `dependency-security`, `CodeQL` y `Secret scan` PASS. Revisión independiente APPROVED. PR [#64](https://github.com/ilancueto/TrazabilidadFinsa/pull/64) MERGED en `ee7e3fdf18d5868d704576683b4c82728172fefb`. Sentry permanece DISABLED; PROD unchanged; STAGING remoto untouched; sin cambios de DB o infraestructura y costo adicional USD 0. Sprint 4.4 fue la siguiente unidad y ya está CLOSED.

## 4.4 Métricas técnicas — CLOSED

- [x] uploads OK/fallidos
- [x] latencia API y p50/p95
- [x] errores RPC/API/HTTP
- [x] reintentos
- [x] cierres excepcionales
- [x] reaperturas

Completado: uploads OK/fallidos; latencia API con p50/p95; errores RPC/API/HTTP; reintentos; cierres excepcionales; y reaperturas. Los éxitos durables provienen de `audit_events`; fallos, latencia, retries y errores de logs JSON sanitizados; el agregador offline es determinista y no existe nueva persistencia métrica.

La revisión independiente inicial fue **CHANGES REQUIRED**; la reconciliación y los fixes autorizados se completaron; la re-revisión independiente fue **APPROVE DELTA** y la auditoría final pre-merge **APPROVED FOR MERGE**. PR [#66](https://github.com/ilancueto/TrazabilidadFinsa/pull/66) MERGED: head auditado `d30ac448108ef788edca572a145cd0c0e71e5059`; merge SHA `5d66f60d2958fb08f251dfb37ebd96454f881ea0`. Los seis checks requeridos (`quality`, `integration`, `e2e`, `dependency-security`, `CodeQL`, `Secret scan`) PASS sobre el head auditado. Validación local final: `npm run verify` PASS (159 unit tests, build OK; 3 warnings preexistentes), integración PASS (44), E2E PASS (8) y `git diff --check` PASS.

DB, migraciones, infraestructura, PROD, tracing/OTel y SaaS: NONE; Sentry permanece DISABLED; costo adicional USD 0. Riesgos residuales aceptados: logs no durables; retry no idempotente y algunos HTTP no transitorios aún reintentados; metadata de retry atestiguada por cliente; HTML `303` ambiguo fuera del denominador de fallos; y categorías API/RPC/HTTP potencialmente superpuestas, no incidentes únicos.

## 4.5 Auditoría visible — CLOSED

Entregado y fusionado en PR [#68](https://github.com/ilancueto/TrazabilidadFinsa/pull/68). La Timeline por entrega cubre creación, publicación, asignación, claim, evidencias, observaciones, READY, cierre, reapertura, archivo y excepciones. El panel global sensible está limitado a `ADMIN` y `SUPERVISOR`; `PICKING` no tiene acceso global. Los filtros server-side cubren fecha, usuario, entrega, acción y motivo. Los eventos `ARCHIVED` se normalizan sólo en lectura y el detalle archivado es read-only.

La consulta usa índice `(created_at desc, id desc)` y paginación keyset. La frontera RLS conserva para `PICKING` únicamente entregas `status <> 'DRAFT' AND deleted_at IS NULL`; `PICKING` no puede leer auditoría, requirements ni evidencias archivadas. No se añadió RPC, enum, backfill, tabla ni writer. El runtime usa sesión-bound `createServerSupabase`; no usa service role.

Cadena de revisión durable: Grok 4.6 High — **CHANGES REQUIRED** inicialmente, con F-01 a F-05 resueltos en la revisión delta — **APPROVE DELTA**; GPT Sol High — **APPROVE** final. Hallazgos finales: 0 blocking / 0 major / 0 minor; riesgo residual LOW aceptado.

Validación final: `npm run verify` PASS (177 unit tests, build OK; 3 warnings ESLint preexistentes), `npm run test:integration` PASS (47), E2E de auditoría PASS (2), `git diff --check` PASS y `quality`, `integration`, `e2e`, `dependency-security`, `CodeQL` y `Secret scan` PASS sobre el head auditado `979636115454749954f5fc7f64ff0525d2b59a95`. Merge SHA: `06cee05917850a338ca96c686fceba751e2b5a73`; `main` verificado en ese SHA.

DB/deploy: migración versionada `20260823090000_audit_visibility.sql`, todavía no aplicada en Supabase remoto. STAGING y PROD permanecen untouched; Sentry unchanged/disabled; no hubo mutaciones de Vercel ni infraestructura remota. Costo adicional: USD 0.

Riesgos residuales aceptados: la auditoría contiene información sensible de negocio, mitigada por RLS/RBAC y allowlist de presentación; la migración remota queda pendiente del flujo normal de despliegue autorizado. Este cierre no afirma que la RLS esté activa en PROD.

## 4.6 Backup / restore — NOT STARTED

- [ ] estrategia DB
- [ ] estrategia Storage
- [ ] frecuencia/retención/responsable
- [ ] restore documentado
- [ ] restore real en staging
- [ ] validar tablas/evidencias/configuración
- [ ] medir duración
- [ ] definir RPO/RTO

Entregables:

- [ ] `docs/MONITORING.md`
- [ ] `docs/BACKUP_RESTORE.md`
- [ ] `docs/INCIDENT_RUNBOOK.md`
- [x] auditoría visible
- [ ] restore probado

---

# Sprint 5 — Métricas, UX y performance

## 5.1 Métricas operativas

Definir antes de implementar:

Volumen:
- [ ] despachos/retiros por período
- [ ] cerradas/backlog/urgentes

Tiempos:
- [ ] publicación → primera evidencia
- [ ] publicación → FLOOR completo
- [ ] FLOOR → READY
- [ ] READY → DISPATCH
- [ ] READY → CLOSED
- [ ] lead time total
- [ ] promedio/P50/P90/tendencia

Calidad:
- [ ] observaciones
- [ ] evidencia rechazada
- [ ] reaperturas
- [ ] cierres excepcionales
- [ ] faltantes
- [ ] finalización sin incidentes

Productividad:
- [ ] volumen por picker
- [ ] tiempos sólo cuando sean operacionalmente válidos
- [ ] carga actual
- [ ] trabajo libre

No convertir métricas en ranking individual sin validación de negocio/HR.

## 5.2 Dashboard

- [ ] Hoy
- [ ] 7 días
- [ ] Mes
- [ ] período anterior
- [ ] Despachos
- [ ] Retira cliente
- [ ] Calidad
- [ ] Excepciones

## 5.3 KPI corporativos

- [ ] obtener definiciones oficiales OTIF/OTIL/IRA aplicables
- [ ] documentar fórmula
- [ ] identificar datos faltantes
- [ ] implementar sólo con trazabilidad suficiente

## 5.4 UX operativa

Probar:

- [ ] iPhone Safari/PWA
- [ ] Android Chrome/PWA
- [ ] escritorio Chrome/Edge
- [ ] resolución pequeña
- [ ] red lenta/inestable

Revisar foco/teclado, táctil, loading, upload, retry, doble submit, acciones destructivas, errores, accesibilidad y recuperación tras refresh.

## 5.5 Uploads resilientes

- [ ] progreso
- [ ] retry/cancelación segura
- [ ] fallos de red
- [ ] idempotencia
- [ ] consistencia DB/Storage
- [ ] archivos huérfanos

## 5.6 Performance

- [ ] carga inicial
- [ ] queries lentas
- [ ] payloads
- [ ] imágenes
- [ ] paginación
- [ ] índices
- [ ] N+1
- [ ] bundle size

Entregables:

- [ ] `docs/METRICS_DEFINITIONS.md`
- [ ] dashboard operativo
- [ ] informe UX/mobile
- [ ] informe performance

---

# Sprint 6 — Documentación IT, release y paquete comercial

## 6.1 Documentación técnica final

Objetivo:

```text
README.md
docs/ARCHITECTURE.md
docs/ERD.md
docs/DOMAIN_MODEL.md
docs/SECURITY_MODEL.md
docs/RBAC_MATRIX.md
docs/DEPLOYMENT.md
docs/ENVIRONMENTS.md
docs/TESTING.md
docs/MONITORING.md
docs/BACKUP_RESTORE.md
docs/INCIDENT_RUNBOOK.md
docs/METRICS_DEFINITIONS.md
docs/DEPENDENCIES.md
CHANGELOG.md
```

## 6.2 Arquitectura / ERD

Documentar navegador/PWA, Next.js/Vercel, Auth, Postgres/RLS/RPC, Storage, integraciones, trust boundaries y flujo de datos.

ERD mínimo: profiles, deliveries, clients, delivery_requirements, requirement_types, evidences, templates, template_requirements, audit_events y entidades nuevas relevantes.

## 6.3 Runbook de deployment

Un desarrollador nuevo debe poder:

- [ ] clonar/instalar/configurar env
- [ ] levantar local
- [ ] recrear DB desde migraciones
- [ ] ejecutar tests
- [ ] desplegar staging
- [ ] promover release
- [ ] diagnosticar incidentes comunes

## 6.4 Licencias / dependencias

- [ ] inventario OSS
- [ ] licencias/versiones
- [ ] SaaS/responsabilidades
- [ ] SBOM final

## 6.5 Release Candidate

Crear `v1.0.0-rc.1` con feature freeze.

Durante RC: sólo bugfix, seguridad, documentación o cambios requeridos por IT.

Checklist:

- [ ] CI/E2E/security verdes
- [ ] migración desde productivo probada
- [ ] rollback probado
- [ ] backup/restore probado
- [ ] staging aprobado
- [ ] documentación revisada
- [ ] errores conocidos documentados
- [ ] cero CRITICAL
- [ ] HIGH cerrados o aceptados explícitamente

## 6.6 v1.0.0

Tras aceptar RC:

- [ ] tag `v1.0.0`
- [ ] fecha/commit/migraciones/changelog
- [ ] rollback target
- [ ] responsable de release

---

# Paquete para IT

Debe permitir responder:

1. Qué hace.
2. Dónde corre.
3. Qué datos almacena.
4. Quién puede hacer qué.
5. Cómo se prueba.
6. Cómo se actualiza.
7. Cómo se recupera.
8. Cómo se monitorea.
9. Qué dependencias tiene.
10. Quién lo mantiene.

Incluir arquitectura, stack, modelo, seguridad/RBAC/RLS/Storage, testing, CI/CD, ambientes, backup/DR, monitoreo, runbooks, SBOM/licencias, riesgos, roadmap y demo reproducible.

# Paquete comercial / negocio

Separado del técnico:

- problema/proceso anterior
- solución y alcance
- flujo operativo
- evidencia de adopción
- riesgos/errores reducidos
- tiempos antes/después sólo si son confiables
- trazabilidad
- dashboards/KPI
- escalabilidad
- infraestructura/mantenimiento
- soporte/licenciamiento a definir

No inventar ahorros económicos.

# Propiedad intelectual y compliance

Antes de propuesta comercial formal:

- [ ] relación desarrollo/contrato laboral
- [ ] propiedad del código
- [ ] uso de recursos corporativos
- [ ] marca Finning/CAT y activos gráficos
- [ ] tratamiento de datos internos
- [ ] términos Vercel/Supabase/proveedores
- [ ] aprobación security/compliance si aplica
- [ ] ownership y mantenimiento futuro

---

# Definition of Done — Enterprise v1.0

## Arquitectura y dominio

- [x] modelo técnico `DESPACHO` / `CUSTOMER_PICKUP` correcto en DB
- [x] transportista separado
- [x] reglas críticas centralizadas/documentadas
- [x] base reproducible desde migraciones

## Seguridad

- [x] RLS auditado completamente
- [x] RPCs privilegiadas auditadas completamente
- [ ] RBAC probado de punta a punta
- [x] Storage auditado
- [x] cero secretos de producción detectados en repo
- [x] dependencias escaneadas
- [x] SBOM disponible

## Calidad

- [ ] typecheck verde como requisito sistemático
- [ ] lint verde como requisito sistemático
- [x] unit verde
- [x] integration verde
- [ ] E2E crítico verde
- [ ] build verde como requisito sistemático
- [ ] CI requerido para merge

## Infraestructura

- [ ] DEV separado
- [ ] STAGING separado
- [ ] PROD separado formalmente
- [ ] rollback documentado
- [ ] backups operativos formalizados
- [ ] restore probado

## Operación

- [ ] health check completo
- [ ] error tracking
- [ ] logs estructurados
- [ ] métricas técnicas
- [ ] auditoría visible
- [ ] runbook incidentes

## Negocio

- [ ] dashboard operativo
- [ ] métricas definidas
- [ ] tendencias históricas
- [ ] excepciones medibles
- [ ] evidencia cuantitativa de valor

## Documentación

- [ ] arquitectura final
- [ ] ERD
- [x] security model
- [x] RBAC formal (`docs/RBAC_MATRIX.md`)
- [ ] deployment
- [ ] ambientes
- [x] testing
- [ ] monitoreo
- [ ] backup/restore final
- [ ] incident response
- [ ] dependencias
- [ ] changelog

## Release

- [ ] `v1.0.0-rc.1` validada
- [ ] cero CRITICAL abiertos
- [ ] HIGH aceptados explícitamente o resueltos
- [ ] demo IT repetible
- [ ] `v1.0.0` etiquetada

---

# Prioridad inmediata

Completado:

1. [x] Baseline/backup.
2. [x] Auditoría arquitectura/seguridad inicial.
3. [x] Modelo definitivo de modalidad/carrier.
4. [x] Fuente única de reglas críticas.
5. [x] Matriz RBAC formal.
6. [x] Hardening Supabase (2.4).
7. [x] Supply-chain security (2.5).
8. [x] Unit testing base (3.1).
9. [x] Integration tests (3.2).

10. [x] E2E críticos (3.3).
11. [x] CI obligatorio (3.4).
12. [x] Staging/ambientes (3.5).

Siguiente:

13. [ ] Observabilidad/DR.
14. [ ] Auditoría visible.
15. [ ] Métricas/dashboard.
16. [ ] UX/performance.
17. [ ] Documentación final/RC/IT.

# Regla para futuros cambios

Toda feature debe responder antes de producción:

1. ¿Qué problema operativo resuelve?
2. ¿Qué rol puede usarla?
3. ¿Cuál es la regla de backend?
4. ¿Qué auditoría genera?
5. ¿Cómo se prueba?
6. ¿Qué métrica evalúa su resultado?
7. ¿Cómo se revierte?
8. ¿Qué documentación actualiza?

Si no puede responderse, no está lista para producción corporativa.
