-- Migración DRAFT (Spike Cloudflare R2): NO aplicar a remote aún.
-- Agrega soporte de parámetro p_provider en register_evidence y register_evidence_v2,
-- y constraint de valores válidos para la columna provider en public.evidences.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'evidences_provider_check'
  ) then
    alter table public.evidences
      add constraint evidences_provider_check
      check (provider in ('SUPABASE', 'R2'));
  end if;
end $$;

drop function if exists public.register_evidence(uuid, uuid, text, text, text, integer, integer, integer, text, text);

create or replace function public.register_evidence(
  p_evidence_id uuid,
  p_requirement_id uuid,
  p_storage_key text,
  p_filename text,
  p_mime_type text,
  p_size_bytes integer,
  p_width integer,
  p_height integer,
  p_checksum text,
  p_comment text,
  p_provider text default 'SUPABASE'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.user_role;
  delivery_row public.deliveries%rowtype;
  requirement_row public.delivery_requirements%rowtype;
  requirement_stage text;
  resolved_provider text := coalesce(nullif(upper(trim(p_provider)), ''), 'SUPABASE');
begin
  select role into actor_role
  from public.profiles
  where id = actor_id and active;

  if actor_role not in ('ADMIN', 'PICKING') then
    raise exception 'No autorizado';
  end if;

  if resolved_provider not in ('SUPABASE', 'R2') then
    raise exception 'Proveedor de storage no soportado';
  end if;

  select * into requirement_row
  from public.delivery_requirements
  where id = p_requirement_id;

  if not found then
    raise exception 'Requisito no encontrado';
  end if;

  if not requirement_row.applicable then
    raise exception 'Ese requisito no aplica';
  end if;

  select coalesce(stage, 'FLOOR') into requirement_stage
  from public.requirement_types
  where id = requirement_row.requirement_type_id;

  requirement_stage := coalesce(requirement_stage, 'FLOOR');

  select * into delivery_row
  from public.deliveries
  where id = requirement_row.delivery_id
  for update;

  if delivery_row.deleted_at is not null then
    raise exception 'Entrega archivada';
  end if;

  if delivery_row.status in ('DRAFT', 'CLOSED') then
    raise exception 'No se pueden cargar evidencias en este estado';
  end if;

  if delivery_row.status = 'READY' and requirement_stage <> 'DISPATCH' then
    raise exception 'En una entrega lista sólo se pueden cargar evidencias de despacho';
  end if;

  insert into public.evidences (
    id,
    requirement_id,
    provider,
    storage_key,
    filename,
    mime_type,
    size_bytes,
    width,
    height,
    checksum,
    comment,
    uploader_id,
    review_status
  ) values (
    p_evidence_id,
    p_requirement_id,
    resolved_provider,
    p_storage_key,
    p_filename,
    p_mime_type,
    p_size_bytes,
    p_width,
    p_height,
    p_checksum,
    nullif(trim(coalesce(p_comment, '')), ''),
    actor_id,
    'PENDING'
  );

  if delivery_row.status = 'PUBLISHED' then
    update public.deliveries
    set status = 'IN_PICKING'
    where id = delivery_row.id;

    insert into public.audit_events (delivery_id, actor_id, action, before, after)
    values (
      delivery_row.id,
      actor_id,
      'PICKING_STARTED',
      jsonb_build_object('status', 'PUBLISHED'),
      jsonb_build_object('status', 'IN_PICKING')
    );
  end if;

  insert into public.audit_events (delivery_id, actor_id, action, metadata)
  values (
    delivery_row.id,
    actor_id,
    'EVIDENCE_UPLOADED',
    jsonb_build_object(
      'requirementId', p_requirement_id,
      'evidenceId', p_evidence_id,
      'provider', resolved_provider,
      'filename', p_filename,
      'mime', p_mime_type,
      'size', p_size_bytes,
      'checksum', p_checksum
    )
  );

  return delivery_row.id;
end;
$$;

revoke all on function public.register_evidence(uuid, uuid, text, text, text, integer, integer, integer, text, text, text) from public;
grant execute on function public.register_evidence(uuid, uuid, text, text, text, integer, integer, integer, text, text, text) to authenticated, service_role;

drop function if exists public.register_evidence_v2(uuid, uuid, text, text, text, integer, integer, integer, text, text, text, text, integer);

create or replace function public.register_evidence_v2(
  p_evidence_id uuid,
  p_requirement_id uuid,
  p_storage_key text,
  p_filename text,
  p_mime_type text,
  p_size_bytes integer,
  p_width integer,
  p_height integer,
  p_checksum text,
  p_comment text,
  p_thumbnail_storage_key text,
  p_thumbnail_mime_type text,
  p_thumbnail_size_bytes integer,
  p_provider text default 'SUPABASE'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  delivery_id uuid;
begin
  delivery_id := public.register_evidence(
    p_evidence_id, p_requirement_id, p_storage_key, p_filename, p_mime_type,
    p_size_bytes, p_width, p_height, p_checksum, p_comment, p_provider
  );
  update public.evidences set
    thumbnail_storage_key = p_thumbnail_storage_key,
    thumbnail_mime_type = p_thumbnail_mime_type,
    thumbnail_size_bytes = p_thumbnail_size_bytes
  where id = p_evidence_id;
  return delivery_id;
end;
$$;

revoke all on function public.register_evidence_v2(uuid, uuid, text, text, text, integer, integer, integer, text, text, text, text, integer, text) from public;
grant execute on function public.register_evidence_v2(uuid, uuid, text, text, text, integer, integer, integer, text, text, text, text, integer, text) to authenticated, service_role;
