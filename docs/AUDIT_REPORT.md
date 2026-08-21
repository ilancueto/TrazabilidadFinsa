# Auditoría del repositorio

## Rutas y Server Actions

Revisado el árbol `src/app`: concentra las superficies de administración, picking, cuenta, manual, tablero y APIs de health, evidencias, exportación y reportes. Las rutas protegidas delegan la autenticación/autorización a layouts, Server Components o handlers según la superficie.

Las mutaciones del dominio están centralizadas en `src/lib/actions`: entregas, evidencias, catálogos, clientes, usuarios y autenticación. Las operaciones críticas pasan a RPCs transaccionales.

Alcance pendiente de este informe: actualización de pruebas (Sprint 3).

## Permisos y estados

`getSessionUser` exige un usuario autenticado con perfil `active`; `requireSession` también desvía a cambio de clave cuando corresponde. Las decisiones de dominio se concentran en `src/lib/deliveries/permissions.ts`: ADMIN opera administración, cierres y catálogo; PICKING sólo puede trabajar entregas activas y tomar/liberar las asignadas según la regla; SUPERVISOR conserva acceso de consulta/reportes.

La máquina `src/lib/deliveries/state.ts` permite `DRAFT → PUBLISHED`, `PUBLISHED → IN_PICKING`, `IN_PICKING → READY`, `READY → CLOSED` y las devoluciones administrativas `READY/CLOSED → IN_PICKING`; las acciones de entrega auditadas validan rol, estado y, cuando aplica, la precondición de progreso antes de invocar las RPCs transaccionales. Las pruebas unitarias cubren las transiciones y denegaciones principales.

## Progreso y cierre

`computeProgress` toma sólo requisitos aplicables y separa las etapas `FLOOR` y `DISPATCH`. Una evidencia activa —no anulada ni rechazada— satisface el requisito; los requisitos obligatorios de piso bloquean `READY`, mientras que los de despacho bloquean únicamente el cierre. La misma función alimenta las consultas, acciones de marcar lista/cerrar y la interfaz de picking, con pruebas para requisitos no aplicables, evidencia activa y etiquetas de despacho.

## Evidencias

La carga requiere sesión activa, valida tamaño máximo de 8 MiB, requisito aplicable, estado permitido y contenido de imagen antes de almacenar. Registra checksum y metadatos mediante `register_evidence_v2`; si el registro falla, intenta compensar el objeto subido. Las evidencias anuladas se marcan primero en base y luego se mueven a `voided/`; la revisión está limitada a ADMIN y la descarga exige autenticación, rechaza IDs inválidos y no entrega evidencias anuladas. Hay pruebas de MIME, rutas de almacenamiento y persistencia contra Supabase local; esta última no forma parte de la suite unitaria estándar.

## Exportaciones

PDF, ZIP y Excel exigen ADMIN o SUPERVISOR. El PDF y el ZIP incluyen sólo evidencias activas y manejan archivos no disponibles sin exponerlos; el ZIP limita cada lote a 50 entregas y descarga imágenes con concurrencia acotada. La exportación Excel valida el rango de fechas y usa `private, no-store`; los tres formatos declaran tipo y nombre de descarga. No hay pruebas automatizadas específicas de exportación, por lo que quedan en la actualización de pruebas del plan.

## Consultas Supabase

Hay tres clientes. `createServerSupabase()` usa la sesión y queda sujeto a RLS: concentra las lecturas de dominio en `src/lib/deliveries/queries.ts` y `src/lib/clients/queries.ts`, y las mutaciones de entregas, evidencias, observaciones, asignaciones, plantillas y clientes. `createAdminClient()` (service role) se usa para usuarios Auth/perfiles, altas y bajas de `requirement_types`, Storage y el health check. `createBrowserSupabase()` no consulta tablas: sólo se suscribe a `postgres_changes` de `deliveries`.

Las lecturas de entregas filtran `deleted_at` salvo cuando se pide archivo (`includeArchived` o el reporte de día). El listado pagina de a 50 y carga requisitos en un segundo `in (ids)`; el detalle pide entrega, perfiles, requisitos, evidencias y auditoría. Los KPI de sección son cuatro `count` en paralelo; el tablero global y el cierre de día van por RPC. `writeAudit` no tiene llamadas: las RPCs escriben `audit_events`.

Service role queda justificado en Auth admin y Storage, donde no hay policy de usuario. El catálogo de tipos y la actualización de `must_change_password` también lo usan, de modo que la autorización depende de `requireRole` en la Server Action y no de RLS. `/api/health` consulta `requirement_types` con service role sin autenticación; no expone filas.

