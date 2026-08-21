-- Bloquea INSERT directo de public.audit_events por PostgREST.
-- Las RPCs SECURITY DEFINER (transition_delivery, record_observation, void_evidence, etc.) siguen insertando.
-- No toca audit_select. No abre UPDATE ni DELETE. No toca prevent_audit_mutation.

drop policy if exists "audit_insert" on public.audit_events;

revoke insert on table public.audit_events from authenticated;
revoke insert on table public.audit_events from anon;

-- Rollback (no aplicar en cadena; sólo si hay que revertir esta migración):
--
-- grant insert on table public.audit_events to authenticated;
-- create policy audit_insert on public.audit_events
--   for insert to authenticated
--   with check (
--     public.can_read_delivery(delivery_id)
--     or (
--       public.current_role() = 'ADMIN'
--       and exists (select 1 from public.deliveries d where d.id = delivery_id)
--     )
--   );
