# Modelo de seguridad — FINSA Trazabilidad

## Alcance

Este documento describe el modelo efectivo de seguridad después del hardening de Sprint 2.4.

La autorización se basa en tres capas complementarias:

1. sesión Supabase Auth;
2. rol operativo en `public.profiles` (`PICKING`, `SUPERVISOR`, `ADMIN`);
3. validación final en RLS y RPCs de negocio.

La UI no es autoridad de seguridad.

## Identidad y usuario efectivo

`public.current_role()` devuelve rol únicamente cuando el perfil:

- corresponde a `auth.uid()`;
- está `active = true`;
- no está eliminado (`deleted_at is null`).

Las rutas de servidor también exigen perfil activo. Un JWT válido por sí solo no concede autoridad de negocio a un usuario deshabilitado.

## RLS

Las 10 tablas de negocio en `public` tienen RLS habilitado:

- `audit_events`
- `clients`
- `deliveries`
- `delivery_requirements`
- `delivery_templates`
- `destination_presets`
- `evidences`
- `profiles`
- `requirement_types`
- `template_requirements`

`anon` no conserva privilegios de tabla ni de secuencia sobre `public`.

Las mutaciones críticas que antes admitían caminos directos fueron cerradas durante la remediación previa: `deliveries UPDATE`, `evidences UPDATE` y `audit_events INSERT` no dependen de una policy permisiva del cliente.

## SECURITY DEFINER

Las funciones privilegiadas tienen `search_path` explícito. Los helpers de trigger no son ejecutables directamente por `anon` ni `authenticated`.

Las RPCs de negocio que permanecen ejecutables por `authenticated` lo hacen de forma intencional: son la frontera de mutación de la aplicación y validan `auth.uid()`, rol y/o estado en backend.

RPCs de negocio revisadas:

- `archive_delivery`
- `assign_delivery`
- `bulk_assign_pallet`
- `bulk_assign_picker`
- `bulk_assign_unassigned`
- `bulk_close_ready_deliveries`
- `record_observation`
- `register_evidence` / `register_evidence_v2`
- `review_evidence`
- `save_delivery`
- `save_delivery_template`
- `transition_delivery`
- `void_evidence`
- `day_report`

Helpers de RLS deliberadamente ejecutables por `authenticated`:

- `current_role`
- `can_read_delivery`

Los warnings del linter `authenticated_security_definer_function_executable` son aceptados únicamente para esta lista; no significan que cualquier rol pueda realizar la acción. La autorización fina está dentro de la RPC y se corresponde con `docs/RBAC_MATRIX.md`.

## Storage de evidencias

Bucket: `evidences`.

Controles:

- bucket privado;
- escritura/lectura de objetos mediante service role exclusivamente en código servidor;
- sin policies de cliente sobre `storage.objects`;
- límite de objeto: 8 MiB;
- MIME del bucket: `image/jpeg`, `image/png`, `image/webp`;
- validación de magic bytes en servidor antes de persistir;
- HEIC/HEIF se normaliza a JPEG antes de guardar;
- paths generados por servidor;
- trigger DB `evidences_validate_storage_binding` verifica que el objeto exista en el bucket correcto, que la key incluya el UUID de evidencia y que MIME/tamaño coincidan con `storage.objects`;
- thumbnails se validan de la misma forma y sólo admiten WebP;
- evidencias anuladas quedan marcadas en DB y el objeto se mueve bajo `voided/` cuando Storage lo permite.

## URLs firmadas

Las evidencias no son públicas. El backend crea URLs firmadas con expiración actual de 2 horas.

La firma se realiza sólo después de que la aplicación haya obtenido una fila de evidencia mediante las consultas autorizadas; una evidencia anulada se excluye de los mapas de URLs normales.

## API sensible

`GET /api/deliveries/check-number` queda restringido a `ADMIN` y sólo responde `exists`; no entrega estado, destino ni fechas de otras entregas.

## Hallazgos aceptados / operativos

### `pg_trgm` en `public`

Supabase Advisor advierte que `pg_trgm` vive en `public`. Actualmente tres índices productivos dependen de `gin_trgm_ops` para búsquedas de número, destino y pallet. Mover la extensión sólo para eliminar el warning agrega riesgo de migración y no corrige una exposición explotable por sí misma. Se registra como LOW y se difiere hasta una ventana de mantenimiento o reconstrucción controlada de índices.

### Protección de contraseñas filtradas

Supabase Advisor informa `auth_leaked_password_protection` deshabilitado. Debe habilitarse desde la configuración de Auth si el plan/proyecto lo permite. El conector disponible no expone esa mutación; queda como configuración operativa explícita pendiente, no como cambio de código.

## Principio de cambios futuros

Toda nueva mutación crítica debe:

1. validar identidad/rol en backend;
2. usar `search_path` fijo si es `SECURITY DEFINER`;
3. revocar ejecución a `anon`;
4. conceder `authenticated` sólo si es una RPC pública intencional;
5. mantener auditoría;
6. contar con prueba de rechazo para roles no autorizados en la suite de integración.