Hallazgos:

- `MEDIUM`: `GET /api/deliveries/check-number` admite cualquier sesión y devuelve `number`, `status`, `destination`, `created_at` y `closed_at`. El formulario de alta es de admin, pero el endpoint no restringe rol ni se limita a `{ exists }`.
- `MEDIUM`: escrituras de catálogo (`requirement_types`, `template_requirements`) y de perfiles pasan por service role; queda para el hardening de Sprint 2.4.
- `LOW`: `countDeliveries` no replica el filtro `palletCode` de `listDeliveries`. El inbox actual no pasa ese filtro, así que no distorsiona la paginación hoy.
- `LOW`: `listClients` registra el error y devuelve `[]`, ocultando fallos de lectura.
- `LOW`: el canal Realtime del navegador escucha toda la tabla `deliveries`; el recorte de filas depende de RLS.
- `CLEANUP`: `destination_presets` no tiene consultas en `src/`; `writeAudit` está sin uso.

## RPCs

Fuente: snapshot productivo `supabase/schema-baselines/v0.9-baseline-public.sql` y llamadas en `src/`. Las mutaciones de dominio invocadas por la app son `SECURITY DEFINER` con `search_path = public` y comprueban `auth.uid()` más rol activo en `profiles`.

| RPC | App | Autorización en función |
| --- | --- | --- |
| `save_delivery` (con `client_id`/`pallet_code`) | crear/editar/duplicar | ADMIN activo |
| `transition_delivery` | READY/CLOSED/RETURNED/REOPENED | ADMIN; PICKING sólo a READY |
| `assign_delivery` | tomar/soltar/reasignar | PICKING (propia o libre) o ADMIN |
| `bulk_assign_unassigned` | asignar libres | ADMIN |
| `bulk_assign_pallet` | lote | ADMIN |
| `bulk_assign_picker` | responsables en lote | ADMIN o SUPERVISOR |
| `archive_delivery` | archivo | ADMIN + número de confirmación |
| `record_observation` | alta/resolución | ADMIN/PICKING; resolver sólo ADMIN |
| `register_evidence_v2` | carga | ADMIN/PICKING; en READY sólo etapa DISPATCH |
| `void_evidence` | anulación | ADMIN/PICKING; no DRAFT/CLOSED |
| `review_evidence` (con markup) | revisión | ADMIN; entrega READY |
| `save_delivery_template` | plantillas | ADMIN |
| `bulk_close_ready_deliveries` | cierre excepcional | ADMIN + texto `CERRAR TODAS` |
| `dashboard_kpis` | tablero | no definer; aplica RLS |
| `day_report` | cierre de día | definer; filtra ADMIN/SUPERVISOR |

`register_evidence_v2` delega en `register_evidence` y luego guarda el thumbnail. `bulk_close_ready_deliveries` en el snapshot cierra **toda** entrega no `CLOSED` y registra `forced`/`bypassed*` en auditoría: coincide con el cierre excepcional de la UI, no con el nombre de la función.

Quedan sobrecargas ejecutables sin uso en `src/`: `save_delivery` de 12 argumentos (sin cliente/pallet) y `review_evidence` de 3 argumentos (sin markup). Casi todas las funciones, incluidas las `SECURITY DEFINER`, tienen `GRANT ALL` a `anon` en el dump; `bulk_close_ready_deliveries` y `dashboard_kpis` sí revocan `PUBLIC`/`anon`. El cuerpo sigue exigiendo sesión y rol, así que `anon` sin JWT no opera, pero el grant sobra.

Hallazgos:

- `MEDIUM`: `GRANT ALL … TO anon` en RPCs privilegiadas. Revocar en Sprint 2.4.
- `MEDIUM`: `bulk_assign_picker` no exige que el destinatario sea PICKING activo ni excluye `DRAFT`/`CLOSED`.
- `LOW`: `bulk_assign_pallet` puede etiquetar entregas cerradas o borrador.
- `CLEANUP`: retirar o bloquear las sobrecargas viejas de `save_delivery` y `review_evidence`.

## RLS

El snapshot productivo tiene RLS habilitado en las diez tablas de `public`: `audit_events`, `clients`, `deliveries`, `delivery_requirements`, `delivery_templates`, `destination_presets`, `evidences`, `profiles`, `requirement_types` y `template_requirements`. No hay policies para `anon`; con RLS activo eso deniega filas, aunque el dump otorga `GRANT ALL` de tablas a `anon`. Las policies son para `authenticated` y delegan el rol en `current_role()` (`active` y `deleted_at is null`).

