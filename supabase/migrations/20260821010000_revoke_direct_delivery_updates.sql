-- Bloquea UPDATE directo de public.deliveries por PostgREST.
-- Las mutaciones siguen por RPCs SECURITY DEFINER (save_delivery, transition_delivery, etc.).
-- No toca deliveries_select, deliveries_insert_admin ni deliveries_delete_admin.

drop policy if exists "deliveries_update" on public.deliveries;

revoke update on table public.deliveries from authenticated;
revoke update on table public.deliveries from anon;

-- Rollback (no aplicar en cadena; sólo si hay que revertir esta migración):
--
-- grant update on table public.deliveries to authenticated;
-- create policy deliveries_update on public.deliveries
--   for update to authenticated
--   using (
--     public.current_role() = 'ADMIN'
--     or (public.current_role() = 'PICKING' and status <> 'DRAFT' and status <> 'CLOSED')
--   )
--   with check (
--     public.current_role() = 'ADMIN'
--     or (public.current_role() = 'PICKING' and status <> 'DRAFT' and status <> 'CLOSED')
--   );
