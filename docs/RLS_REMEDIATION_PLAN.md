# Plan de remediación RLS — mutaciones directas

PR 1 y PR 2 tienen migración versionada. PR 3 sigue **sin ejecutar**. No aplicar PR 3 a producción en este corte.

Objetivo: las mutaciones de entregas, evidencias (anular/revisar) y auditoría sólo ocurran por RPCs `SECURITY DEFINER`. Un cliente con JWT de `authenticated` no debe poder `UPDATE`/`INSERT` esas filas por PostgREST.

Las funciones actuales (`transition_delivery`, `assign_delivery`, `save_delivery`, `void_evidence`, `review_evidence`, etc.) son `SECURITY DEFINER` con dueño `postgres`: siguen pudiendo escribir si se quitan las policies de `authenticated`. `service_role` también elude RLS; no usarlo para estas tres tablas en la app.

Cada corrección es un PR propio, una migración propia, con rollback y pruebas. No mezclar las tres en un solo cambio.

## Precondiciones

- Probar en Supabase local (`npm run db:reset` + seed) o staging descartable.
- Historial de migraciones alineado (1.1). Cada PR se aplica a producción sólo después de CI + Preview y `migration list` 1:1.
- Confirmar que `src/` no hace `.from("deliveries").update`, `.from("evidences").update` ni `.from("audit_events").insert` salvo `writeAudit` (sin llamadas).

## PR 1 — Bloquear UPDATE directo de `deliveries`

Riesgo: `deliveries_update` deja a PICKING (y a ADMIN) actualizar cualquier columna, incluido `deleted_at` y `status`, sin pasar por RPC.

### Cambio

Migración: `supabase/migrations/20260821010000_revoke_direct_delivery_updates.sql`. Pruebas: `src/lib/supabase/rls-deliveries-update.integration.test.ts`.

```sql
drop policy if exists "deliveries_update" on public.deliveries;
revoke update on table public.deliveries from authenticated;
revoke update on table public.deliveries from anon;
```

No tocar `deliveries_select`, `deliveries_insert_admin` ni `deliveries_delete_admin`.

### Rollback

```sql
grant update on table public.deliveries to authenticated;
create policy deliveries_update on public.deliveries
  for update to authenticated
  using (
    public.current_role() = 'ADMIN'
    or (public.current_role() = 'PICKING' and status <> 'DRAFT' and status <> 'CLOSED')
  )
  with check (
    public.current_role() = 'ADMIN'
    or (public.current_role() = 'PICKING' and status <> 'DRAFT' and status <> 'CLOSED')
  );
```

Guardar el rollback como comentario en la migración o como archivo siguiente `*_restore_deliveries_update.sql` listo para aplicar si hay que revertir.

### Pruebas (integración local)

Archivo tentativo: `src/lib/supabase/rls-deliveries-update.integration.test.ts`

1. Sesión PICKING: `from("deliveries").update({ status: "READY" })` sobre una entrega `IN_PICKING` → 0 filas o error.
2. Sesión PICKING: `update({ deleted_at: now() })` → denegado.
3. Sesión ADMIN (anon key + JWT, no service role): el mismo `update` → denegado.
4. `rpc("transition_delivery", …)` PICKING `IN_PICKING → READY` con piso completo → ok.
5. `rpc("save_delivery", …)` ADMIN → ok.
6. `select` de entregas no DRAFT para PICKING → sigue funcionando.

Correr con `npm run test:integration`. No añadir este spec a `npm run verify` si el runner de CI no tiene Supabase local (hoy no lo tiene).

### Criterio de listo

PICKING no puede archivar ni cambiar estado por PostgREST. El flujo de picking por RPC no se rompe.

---

## PR 2 — Bloquear anulación/revisión directa de `evidences`

Riesgo: `evidences_update_void` permite actualizar `voided_at` y `review_status` a quien `can_read_delivery` y la entrega no está `CLOSED`. El trigger `enforce_evidence_update` no inmuta esos campos.

### Cambio

Migración: `supabase/migrations/20260821120000_revoke_direct_evidence_updates.sql`. Pruebas: `src/lib/supabase/rls-evidences-update.integration.test.ts`.

