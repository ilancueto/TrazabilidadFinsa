create or replace function public.bulk_close_ready_deliveries(
  p_reason text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.user_role;
  row_record public.deliveries%rowtype;
  closed_count integer := 0;
  total_candidates integer := 0;
  normalized_reason text := trim(coalesce(p_reason, ''));
begin
  select role into actor_role
  from public.profiles
  where id = actor_id and active;

  if actor_role <> 'ADMIN' then
    raise exception 'Sólo Admin puede usar el cierre excepcional';
  end if;

  if p_confirmation <> 'CERRAR TODAS' then
    raise exception 'Confirmación inválida';
  end if;

  if length(normalized_reason) < 5 then
    raise exception 'Escribí un motivo de al menos 5 caracteres';
  end if;

  select count(*) into total_candidates
  from public.deliveries d
  where d.deleted_at is null and d.status <> 'CLOSED';

  for row_record in
    select d.*
    from public.deliveries d
    where d.deleted_at is null and d.status <> 'CLOSED'
    order by d.updated_at asc
    for update
  loop
    update public.deliveries
    set status = 'CLOSED', closed_at = now(), closed_by = actor_id
    where id = row_record.id and deleted_at is null and status <> 'CLOSED';

    if found then
      closed_count := closed_count + 1;
      insert into public.audit_events (delivery_id, actor_id, action, metadata, before, after)
      values (
        row_record.id,
        actor_id,
        'CLOSED',
        jsonb_build_object(
          'exceptional', true,
          'bulk', true,
          'forced', true,
          'reason', normalized_reason,
          'confirmation', p_confirmation,
          'bypassedStatusRules', true,
          'bypassedPendingRequirements', true,
          'bypassedOpenObservations', true
        ),
        jsonb_build_object('status', row_record.status),
        jsonb_build_object('status', 'CLOSED')
      );
    end if;
  end loop;

  return jsonb_build_object(
    'totalCandidates', total_candidates,
    'closedCount', closed_count,
    'skippedCount', total_candidates - closed_count
  );
end;
$$;

revoke all on function public.bulk_close_ready_deliveries(text, text) from public;
revoke all on function public.bulk_close_ready_deliveries(text, text) from anon;
grant execute on function public.bulk_close_ready_deliveries(text, text) to authenticated;
