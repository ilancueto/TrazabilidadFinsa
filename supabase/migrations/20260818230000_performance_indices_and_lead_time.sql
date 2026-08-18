-- 1. Índices estratégicos para alto rendimiento en consultas y búsquedas
create index if not exists idx_deliveries_client_id on public.deliveries(client_id);
create index if not exists idx_deliveries_pallet_code on public.deliveries(pallet_code);
create index if not exists idx_audit_events_delivery_created on public.audit_events(delivery_id, created_at);
create index if not exists idx_evidences_req_active on public.evidences(requirement_id) where voided_at is null;
create index if not exists idx_deliveries_status_priority on public.deliveries(status, priority);

-- 2. RPC para asignación masiva de responsable
create or replace function public.bulk_assign_picker(
  p_delivery_ids uuid[],
  p_assignee_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_delivery_id uuid;
  v_user_role text;
  v_user_id uuid;
  v_picker_name text := 'Sin asignar';
begin
  v_user_role := public.current_role();
  v_user_id := auth.uid();

  if v_user_role not in ('ADMIN', 'SUPERVISOR') then
    raise exception 'No autorizado para asignar responsables en lote';
  end if;

  if p_assignee_id is not null then
    select full_name into v_picker_name from public.profiles where id = p_assignee_id;
  end if;

  foreach v_delivery_id in array p_delivery_ids
  loop
    update public.deliveries
    set
      assignee_id = p_assignee_id,
      updated_at = now()
    where id = v_delivery_id
      and deleted_at is null;

    if found then
      v_count := v_count + 1;
      insert into public.audit_events (delivery_id, actor_id, action, metadata)
      values (
        v_delivery_id,
        v_user_id,
        'ASSIGNED',
        jsonb_build_object(
          'assignee_id', p_assignee_id,
          'assignee_name', v_picker_name,
          'bulk', true
        )
      );
    end if;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.bulk_assign_picker(uuid[], uuid) to authenticated;

-- 3. Actualización de métrica de Cierre de Día (excluyendo Etiqueta Andreani y Packing list)
drop function if exists public.day_report(date);

create or replace function public.day_report(p_date date)
returns table (
  published bigint,
  ready bigint,
  closed bigint,
  urgent_open bigint,
  observations bigint,
  avg_first_photo_minutes integer,
  avg_ready_to_close_minutes integer,
  avg_warehouse_lead_minutes integer,
  open_ids uuid[]
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      (p_date::timestamp at time zone 'America/Argentina/Buenos_Aires') as starts_at,
      ((p_date + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires') as ends_at
  ),
  status_events as (
    select
      a.delivery_id,
      a.created_at,
      coalesce(
        a.after->>'status',
        case a.action
          when 'PUBLISHED' then 'PUBLISHED'
          when 'PICKING_STARTED' then 'IN_PICKING'
          when 'READY' then 'READY'
          when 'CLOSED' then 'CLOSED'
          when 'REOPENED' then 'IN_PICKING'
          when 'RETURNED' then 'IN_PICKING'
          else null
        end
      ) as status_after
    from public.audit_events a, bounds b
    where a.created_at < b.ends_at
      and a.action in ('PUBLISHED', 'PICKING_STARTED', 'READY', 'CLOSED', 'REOPENED', 'RETURNED')
  ),
  latest_status as (
    select distinct on (delivery_id) delivery_id, status_after
    from status_events
    where status_after is not null
    order by delivery_id, created_at desc
  ),
  open_at_end as (
    select l.delivery_id
    from latest_status l
    join public.deliveries d on d.id = l.delivery_id
    where l.status_after not in ('DRAFT', 'CLOSED')
      and (d.deleted_at is null or d.deleted_at >= (select ends_at from bounds))
  ),
  event_counts as (
    select
      count(*) filter (where a.action = 'PUBLISHED') as published,
      count(*) filter (where a.action = 'READY') as ready,
      count(*) filter (where a.action = 'CLOSED') as closed
    from public.audit_events a, bounds b
    where a.created_at >= b.starts_at and a.created_at < b.ends_at
  ),
  latest_observation as (
    select distinct on (a.delivery_id)
      a.delivery_id,
      a.action
    from public.audit_events a, bounds b
    where a.created_at < b.ends_at
      and a.action in ('OBSERVATION_ADDED', 'OBSERVATION_RESOLVED', 'RETURNED')
    order by a.delivery_id, a.created_at desc
  ),
  published_events as (
    select a.delivery_id, a.created_at
    from public.audit_events a, bounds b
    where a.action = 'PUBLISHED'
      and a.created_at >= b.starts_at and a.created_at < b.ends_at
  ),
  first_photo as (
    select p.delivery_id, p.created_at as published_at, min(e.created_at) as photo_at
    from published_events p
    left join public.delivery_requirements r on r.delivery_id = p.delivery_id
    left join public.evidences e on e.requirement_id = r.id and e.voided_at is null
    group by p.delivery_id, p.created_at
  ),
  warehouse_completion as (
    select
      p.delivery_id,
      p.created_at as published_at,
      max(e.created_at) as warehouse_done_at
    from published_events p
    join public.delivery_requirements r on r.delivery_id = p.delivery_id
    join public.requirement_types t on t.id = r.requirement_type_id
    join public.evidences e on e.requirement_id = r.id and e.voided_at is null
    where t.code not in ('ETIQUETA_ANDREANI', 'PACKING_LIST')
      and r.applicable = true
    group by p.delivery_id, p.created_at
  ),
  closed_events as (
    select a.delivery_id, a.created_at as closed_at,
      (
        select max(r.created_at)
        from public.audit_events r
        where r.delivery_id = a.delivery_id and r.action = 'READY' and r.created_at <= a.created_at
      ) as ready_at
    from public.audit_events a, bounds b
    where a.action = 'CLOSED'
      and a.created_at >= b.starts_at and a.created_at < b.ends_at
  )
  select
    c.published,
    c.ready,
    c.closed,
    (select count(*) from open_at_end o join public.deliveries d on d.id = o.delivery_id where d.priority = 'URGENT'),
    (select count(*) from latest_observation o join open_at_end x on x.delivery_id = o.delivery_id where o.action in ('OBSERVATION_ADDED', 'RETURNED')),
    (select round(avg(extract(epoch from (photo_at - published_at)) / 60))::integer from first_photo where photo_at is not null and photo_at >= published_at),
    (select round(avg(extract(epoch from (closed_at - ready_at)) / 60))::integer from closed_events where ready_at is not null),
    (select round(avg(extract(epoch from (warehouse_done_at - published_at)) / 60))::integer from warehouse_completion where warehouse_done_at is not null and warehouse_done_at >= published_at),
    coalesce((select array_agg(delivery_id) from open_at_end), array[]::uuid[])
  from event_counts c
  where public.current_role() in ('ADMIN', 'SUPERVISOR')
$$;

grant execute on function public.day_report(date) to authenticated;
