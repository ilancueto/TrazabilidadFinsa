-- Trazabilidad de Entregas — schema inicial
-- Fuente de verdad: PostgreSQL. localStorage no se usa para datos operativos.

create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('ADMIN', 'PICKING');
create type public.delivery_status as enum (
  'DRAFT',
  'PUBLISHED',
  'IN_PICKING',
  'READY',
  'CLOSED'
);
create type public.delivery_modality as enum ('ANDREANI', 'CUSTOMER_PICKUP');
create type public.delivery_priority as enum ('NORMAL', 'HIGH', 'URGENT');
create type public.requirement_status as enum ('PENDING', 'COMPLETE');
create type public.audit_action as enum (
  'CREATED',
  'PUBLISHED',
  'EDITED',
  'ASSIGNED',
  'PICKING_STARTED',
  'EVIDENCE_UPLOADED',
  'EVIDENCE_VOIDED',
  'OBSERVATION_ADDED',
  'OBSERVATION_RESOLVED',
  'READY',
  'CLOSED',
  'REOPENED'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'PICKING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.requirement_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.delivery_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  modality public.delivery_modality not null unique,
  created_at timestamptz not null default now()
);

create table public.template_requirements (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.delivery_templates (id) on delete cascade,
  requirement_type_id uuid not null references public.requirement_types (id),
  required boolean not null default true,
  applicable boolean not null default true,
  display_order integer not null,
  unique (template_id, requirement_type_id)
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  modality public.delivery_modality not null,
  destination text not null,
  packages integer not null check (packages > 0),
  priority public.delivery_priority not null default 'NORMAL',
  status public.delivery_status not null default 'DRAFT',
  assignee_id uuid references public.profiles (id),
  created_by uuid not null references public.profiles (id),
  observations text,
  has_open_observation boolean not null default false,
  published_at timestamptz,
  ready_at timestamptz,
  closed_at timestamptz,
  closed_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deliveries_number_unique unique (number)
);

create unique index deliveries_number_ci on public.deliveries (lower(number));
create index deliveries_status_idx on public.deliveries (status);
create index deliveries_modality_idx on public.deliveries (modality);
create index deliveries_priority_idx on public.deliveries (priority);
create index deliveries_assignee_idx on public.deliveries (assignee_id);
create index deliveries_created_at_idx on public.deliveries (created_at desc);
create index deliveries_updated_at_idx on public.deliveries (updated_at desc);
create index deliveries_observation_idx on public.deliveries (has_open_observation)
  where has_open_observation = true;

create table public.delivery_requirements (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries (id) on delete cascade,
  requirement_type_id uuid not null references public.requirement_types (id),
  label text not null,
  required boolean not null default true,
  applicable boolean not null default true,
  status public.requirement_status not null default 'PENDING',
  display_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (delivery_id, requirement_type_id)
);

create index delivery_requirements_delivery_idx
  on public.delivery_requirements (delivery_id, display_order);

create table public.evidences (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.delivery_requirements (id) on delete restrict,
  provider text not null default 'SUPABASE',
  storage_key text not null,
  filename text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  width integer,
  height integer,
  checksum text,
  comment text,
  uploader_id uuid not null references public.profiles (id),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  void_reason text,
  created_at timestamptz not null default now()
);

create index evidences_requirement_idx on public.evidences (requirement_id);
create index evidences_active_idx on public.evidences (requirement_id)
  where voided_at is null;

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  action public.audit_action not null,
  metadata jsonb not null default '{}'::jsonb,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_delivery_idx on public.audit_events (delivery_id, created_at);
create index audit_events_action_idx on public.audit_events (action);

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

insert into public.requirement_types (id, code, label, description) values
  ('a1000000-0000-4000-8000-000000000001', 'REMITO', 'Remito', 'Remito de la entrega'),
  ('a1000000-0000-4000-8000-000000000002', 'ETIQUETAS', 'Etiquetas', 'Etiquetas del transportista'),
  ('a1000000-0000-4000-8000-000000000003', 'TRIPLICADO', 'Triplicado', 'Triplicado firmado / controlado'),
  ('a1000000-0000-4000-8000-000000000004', 'PACKING_LIST', 'Packing List', 'Packing list cuando aplica'),
  ('a1000000-0000-4000-8000-000000000005', 'BULTOS', 'Bultos / Pallet', 'Evidencia de bultos o palletizado'),
  ('a1000000-0000-4000-8000-000000000006', 'EVIDENCIA_FINAL', 'Evidencia final', 'Cierre fotográfico / retiro');

insert into public.delivery_templates (id, code, label, modality) values
  ('b1000000-0000-4000-8000-000000000001', 'ANDREANI', 'Despacho Andreani', 'ANDREANI'),
  ('b1000000-0000-4000-8000-000000000002', 'CUSTOMER_PICKUP', 'Retira cliente', 'CUSTOMER_PICKUP');

insert into public.template_requirements (
  template_id, requirement_type_id, required, applicable, display_order
) values
  -- Andreani
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', true,  true,  10),
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', true,  true,  20),
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', true,  true,  30),
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004', false, true,  40),
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', true,  true,  50),
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000006', true,  true,  60),
  -- Retira cliente
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', true,  true,  10),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003', true,  true,  20),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004', false, true,  30),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000005', true,  true,  40),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000006', true,  true,  50);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger deliveries_set_updated_at
  before update on public.deliveries
  for each row execute function public.set_updated_at();

create trigger delivery_requirements_set_updated_at
  before update on public.delivery_requirements
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'PICKING'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_delivery_from_requirement()
returns trigger
language plpgsql
as $$
begin
  update public.deliveries
    set updated_at = now()
    where id = coalesce(new.delivery_id, old.delivery_id);
  return coalesce(new, old);
end;
$$;

