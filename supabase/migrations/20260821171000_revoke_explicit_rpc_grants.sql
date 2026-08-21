-- Sprint 2.4: Supabase había materializado grants explícitos a anon/authenticated/service_role.
-- Revocamos anon de todas las RPC de aplicación y exposición directa de helpers de trigger.

-- Helpers/RPCs utilizados por usuarios autenticados: quitar sólo anon.
revoke execute on function public.current_role() from anon;
revoke execute on function public.can_read_delivery(uuid) from anon;
revoke execute on function public.archive_delivery(uuid, text) from anon;
revoke execute on function public.assign_delivery(uuid, uuid, uuid, public.audit_action) from anon;
revoke execute on function public.bulk_assign_pallet(uuid[], text) from anon;
revoke execute on function public.bulk_assign_picker(uuid[], uuid) from anon;
revoke execute on function public.bulk_assign_unassigned(uuid) from anon;
revoke execute on function public.bulk_close_ready_deliveries(text, text) from anon;
revoke execute on function public.day_report(date) from anon;
revoke execute on function public.record_observation(uuid, text, boolean) from anon;
revoke execute on function public.register_evidence(uuid, uuid, text, text, text, integer, integer, integer, text, text) from anon;
revoke execute on function public.register_evidence_v2(uuid, uuid, text, text, text, integer, integer, integer, text, text, text, text, integer) from anon;
revoke execute on function public.review_evidence(uuid, text, text) from anon;
revoke execute on function public.review_evidence(uuid, text, text, jsonb) from anon;
revoke execute on function public.save_delivery(uuid, public.delivery_status, text, public.delivery_modality, text, integer, public.delivery_priority, uuid, timestamptz, text, text, jsonb, uuid, text, public.delivery_carrier) from anon;
revoke execute on function public.save_delivery_template(uuid, jsonb) from anon;
revoke execute on function public.transition_delivery(uuid, public.delivery_status, public.delivery_status, public.audit_action, jsonb) from anon;
revoke execute on function public.void_evidence(uuid, text) from anon;

-- Trigger/helpers internos: no deben ser invocables por REST ni por usuarios finales.
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.enforce_delivery_update() from anon, authenticated;
revoke execute on function public.enforce_requirement_mutation() from anon, authenticated;
revoke execute on function public.sync_requirement_status() from anon, authenticated;
revoke execute on function public.enforce_evidence_update() from anon, authenticated;
revoke execute on function public.prevent_audit_mutation() from anon, authenticated;
revoke execute on function public.set_updated_at() from anon, authenticated;
revoke execute on function public.touch_delivery_from_requirement() from anon, authenticated;