Lectura: ADMIN/SUPERVISOR ven todas las entregas; PICKING ve `status <> DRAFT`. Requisitos, evidencias y auditoría cuelgan de `can_read_delivery`. Catálogo y clientes son `SELECT` abierto a cualquier sesión. `profiles_select` es `USING (true)`: cualquier usuario autenticado lee todos los perfiles, incluidos inactivos. Storage no tiene policies: el acceso pasa por service role, ya documentado.

Escritura de tabla (no RPC): insert/update/delete de entregas y requisitos es ADMIN, salvo `deliveries_update`, que también permite a PICKING cualquier fila no `DRAFT` ni `CLOSED`. El trigger `enforce_delivery_update` bloquea maestros y el cierre, pero no `deleted_at`, `status` distinto de `CLOSED`, observaciones, `client_id` ni `pallet_code`. `evidences_update_void` permite actualizar evidencias de entregas no cerradas a quien pueda leerlas; el trigger sólo inmuta archivo y metadatos de carga, no `voided_at` ni `review_status`. `audit_insert` deja insertar eventos a quien `can_read_delivery`. No hay policies de UPDATE/DELETE en `profiles`: esas escrituras van por service role.

Hallazgos:

- `HIGH`: un cliente con JWT de PICKING puede `UPDATE deliveries` directo y archivar (`deleted_at`), marcar `READY` o alterar observaciones/lote sin pasar por las RPCs.
- `HIGH`: `evidences_update_void` y `audit_insert` permiten anular/revisar fotos o fabricar auditoría sin las RPCs.
- `MEDIUM`: `GRANT ALL` de tablas a `anon` (mitigado por RLS sin policy de `anon`).
- `MEDIUM`: `profiles` es legible por cualquier sesión autenticada.
- `CLEANUP`: `destination_presets` tiene RLS y no se consulta desde `src/`.

## Migraciones

Hay 23 archivos en `supabase/migrations/`, de `20260813120000_init.sql` a `20260820230305_force_close_all_active_deliveries.sql`. Cubren el esquema inicial, RLS, catálogo, auditoría, workflow RPC, evidencias, clientes/lotes, índices y el cierre excepcional. Varias reemplazan la misma función (`save_delivery`, `register_evidence`, `bulk_close_ready_deliveries`): el archivo posterior es la definición vigente en el repo.

El historial remoto coincide tras alinear los cuatro timestamps redondeados a las versiones ya aplicadas (`docs/MIGRATION_RECONCILIATION.md`). El snapshot `v0.9-baseline-public.sql` coincide en objetos aplicativos con un reset local. No se aplicó nada en producción.

Hay DML mezclado con DDL: `20260815211205` actualiza `must_change_password` desde `auth.users`; `20260818220000` inserta once clientes demo; `20260820120000` actualiza/inserta tipos `DISPATCH`. Esos inserts usan `on conflict` / `where not exists`, así que reaplicar no duplica, pero un ambiente vacío nace con datos de negocio.

Hallazgos:

- `LOW`: timestamps git redondeados vs versiones remotas; alineado por rename, sin `repair`. Ver `docs/MIGRATION_RECONCILIATION.md`.
- `MEDIUM`: migraciones con semilla de clientes y catálogo; no son sólo esquema.
- `LOW`: sobrecargas viejas de RPC quedan en el snapshot porque los `create or replace` no eliminan firmas anteriores.

## Índices y constraints

Fuente: snapshot `v0.9-baseline-public.sql`. Las diez tablas tienen PK. Unicidad: `clients.name` más `clients_name_ci` (`lower(name)`); `deliveries.number` más `deliveries_number_ci`; un requisito por tipo y entrega; un template por `code` y por `modality` (como mucho dos plantillas); `requirement_types.code`; un tipo por plantilla. Checks: `packages > 0`, `evidences.size_bytes > 0`, `review_status` ∈ PENDING/ACCEPTED/REJECTED, `stage` ∈ FLOOR/DISPATCH.

FK coherentes con el dominio: evidencias `ON DELETE RESTRICT` sobre el requisito; requisitos y auditoría `ON DELETE CASCADE` sobre la entrega (el archivo operativo es soft-delete, así que no borra historial). `assignee_id` no tiene `ON DELETE SET NULL`; alinea con el borrado lógico de perfiles. No hay unique en `evidences.storage_key`.

