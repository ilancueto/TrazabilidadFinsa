-- Base operativa para desactivar usuarios y mantener el progreso alineado
-- con la revisión de evidencias.

alter table public.profiles
  add column if not exists active boolean not null default true;

alter table public.profiles
  add column if not exists disabled_at timestamptz;

create index if not exists profiles_active_picking_idx
  on public.profiles (full_name)
  where active and role = 'PICKING';

create or replace function public.sync_requirement_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  req_id uuid;
  remaining integer;
begin
  req_id := coalesce(new.requirement_id, old.requirement_id);
  select count(*) into remaining
  from public.evidences
  where requirement_id = req_id
    and voided_at is null
    and review_status <> 'REJECTED';

  update public.delivery_requirements
    set status = case
      when remaining > 0 then 'COMPLETE'::public.requirement_status
      else 'PENDING'::public.requirement_status
    end
    where id = req_id;

  update public.deliveries d
    set updated_at = now()
    from public.delivery_requirements r
    where r.id = req_id
      and d.id = r.delivery_id;

  return coalesce(new, old);
end;
$$;

-- Recalcula registros existentes después de introducir review_status en el criterio.
update public.delivery_requirements r
set status = case
  when exists (
    select 1
    from public.evidences e
    where e.requirement_id = r.id
      and e.voided_at is null
      and e.review_status <> 'REJECTED'
  ) then 'COMPLETE'::public.requirement_status
  else 'PENDING'::public.requirement_status
end;
