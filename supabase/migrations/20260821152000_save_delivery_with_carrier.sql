-- COMPATIBILITY: save_delivery persiste DESPACHO + carrier y mapea ANDREANI de entrada.
-- enforce_delivery_update trata carrier como dato maestro.

drop function if exists public.save_delivery(uuid, public.delivery_status, text, public.delivery_modality, text, integer, public.delivery_priority, uuid, timestamptz, text, text, jsonb);
drop function if exists public.save_delivery(uuid, public.delivery_status, text, public.delivery_modality, text, integer, public.delivery_priority, uuid, timestamptz, text, text, jsonb, uuid, text);

create function public.save_delivery(
  p_delivery_id uuid,
  p_expected_status public.delivery_status,
  p_number text,
  p_modality public.delivery_modality,
  p_destination text,
  p_packages integer,
  p_priority public.delivery_priority,
  p_assignee_id uuid,
  p_due_at timestamp with time zone,
  p_observations text,
  p_intent text,
  p_requirements jsonb,
  p_client_id uuid default null,
  p_pallet_code text default null,
  p_carrier public.delivery_carrier default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  current_row public.deliveries%rowtype;
  next_status public.delivery_status;
  saved_id uuid;
  req jsonb;
  clean_pallet text := nullif(trim(coalesce(p_pallet_code, '')), '');
  resolved_modality public.delivery_modality;
  resolved_carrier public.delivery_carrier;
begin
  if not exists (select 1 from public.profiles where id = actor_id and role = 'ADMIN' and active) then
    raise exception 'No autorizado';
  end if;
  if p_intent not in ('draft', 'publish') then raise exception 'Intención inválida'; end if;
  if jsonb_typeof(p_requirements) <> 'array' or jsonb_array_length(p_requirements) = 0 then
    raise exception 'La entrega necesita requisitos';
  end if;
  if p_assignee_id is not null and not exists (
    select 1 from public.profiles where id = p_assignee_id and role = 'PICKING' and active
  ) then raise exception 'El responsable no está activo en Picking'; end if;

  if p_client_id is not null and not exists (
    select 1 from public.clients where id = p_client_id and active
  ) then raise exception 'El cliente seleccionado no existe o está inactivo'; end if;

  if p_modality::text = 'ANDREANI' then
    resolved_modality := 'DESPACHO';
    resolved_carrier := coalesce(p_carrier, 'ANDREANI');
  elsif p_modality = 'DESPACHO' then
    resolved_modality := 'DESPACHO';
    resolved_carrier := p_carrier;
    if resolved_carrier is null then
      raise exception 'El despacho requiere transportista';
    end if;
  elsif p_modality = 'CUSTOMER_PICKUP' then
    if p_carrier is not null then
      raise exception 'Retira cliente no lleva transportista';
    end if;
    resolved_modality := 'CUSTOMER_PICKUP';
    resolved_carrier := null;
  else
    raise exception 'Modalidad inválida';
  end if;

  if p_delivery_id is null then
    next_status := case
      when p_intent = 'publish' then 'PUBLISHED'::public.delivery_status
      else 'DRAFT'::public.delivery_status
    end;
    insert into public.deliveries (
      number, modality, carrier, destination, packages, priority, status, assignee_id,
      created_by, due_at, observations, published_at, client_id, pallet_code
    ) values (
      p_number, resolved_modality, resolved_carrier, p_destination, p_packages, p_priority, next_status,
      p_assignee_id, actor_id, p_due_at, nullif(trim(coalesce(p_observations, '')), ''),
      case when next_status = 'PUBLISHED' then now() else null end,
      p_client_id, clean_pallet
    ) returning id into saved_id;

    for req in select value from jsonb_array_elements(p_requirements)
    loop
      insert into public.delivery_requirements (
        delivery_id, requirement_type_id, label, required, applicable, display_order, status
      ) values (
        saved_id, (req->>'typeId')::uuid, req->>'label', (req->>'required')::boolean,
        (req->>'applicable')::boolean, (req->>'displayOrder')::integer, 'PENDING'
      );
    end loop;

    insert into public.audit_events (delivery_id, actor_id, action, after)
    values (saved_id, actor_id, 'CREATED', jsonb_build_object('number', p_number, 'status', next_status, 'client_id', p_client_id, 'pallet_code', clean_pallet, 'modality', resolved_modality, 'carrier', resolved_carrier));
    if p_assignee_id is not null then
      insert into public.audit_events (delivery_id, actor_id, action, after)
      values (saved_id, actor_id, 'ASSIGNED', jsonb_build_object('assignee_id', p_assignee_id));
    end if;
    if next_status = 'PUBLISHED' then
      insert into public.audit_events (delivery_id, actor_id, action, after)
      values (saved_id, actor_id, 'PUBLISHED', jsonb_build_object('status', 'PUBLISHED'));
    end if;
    return saved_id;
  end if;

  select * into current_row from public.deliveries where id = p_delivery_id for update;
  if not found then raise exception 'Entrega no encontrada'; end if;
  if current_row.deleted_at is not null then raise exception 'Entrega archivada'; end if;
  if current_row.status <> p_expected_status then
    raise exception 'La entrega cambió. Actualizá la página e intentá de nuevo';
  end if;
  if current_row.status = 'CLOSED' then raise exception 'La entrega está bloqueada'; end if;
  if p_intent = 'draft' and current_row.status = 'PUBLISHED' and exists (
    select 1 from public.delivery_requirements r join public.evidences e on e.requirement_id = r.id
    where r.delivery_id = p_delivery_id and e.voided_at is null
  ) then raise exception 'No se puede volver a borrador: ya hay evidencias'; end if;

  next_status := case
    when p_intent = 'publish' and current_row.status = 'DRAFT' then 'PUBLISHED'
    when p_intent = 'draft' and current_row.status = 'PUBLISHED' then 'DRAFT'
    else current_row.status
  end;

  update public.deliveries set
    number = p_number, modality = resolved_modality, carrier = resolved_carrier, destination = p_destination,
    packages = p_packages, priority = p_priority, assignee_id = p_assignee_id,
    due_at = p_due_at, observations = nullif(trim(coalesce(p_observations, '')), ''),
    status = next_status,
    client_id = p_client_id,
    pallet_code = clean_pallet,
    published_at = case when next_status = 'PUBLISHED' then coalesce(published_at, now()) else published_at end
  where id = p_delivery_id;

  for req in select value from jsonb_array_elements(p_requirements)
  loop
    insert into public.delivery_requirements (
      delivery_id, requirement_type_id, label, required, applicable, display_order, status
    ) values (
      p_delivery_id, (req->>'typeId')::uuid, req->>'label', (req->>'required')::boolean,
      (req->>'applicable')::boolean, (req->>'displayOrder')::integer, 'PENDING'
    )
    on conflict (delivery_id, requirement_type_id) do update set
      label = excluded.label, required = excluded.required,
      applicable = excluded.applicable, display_order = excluded.display_order;
  end loop;

  update public.delivery_requirements r set applicable = false, required = false
  where r.delivery_id = p_delivery_id
    and not exists (
      select 1 from jsonb_array_elements(p_requirements) x
      where (x->>'typeId')::uuid = r.requirement_type_id
    );

  insert into public.audit_events (delivery_id, actor_id, action, before, after)
  values (p_delivery_id, actor_id, 'EDITED',
    jsonb_build_object('number', current_row.number, 'status', current_row.status, 'assignee_id', current_row.assignee_id, 'client_id', current_row.client_id, 'pallet_code', current_row.pallet_code, 'modality', current_row.modality, 'carrier', current_row.carrier),
    jsonb_build_object('number', p_number, 'status', next_status, 'assignee_id', p_assignee_id, 'client_id', p_client_id, 'pallet_code', clean_pallet, 'modality', resolved_modality, 'carrier', resolved_carrier));
  if p_assignee_id is distinct from current_row.assignee_id then
    insert into public.audit_events (delivery_id, actor_id, action, before, after)
    values (p_delivery_id, actor_id, 'ASSIGNED',
      jsonb_build_object('assignee_id', current_row.assignee_id),
      jsonb_build_object('assignee_id', p_assignee_id));
  end if;
  if current_row.status <> 'PUBLISHED' and next_status = 'PUBLISHED' then
    insert into public.audit_events (delivery_id, actor_id, action, after)
    values (p_delivery_id, actor_id, 'PUBLISHED', jsonb_build_object('status', 'PUBLISHED'));
  end if;
  return p_delivery_id;
end;
$$;

revoke all on function public.save_delivery(uuid, public.delivery_status, text, public.delivery_modality, text, integer, public.delivery_priority, uuid, timestamptz, text, text, jsonb, uuid, text, public.delivery_carrier) from public;
revoke all on function public.save_delivery(uuid, public.delivery_status, text, public.delivery_modality, text, integer, public.delivery_priority, uuid, timestamptz, text, text, jsonb, uuid, text, public.delivery_carrier) from anon;
grant execute on function public.save_delivery(uuid, public.delivery_status, text, public.delivery_modality, text, integer, public.delivery_priority, uuid, timestamptz, text, text, jsonb, uuid, text, public.delivery_carrier) to authenticated;

create or replace function public.enforce_delivery_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.user_role;
begin
  actor_role := public.current_role();

  if actor_role is null then
    return new;
  end if;

  if old.status = 'CLOSED' and actor_role <> 'ADMIN' then
    raise exception 'La entrega cerrada está bloqueada';
  end if;

  if actor_role = 'PICKING' then
    if new.number is distinct from old.number
      or new.modality is distinct from old.modality
      or new.carrier is distinct from old.carrier
      or new.destination is distinct from old.destination
      or new.packages is distinct from old.packages
      or new.priority is distinct from old.priority
      or new.assignee_id is distinct from old.assignee_id
      or new.created_by is distinct from old.created_by
      or new.closed_by is distinct from old.closed_by
      or new.closed_at is distinct from old.closed_at
    then
      raise exception 'Picking no puede editar datos maestros de la entrega';
    end if;

    if new.status = 'CLOSED' then
      raise exception 'Picking no puede cerrar una entrega';
    end if;
  end if;

  return new;
end;
$$;
