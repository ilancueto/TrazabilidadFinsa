alter table public.deliveries add column if not exists deleted_at timestamptz;
alter table public.deliveries add column if not exists deleted_by uuid references public.profiles (id);

create index if not exists deliveries_active_status_idx
  on public.deliveries (status, updated_at desc)
  where deleted_at is null;

create or replace function public.archive_delivery(p_delivery_id uuid, p_confirm_number text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  current_row public.deliveries%rowtype;
begin
  if not exists (select 1 from public.profiles where id = actor_id and role = 'ADMIN' and active) then
    raise exception 'No autorizado';
  end if;
  select * into current_row from public.deliveries where id = p_delivery_id for update;
  if not found or current_row.deleted_at is not null then raise exception 'Entrega no encontrada'; end if;
  if upper(trim(p_confirm_number)) <> upper(trim(current_row.number)) then
    raise exception 'El número no coincide';
  end if;

  update public.deliveries set deleted_at = now(), deleted_by = actor_id where id = p_delivery_id;
  insert into public.audit_events (delivery_id, actor_id, action, metadata, before, after)
  values (p_delivery_id, actor_id, 'EDITED', jsonb_build_object('kind', 'ARCHIVED'),
    jsonb_build_object('deleted_at', null), jsonb_build_object('deleted_at', now()));
  return p_delivery_id;
end;
$$;

grant execute on function public.archive_delivery(uuid, text) to authenticated;
