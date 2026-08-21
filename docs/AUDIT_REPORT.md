# Auditoría del repositorio

## Rutas y Server Actions

Revisado el árbol `src/app`: concentra las superficies de administración, picking, cuenta, manual, tablero y APIs de health, evidencias, exportación y reportes. Las rutas protegidas delegan la autenticación/autorización a layouts, Server Components o handlers según la superficie.

Las mutaciones del dominio están centralizadas en `src/lib/actions`: entregas, evidencias, catálogos, clientes, usuarios y autenticación. Las operaciones críticas pasan a RPCs transaccionales; la auditoría de RPCs, RLS, migraciones e índices se realiza en cortes posteriores.

Alcance pendiente de este informe: RPCs, RLS, migraciones, índices y constraints, lógica duplicada frontend/backend, secretos en Git, y actualización de pruebas.

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

## Hallazgos de cierre

- No se detectaron `TODO`, `FIXME`, `@ts-ignore` ni casts `as any` en el alcance revisado.
- El snapshot productivo y el inventario de Storage permiten continuar la auditoría de seguridad sin depender de producción.
- La divergencia de migraciones y la falta de PITR se registran como riesgos HIGH.

