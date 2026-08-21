-- Bloquea UPDATE directo de public.evidences por PostgREST.
-- Anulación y revisión siguen por RPCs SECURITY DEFINER (void_evidence, review_evidence).
-- register_evidence_v2 actualiza el thumbnail como definer; no necesita policy de authenticated.
-- No toca evidences_select, evidences_insert ni evidences_delete_admin.

drop policy if exists "evidences_update_void" on public.evidences;

revoke update on table public.evidences from authenticated;
revoke update on table public.evidences from anon;

-- Rollback (no aplicar en cadena; sólo si hay que revertir esta migración):
--
-- grant update on table public.evidences to authenticated;
-- create policy evidences_update_void on public.evidences
--   for update to authenticated
--   using (
--     exists (
--       select 1
--       from public.delivery_requirements r
--       join public.deliveries d on d.id = r.delivery_id
--       where r.id = requirement_id
--         and public.can_read_delivery(d.id)
--         and d.status <> 'CLOSED'
--     )
--   )
--   with check (
--     exists (
--       select 1
--       from public.delivery_requirements r
--       join public.deliveries d on d.id = r.delivery_id
--       where r.id = requirement_id
--         and public.can_read_delivery(d.id)
--         and d.status <> 'CLOSED'
--     )
--   );
