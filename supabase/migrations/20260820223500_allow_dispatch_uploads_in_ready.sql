-- Permite completar la etapa de despacho después de marcar el piso como READY.
-- En READY sólo se aceptan evidencias cuyo tipo de requisito sea DISPATCH.

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
  p_comment text
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
begin
  select role into actor_role
  from public.profiles
  where id = actor_id and active;

  if actor_role not in ('ADMIN', 'PICKING') then
    raise exception 'No autorizado';
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
    'SUPABASE',
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
      'filename', p_filename,
      'mime', p_mime_type,
      'size', p_size_bytes,
      'checksum', p_checksum
    )
  );

  return delivery_row.id;
end;
$$;

grant execute on function public.register_evidence(
  uuid, uuid, text, text, text, integer, integer, integer, text, text
) to authenticated;
