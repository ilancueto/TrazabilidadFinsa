-- BACKFILL + CONTRACT. No recrea filas. ANDREANI queda huérfano en el enum de modalidad.

do $$
declare
  unexpected text;
  leftover integer;
begin
  select string_agg(distinct modality::text, ', ' order by modality::text)
  into unexpected
  from public.deliveries
  where modality::text not in ('ANDREANI', 'CUSTOMER_PICKUP', 'DESPACHO');

  if unexpected is not null then
    raise exception 'Modalidad inesperada en deliveries: %', unexpected;
  end if;

  update public.deliveries
  set carrier = 'ANDREANI',
      modality = 'DESPACHO'
  where modality = 'ANDREANI';

  update public.delivery_templates
  set code = 'DESPACHO',
      label = 'Despacho',
      modality = 'DESPACHO'
  where modality = 'ANDREANI';

  update public.destination_presets
  set modality = 'DESPACHO'
  where modality = 'ANDREANI';

  select count(*) into leftover from public.deliveries where modality = 'ANDREANI';
  if leftover <> 0 then
    raise exception 'Quedaron % entregas con modalidad ANDREANI', leftover;
  end if;

  if exists (select 1 from public.deliveries where modality = 'DESPACHO' and carrier is null) then
    raise exception 'DESPACHO sin carrier después del backfill';
  end if;

  if exists (select 1 from public.deliveries where modality = 'CUSTOMER_PICKUP' and carrier is not null) then
    raise exception 'CUSTOMER_PICKUP con carrier después del backfill';
  end if;

  if exists (select 1 from public.delivery_templates where modality = 'ANDREANI') then
    raise exception 'Quedó plantilla con modalidad ANDREANI';
  end if;
end
$$;

alter table public.deliveries drop constraint if exists deliveries_carrier_by_modality;
alter table public.deliveries
  add constraint deliveries_carrier_by_modality
  check (
    (modality = 'DESPACHO' and carrier is not null)
    or (modality = 'CUSTOMER_PICKUP' and carrier is null)
  );
