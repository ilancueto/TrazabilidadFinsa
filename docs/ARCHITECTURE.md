# Arquitectura

## Superficies

- `/login` — email/password (Supabase Auth)
- `/admin` — dashboard y detalle; Supervisor accede en modo lectura
- `/admin/revision` — bandeja y revisión de evidencias
- `/admin/dia` — cierre histórico y Excel
- `/admin/requisitos`, `/admin/usuarios` — catálogos de Administración
- `/tablero` — vista operativa de lectura
- `/picking` — bandeja móvil, checklist, captura
- `/api/health` — liveness
- `/api/evidence/:id/file` — descarga autorizada (RLS + sesión)

## Datos

`Delivery → DeliveryRequirement → Evidence[]`

El catálogo `requirement_types` + `delivery_templates` permite sumar modalidades sin hardcodear el modelo. Las plantillas Andreani / Retira cliente sólo proponen el set inicial.

## AuthZ

1. Server Actions validan sesión, rol y datos de entrada.
2. Las mutaciones críticas llaman RPC transaccionales: entrega, transición, asignación, revisión, evidencia y plantillas.
3. RLS en Postgres como defensa en profundidad.
4. Triggers mantienen el progreso y las RPC escriben auditoría en la misma transacción.
5. El rol del cliente no se usa para autorizar.

## Storage

`EvidenceStorage` abstrae el proveedor:

- `upload`
- `getAuthorizedUrl`
- `download`
- `void`

Implementación actual: `SupabaseEvidenceStorage` con service role. El browser no habla con Storage. Las fotos se sirven por `/api/evidence/:id/file` después de pasar RLS.

Clave: `{año}/{mes}/{número}/{requisito}/{id}.ext`

Anular no borra en silencio: marca `voided_*` en DB y mueve el objeto a `voided/`.

## Estados

`DRAFT → PUBLISHED → IN_PICKING → READY → CLOSED`

La observación es un flag (`has_open_observation`), no un estado. Ver `docs/DECISIONS.md`.

Los reportes históricos se derivan de `audit_events`; los timestamps mutables de `deliveries` son sólo un resumen del estado actual.

## PDF

Ruta server-side `/admin/deliveries/:id/report`. No usa `window.print()`.
