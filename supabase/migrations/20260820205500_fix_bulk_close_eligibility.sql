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
  skipped_count integer := 0;
  total_ready integer := 0;
  pending_required integer;
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

  select count(*) into total_ready
  from public.deliveries d
  where d.deleted_at is null and d.status = 'READY';

  for row_record in
    select d.*
    from public.deliveries d
    where d.deleted_at is null and d.status = 'READY'
    order by d.updated_at asc
    for update
  loop
    if row_record.has_open_observation then
      skipped_count := skipped_count + 1;
      continue;
    end if;

    select count(*) into pending_required
    from public.delivery_requirements r
    where r.delivery_id = row_record.id
      and r.required
      and r.applicable
      and not exists (
        select 1
        from public.evidences e
        where e.requirement_id = r.id
          and e.voided_at is null
          and coalesce(e.review_status::text, '') <> 'REJECTED'
      );

    if pending_required > 0 then
      skipped_count := skipped_count + 1;
      continue;
    end if;

    update public.deliveries
    set status = 'CLOSED',
        closed_at = now(),
        closed_by = actor_id
    where id = row_record.id and status = 'READY';

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
          'reason', normalized_reason,
          'confirmation', p_confirmation
        ),
        jsonb_build_object('status', 'READY'),
        jsonb_build_object('status', 'CLOSED')
      );
    else
      skipped_count := skipped_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'totalReady', total_ready,
    'closedCount', closed_count,
    'skippedCount', skipped_count
  );
end;
$$;

revoke all on function public.bulk_close_ready_deliveries(text, text) from public;
revoke all on function public.bulk_close_ready_deliveries(text, text) from anon;
grant execute on function public.bulk_close_ready_deliveries(text, text) to authenticated;
