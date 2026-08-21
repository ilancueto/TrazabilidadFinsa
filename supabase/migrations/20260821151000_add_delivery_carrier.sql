-- EXPAND: transportista separado. Columna nullable hasta el backfill.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'delivery_carrier') then
    create type public.delivery_carrier as enum ('ANDREANI');
  end if;
end
$$;

alter table public.deliveries
  add column if not exists carrier public.delivery_carrier;