Índices cubren listados (`status` + `updated_at` parcial `deleted_at is null`), assignee, client, pallet, prioridad, observación abierta, picking activo y `pg_trgm` en número/destino/pallet. Hay duplicados exactos: `audit_events_delivery_idx` = `idx_audit_events_delivery_created`; `evidences_active_idx` = `idx_evidences_req_active`; `deliveries_client_idx` = `idx_deliveries_client_id`. `deliveries_status_idx` queda cubierto por `deliveries_active_status_idx`. La exportación Excel filtra `audit_events.created_at` sin índice que lidere por esa columna.

Hallazgos:

- `LOW`: índices duplicados (`idx_*` vs nombres de dominio) a limpiar cuando haya migración reconciliada.
- `LOW`: no hay unique de `storage_key`; el id de evidencia en el path reduce colisiones.
- `LOW`: falta índice por `audit_events.created_at` para el rango del Excel; relevante si el historial crece.

## Lógica duplicada frontend/backend

Las reglas viven en tres capas: UI (`permissions.ts` en componentes), Server Actions (vuelven a llamar las mismas funciones y, a veces, `computeProgress`/`assertTransition`) y RPCs `SECURITY DEFINER`. El patrón es defensa en profundidad, no una sola fuente.

Alineado en lo grueso: crear/editar/cerrar/reabrir/devolver son ADMIN; PICKING marca lista y carga evidencias fuera de DRAFT/CLOSED; revisión de fotos es ADMIN; `computeProgress` y `transition_delivery` usan evidencia activa no rechazada / `status <> COMPLETE` (el trigger `sync_requirement_status` los mantiene cerca).

Divergencias concretas:

- `canReleaseDelivery` permite a PICKING soltar en `READY`; `assign_delivery` sólo admite PICKING en `PUBLISHED`/`IN_PICKING`. El botón puede mostrarse y la RPC rechazar.
- `canUploadEvidence` no distingue etapa; `register_evidence` en `READY` sólo acepta `DISPATCH`. La pantalla de carga de piso en lista queda al rechazo de la RPC.
- `canClose` no mira observación abierta; el botón Cerrar se habilita y fallan action/RPC. Sí deshabilita si faltan etiquetas.
- `state.ts` declara `PUBLISHED → IN_PICKING`; esa transición no existe en `transition_delivery` (la hace `register_evidence`).
- `bulk_assign_picker` admite SUPERVISOR; `canReassignDelivery` es sólo ADMIN.
- `TEMPLATE_SPECS` en `templates.ts` duplica el catálogo de `delivery_templates` y se usa si la plantilla de base viene vacía.
- `writeAudit` duplica inserciones que ya hacen las RPCs y no tiene llamadas.

Queda para Sprint 2.2 unificar la matriz: el frontend refleja reglas, el servidor las impone una sola vez.

## Secretos en Git

No hay claves de producción, JWT, PEM ni `.env` rastreados. `.gitignore` cubre `.env*`, `*.pem`, `certificates/` y `archivos/` (backup local). CI usa `ci-placeholder-*-key`. `.env.example` tiene placeholders `replace-with-*-from-supabase-start`, pero la segunda regla `.env*` de `.gitignore` (línea 55) anula el `!.env.example` y el archivo no está versionado.

`scripts/seed.ts`, `smoke.ts`, `diagnose-upload.ts`, `test-upload-http.ts` y `persist.test.ts` usan la contraseña local `CatLocal123!` para usuarios `*@cat.local`. No es un secreto de producción; no debe reutilizarse fuera de Supabase local.

No aparecen `BEGIN PRIVATE KEY`, `sk_live`, `ghp_` ni `AKIA` en el árbol rastreado. El escaneo automático de secretos queda para Sprint 2.5.

Hallazgos:

- `LOW`: contraseña de seed local versionada; acotar a entornos de desarrollo.
- `CLEANUP`: la segunda regla `.env*` impide commitear `.env.example`.

## Hallazgos de cierre

- No se detectaron `TODO`, `FIXME`, `@ts-ignore` ni casts `as any` en el alcance revisado.
- El snapshot productivo y el inventario de Storage permiten continuar la auditoría de seguridad sin depender de producción.
- La divergencia de migraciones y la falta de PITR se registran como riesgos HIGH.
- Sprint 1.2 queda documentado. El único checkbox abierto de 1.1 es la equivalencia de migraciones (historial divergente). El backup local está cifrado y verificado; el plano se conservó. No se inicia Sprint 2.1 hasta reconciliar el historial.