create trigger delivery_requirements_touch_delivery
  after insert or update or delete on public.delivery_requirements
  for each row execute function public.touch_delivery_from_requirement();

create or replace function public.sync_requirement_status()
returns trigger
language plpgsql
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

create trigger evidences_sync_requirement
  after insert or update or delete on public.evidences
  for each row execute function public.sync_requirement_status();

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.can_read_delivery(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deliveries d
    where d.id = target_id
      and (
        public.current_role() = 'ADMIN'
        or (public.current_role() = 'PICKING' and d.status <> 'DRAFT')
      )
  )
$$;

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

create trigger deliveries_enforce_update
  before update on public.deliveries
  for each row execute function public.enforce_delivery_update();

create or replace function public.enforce_requirement_mutation()
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
    return coalesce(new, old);
  end if;

  -- El trigger de evidencias sólo toca status/updated_at. Eso no es edición de requisitos.
  if tg_op = 'UPDATE'
    and new.label is not distinct from old.label
    and new.required is not distinct from old.required
    and new.applicable is not distinct from old.applicable
    and new.display_order is not distinct from old.display_order
    and new.requirement_type_id is not distinct from old.requirement_type_id
    and new.delivery_id is not distinct from old.delivery_id
  then
    return new;
  end if;

  if actor_role <> 'ADMIN' then
    raise exception 'Picking no puede modificar requisitos';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger delivery_requirements_enforce
  before insert or update or delete on public.delivery_requirements
  for each row execute function public.enforce_requirement_mutation();

create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    raise exception 'El historial de auditoría no se puede modificar';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger audit_events_no_update
  before update or delete on public.audit_events
  for each row execute function public.prevent_audit_mutation();

create or replace function public.enforce_evidence_update()
returns trigger
language plpgsql
as $$
begin
  if new.requirement_id is distinct from old.requirement_id
    or new.storage_key is distinct from old.storage_key
    or new.filename is distinct from old.filename
    or new.mime_type is distinct from old.mime_type
    or new.size_bytes is distinct from old.size_bytes
    or new.width is distinct from old.width
    or new.height is distinct from old.height
    or new.checksum is distinct from old.checksum
    or new.uploader_id is distinct from old.uploader_id
    or new.provider is distinct from old.provider
  then
    raise exception 'Las evidencias no se editan; se anulan';
  end if;
  return new;
end;
$$;

create trigger evidences_enforce_update
  before update on public.evidences
  for each row execute function public.enforce_evidence_update();

-- ---------------------------------------------------------------------------
-- Grants (Supabase local ya no auto-expone tablas nuevas)
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.requirement_types enable row level security;
alter table public.delivery_templates enable row level security;
alter table public.template_requirements enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_requirements enable row level security;
alter table public.evidences enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

-- El rol vive en profiles y sólo lo cambia un proceso privilegiado (seed / IT).

create policy catalog_read_types on public.requirement_types
  for select to authenticated using (true);

create policy catalog_read_templates on public.delivery_templates
  for select to authenticated using (true);

create policy catalog_read_template_requirements on public.template_requirements
  for select to authenticated using (true);

create policy deliveries_select on public.deliveries
  for select to authenticated
  using (
    public.current_role() = 'ADMIN'
    or (public.current_role() = 'PICKING' and status <> 'DRAFT')
  );

create policy deliveries_insert_admin on public.deliveries
  for insert to authenticated
  with check (public.current_role() = 'ADMIN');

create policy deliveries_update on public.deliveries
  for update to authenticated
  using (
    public.current_role() = 'ADMIN'
    or (public.current_role() = 'PICKING' and status <> 'DRAFT' and status <> 'CLOSED')
  )
  with check (
    public.current_role() = 'ADMIN'
    or (public.current_role() = 'PICKING' and status <> 'DRAFT' and status <> 'CLOSED')
  );

create policy delivery_requirements_select on public.delivery_requirements
  for select to authenticated
  using (public.can_read_delivery(delivery_id));

create policy delivery_requirements_admin_write on public.delivery_requirements
  for all to authenticated
  using (public.current_role() = 'ADMIN')
  with check (public.current_role() = 'ADMIN');

create policy evidences_select on public.evidences
  for select to authenticated
  using (
    exists (
      select 1
      from public.delivery_requirements r
      where r.id = requirement_id
        and public.can_read_delivery(r.delivery_id)
    )
  );

create policy evidences_insert on public.evidences
  for insert to authenticated
  with check (
    uploader_id = auth.uid()
    and exists (
      select 1
      from public.delivery_requirements r
      join public.deliveries d on d.id = r.delivery_id
      where r.id = requirement_id
        and public.can_read_delivery(d.id)
        and d.status <> 'CLOSED'
        and d.status <> 'DRAFT'
    )
  );

create policy evidences_update_void on public.evidences
  for update to authenticated
  using (
    exists (
      select 1
      from public.delivery_requirements r
      join public.deliveries d on d.id = r.delivery_id
      where r.id = requirement_id
        and public.can_read_delivery(d.id)
        and d.status <> 'CLOSED'
    )
  )
  with check (
    exists (
      select 1
      from public.delivery_requirements r
      join public.deliveries d on d.id = r.delivery_id
      where r.id = requirement_id
        and public.can_read_delivery(d.id)
        and d.status <> 'CLOSED'
    )
  );

create policy audit_select on public.audit_events
  for select to authenticated
  using (public.can_read_delivery(delivery_id));

create policy audit_insert on public.audit_events
  for insert to authenticated
  with check (
    public.can_read_delivery(delivery_id)
    or (
      public.current_role() = 'ADMIN'
      and exists (select 1 from public.deliveries d where d.id = delivery_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidences',
  'evidences',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
);

-- Sin policies de storage para authenticated: upload/download solo via service role.
