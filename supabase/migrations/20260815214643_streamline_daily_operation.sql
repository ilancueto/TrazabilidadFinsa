-- La operación es diaria: el horario comprometido deja de formar parte del flujo.
update public.deliveries
set due_at = null
where due_at is not null;

drop index if exists public.deliveries_due_at_idx;

comment on column public.deliveries.due_at is
  'Campo legado. La operación actual no utiliza fecha ni hora comprometida.';

-- El número es la referencia pública de las URLs y necesita búsqueda directa.
create index if not exists deliveries_number_lookup_idx
  on public.deliveries (number)
  where deleted_at is null;

-- Un solo viaje reemplaza cuatro conteos separados en cada carga del tablero.
create or replace function public.dashboard_kpis()
returns table (
  active bigint,
  picking bigint,
  ready bigint,
  observations bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*) filter (where status not in ('CLOSED', 'DRAFT')) as active,
    count(*) filter (where status = 'IN_PICKING') as picking,
    count(*) filter (where status = 'READY') as ready,
    count(*) filter (where has_open_observation and status <> 'CLOSED') as observations
  from public.deliveries
  where deleted_at is null;
$$;

revoke all on function public.dashboard_kpis() from public, anon;
grant execute on function public.dashboard_kpis() to authenticated, service_role;
