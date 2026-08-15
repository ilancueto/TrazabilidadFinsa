-- Métricas históricas basadas en eventos inmutables, no en el estado actual.

create or replace function public.day_report(p_date date)
returns table (
  published bigint,
  ready bigint,
  closed bigint,
  urgent_open bigint,
  observations bigint,
  avg_first_photo_minutes integer,
  avg_ready_to_close_minutes integer,
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
    coalesce((select array_agg(delivery_id) from open_at_end), array[]::uuid[])
  from event_counts c
  where public.current_role() in ('ADMIN', 'SUPERVISOR')
$$;

grant execute on function public.day_report(date) to authenticated;
