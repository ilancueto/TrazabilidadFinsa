-- Sprint 2.4: reduce superficie RPC y fija search_path de helpers internos.
-- Las RPC de negocio siguen disponibles para authenticated; anon no debe poder ejecutarlas.

-- Evitar que nuevas funciones creadas por el rol de migraciones hereden EXECUTE para PUBLIC.
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

-- Helpers / trigger functions: no forman parte de la API pública.
revoke all on function public.handle_new_user() from public;
revoke all on function public.enforce_delivery_update() from public;
revoke all on function public.enforce_requirement_mutation() from public;
revoke all on function public.sync_requirement_status() from public;
revoke all on function public.enforce_evidence_update() from public;
revoke all on function public.prevent_audit_mutation() from public;
revoke all on function public.set_updated_at() from public;
revoke all on function public.touch_delivery_from_requirement() from public;

-- Helpers usados por RLS y RPCs: autenticados sí; anónimos no.
revoke all on function public.current_role() from public;
grant execute on function public.current_role() to authenticated, service_role;

revoke all on function public.can_read_delivery(uuid) from public;
grant execute on function public.can_read_delivery(uuid) to authenticated, service_role;

-- RPCs de negocio expuestas únicamente a usuarios autenticados.
revoke all on function public.archive_delivery(uuid, text) from public;
grant execute on function public.archive_delivery(uuid, text) to authenticated, service_role;

revoke all on function public.assign_delivery(uuid, uuid, uuid, public.audit_action) from public;
grant execute on function public.assign_delivery(uuid, uuid, uuid, public.audit_action) to authenticated, service_role;

revoke all on function public.bulk_assign_pallet(uuid[], text) from public;
grant execute on function public.bulk_assign_pallet(uuid[], text) to authenticated, service_role;

revoke all on function public.bulk_assign_picker(uuid[], uuid) from public;
grant execute on function public.bulk_assign_picker(uuid[], uuid) to authenticated, service_role;

revoke all on function public.bulk_assign_unassigned(uuid) from public;
grant execute on function public.bulk_assign_unassigned(uuid) to authenticated, service_role;

revoke all on function public.bulk_close_ready_deliveries(text, text) from public;
grant execute on function public.bulk_close_ready_deliveries(text, text) to authenticated, service_role;

revoke all on function public.day_report(date) from public;
grant execute on function public.day_report(date) to authenticated, service_role;

revoke all on function public.record_observation(uuid, text, boolean) from public;
grant execute on function public.record_observation(uuid, text, boolean) to authenticated, service_role;

revoke all on function public.register_evidence(uuid, uuid, text, text, text, integer, integer, integer, text, text) from public;
grant execute on function public.register_evidence(uuid, uuid, text, text, text, integer, integer, integer, text, text) to authenticated, service_role;

revoke all on function public.register_evidence_v2(uuid, uuid, text, text, text, integer, integer, integer, text, text, text, text, integer) from public;
grant execute on function public.register_evidence_v2(uuid, uuid, text, text, text, integer, integer, integer, text, text, text, text, integer) to authenticated, service_role;

revoke all on function public.review_evidence(uuid, text, text) from public;
grant execute on function public.review_evidence(uuid, text, text) to authenticated, service_role;

revoke all on function public.review_evidence(uuid, text, text, jsonb) from public;
grant execute on function public.review_evidence(uuid, text, text, jsonb) to authenticated, service_role;

revoke all on function public.save_delivery(uuid, public.delivery_status, text, public.delivery_modality, text, integer, public.delivery_priority, uuid, timestamptz, text, text, jsonb, uuid, text, public.delivery_carrier) from public;
grant execute on function public.save_delivery(uuid, public.delivery_status, text, public.delivery_modality, text, integer, public.delivery_priority, uuid, timestamptz, text, text, jsonb, uuid, text, public.delivery_carrier) to authenticated, service_role;

revoke all on function public.save_delivery_template(uuid, jsonb) from public;
grant execute on function public.save_delivery_template(uuid, jsonb) to authenticated, service_role;

revoke all on function public.transition_delivery(uuid, public.delivery_status, public.delivery_status, public.audit_action, jsonb) from public;
grant execute on function public.transition_delivery(uuid, public.delivery_status, public.delivery_status, public.audit_action, jsonb) to authenticated, service_role;

revoke all on function public.void_evidence(uuid, text) from public;
grant execute on function public.void_evidence(uuid, text) to authenticated, service_role;

-- El linter detectó estos helpers con search_path mutable.
alter function public.touch_delivery_from_requirement() set search_path = public;
alter function public.prevent_audit_mutation() set search_path = public;
alter function public.enforce_evidence_update() set search_path = public;
alter function public.set_updated_at() set search_path = public;
