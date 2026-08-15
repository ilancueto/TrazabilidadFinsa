-- Picking puede insertar evidencias, pero RLS le bloqueaba el UPDATE
-- de delivery_requirements que hace el trigger. El requisito nunca
-- pasaba a COMPLETE aunque la foto existiera.

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
    and voided_at is null;

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