```sql
drop policy if exists "evidences_update_void" on public.evidences;
revoke update on table public.evidences from authenticated;
revoke update on table public.evidences from anon;
```

Conservar `evidences_select`, `evidences_insert` y `evidences_delete_admin`. La carga sigue por `register_evidence_v2` (INSERT). Miniaturas: `register_evidence_v2` hace UPDATE del thumbnail **dentro** de la función definer; no necesita policy de `authenticated`.

### Rollback

```sql
grant update on table public.evidences to authenticated;
create policy evidences_update_void on public.evidences
  for update to authenticated
  using (
    exists (
      select 1
      from public.delivery_requirements r
      join public.deliveries d on d.id = r.delivery_id
      where r.id = requirement_id
        and public.can_read_delivery(d.id)
        and d.status <> 'CLOSED'
    )
  )
  with check (
    exists (
      select 1
      from public.delivery_requirements r
      join public.deliveries d on d.id = r.delivery_id
      where r.id = requirement_id
        and public.can_read_delivery(d.id)
        and d.status <> 'CLOSED'
    )
  );
```

### Pruebas

`src/lib/supabase/rls-evidences-update.integration.test.ts`

1. PICKING: `from("evidences").update({ voided_at: now(), void_reason: "x" })` → denegado.
2. PICKING o ADMIN JWT: `update({ review_status: "ACCEPTED" })` → denegado.
3. `rpc("void_evidence", …)` con motivo válido en estado permitido → ok; la fila queda anulada.
4. ADMIN `rpc("review_evidence", …)` en READY → ok.
5. `persistEvidence` (INSERT + `register_evidence_v2`) → ok, thumbnail persistido.

### Criterio de listo

No hay anulación ni revisión por tabla. UI de anular/revisar sigue usando las RPCs.

---

## PR 3 — Bloquear INSERT directo de `audit_events`

Riesgo: `audit_insert` permite fabricar eventos a quien `can_read_delivery`. `prevent_audit_mutation` sólo cubre UPDATE/DELETE.

### Cambio

`*_revoke_direct_audit_inserts.sql`

```sql
drop policy if exists "audit_insert" on public.audit_events;
revoke insert on table public.audit_events from authenticated;
revoke insert on table public.audit_events from anon;
```

Conservar `audit_select`. No abrir UPDATE/DELETE.

### Rollback

```sql
grant insert on table public.audit_events to authenticated;
create policy audit_insert on public.audit_events
  for insert to authenticated
  with check (
    public.can_read_delivery(delivery_id)
    or (
      public.current_role() = 'ADMIN'
      and exists (select 1 from public.deliveries d where d.id = delivery_id)
    )
  );
```

### Pruebas

`src/lib/supabase/rls-audit-insert.integration.test.ts`

1. PICKING y ADMIN JWT: `from("audit_events").insert({ delivery_id, action: "CLOSED" })` → denegado.
2. `rpc("transition_delivery" | "record_observation" | "void_evidence")` → inserta el evento esperado.
3. `select` de auditoría en el detalle de entrega → ok.
4. Confirmar que `writeAudit` sigue sin usarse; no reactivarlo contra el cliente de sesión.

### Criterio de listo

El historial sólo crece desde RPCs. Lectura intacta.

---

## Orden y promoción

1. Mergear PR 1 → 2 → 3 en `main` (o en paralelo si no se pisan; tocan policies distintas).
2. Cada uno: CI `verify` + Preview Vercel. Integración local **antes** de marcar ready.
3. Staging (cuando exista): aplicar las tres migraciones y repetir las pruebas.
4. Producción: aplicar **una migración por release**, con rollback listo. PR 3 no en el mismo corte que PR 2.

## Fuera de este plan

- Grants `EXECUTE` a `anon` en RPCs (MEDIUM, Sprint 2.4).
- `bulk_assign_picker` sin validar picker (MEDIUM).
- `/api/deliveries/check-number` (MEDIUM).
- Modalidad `ANDREANI → DESPACHO` (Sprint 2.1).
- `FORCE ROW LEVEL SECURITY` sobre el dueño `postgres` (rompería las RPCs definer).
