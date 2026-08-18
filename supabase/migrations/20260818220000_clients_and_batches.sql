-- Clientes y Lotes / Pallets
-- Permite gestionar catálogo de clientes simple (solo nombres/bases) y agrupar entregas en pallets/lotes

-- ---------------------------------------------------------------------------
-- 1. Tabla de Clientes
-- ---------------------------------------------------------------------------

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_name_unique unique (name)
);

create unique index if not exists clients_name_ci on public.clients (lower(name));
create index if not exists clients_active_idx on public.clients (active);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- RLS
alter table public.clients enable row level security;

create policy clients_select on public.clients
  for select to authenticated
  using (true);

create policy clients_admin_write on public.clients
  for all to authenticated
  using (public.current_role() = 'ADMIN')
  with check (public.current_role() = 'ADMIN');

grant select, insert, update, delete on public.clients to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Modificación de Deliveries
-- ---------------------------------------------------------------------------

alter table public.deliveries
  add column if not exists client_id uuid references public.clients (id) on delete set null,
  add column if not exists pallet_code text;

create index if not exists deliveries_client_idx on public.deliveries (client_id);
create index if not exists deliveries_pallet_code_idx on public.deliveries (lower(pallet_code));

-- ---------------------------------------------------------------------------
-- 3. Clientes iniciales demo
-- ---------------------------------------------------------------------------

insert into public.clients (name) values
  ('Halliburton Añelo'),
  ('Halliburton Meseta'),
  ('SLB'),
  ('Pecom'),
  ('Total Austral'),
  ('YPF'),
  ('Pan American Energy'),
  ('Tecpetrol'),
  ('Vista Energy'),
  ('Aconcagua Energía'),
  ('Pluspetrol')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Actualización de save_delivery RPC
-- ---------------------------------------------------------------------------

create or replace function public.save_delivery(
  p_delivery_id uuid,
  p_expected_status public.delivery_status,
  p_number text,
  p_modality public.delivery_modality,
  p_destination text,
  p_packages integer,
  p_priority public.delivery_priority,
  p_assignee_id uuid,
  p_due_at timestamptz,
  p_observations text,
  p_intent text,
  p_requirements jsonb,
  p_client_id uuid default null,
  p_pallet_code text default null
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

  if p_delivery_id is null then
    next_status := case
      when p_intent = 'publish' then 'PUBLISHED'::public.delivery_status
      else 'DRAFT'::public.delivery_status
    end;
    insert into public.deliveries (
      number, modality, destination, packages, priority, status, assignee_id,
      created_by, due_at, observations, published_at, client_id, pallet_code
    ) values (
      p_number, p_modality, p_destination, p_packages, p_priority, next_status,
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
    values (saved_id, actor_id, 'CREATED', jsonb_build_object('number', p_number, 'status', next_status, 'client_id', p_client_id, 'pallet_code', clean_pallet));
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
    number = p_number, modality = p_modality, destination = p_destination,
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
    jsonb_build_object('number', current_row.number, 'status', current_row.status, 'assignee_id', current_row.assignee_id, 'client_id', current_row.client_id, 'pallet_code', current_row.pallet_code),
    jsonb_build_object('number', p_number, 'status', next_status, 'assignee_id', p_assignee_id, 'client_id', p_client_id, 'pallet_code', clean_pallet));
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

grant execute on function public.save_delivery(uuid, public.delivery_status, text, public.delivery_modality, text, integer, public.delivery_priority, uuid, timestamptz, text, text, jsonb, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPC de asignación masiva a Lote / Pallet
-- ---------------------------------------------------------------------------

create or replace function public.bulk_assign_pallet(
  p_delivery_ids uuid[],
  p_pallet_code text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  row_id uuid;
  clean_code text := nullif(trim(coalesce(p_pallet_code, '')), '');
  assigned_count integer := 0;
begin
  if not exists (select 1 from public.profiles where id = actor_id and role = 'ADMIN' and active) then
    raise exception 'No autorizado';
  end if;
  if p_delivery_ids is null or array_length(p_delivery_ids, 1) = 0 then
    raise exception 'Elegí al menos una entrega';
  end if;

  foreach row_id in array p_delivery_ids
  loop
    update public.deliveries
    set pallet_code = clean_code
    where id = row_id and deleted_at is null;

    if found then
      insert into public.audit_events (delivery_id, actor_id, action, metadata)
      values (row_id, actor_id, 'EDITED', jsonb_build_object('pallet_code', clean_code, 'bulk', true));
      assigned_count := assigned_count + 1;
    end if;
  end loop;

  return assigned_count;
end;
$$;

grant execute on function public.bulk_assign_pallet(uuid[], text) to authenticated;
