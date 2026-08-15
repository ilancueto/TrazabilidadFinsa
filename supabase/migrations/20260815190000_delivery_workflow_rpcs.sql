-- Transiciones y revisión atómicas. Cada cambio de estado se guarda junto con
-- su evento de auditoría y falla completo si el estado leído quedó obsoleto.

create or replace function public.transition_delivery(
  p_delivery_id uuid,
  p_expected_status public.delivery_status,
  p_next_status public.delivery_status,
  p_action public.audit_action,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.user_role;
  current_row public.deliveries%rowtype;
  pending_required integer;
begin
  select role into actor_role from public.profiles where id = actor_id and active;
  if actor_role is null then raise exception 'Sesión inválida o usuario desactivado'; end if;

  select * into current_row from public.deliveries where id = p_delivery_id for update;
  if not found then raise exception 'Entrega no encontrada'; end if;
  if current_row.deleted_at is not null then raise exception 'Entrega archivada'; end if;
  if current_row.status <> p_expected_status then
    raise exception 'La entrega cambió de estado. Actualizá la página e intentá de nuevo';
  end if;

  if p_next_status = 'READY' then
    if actor_role not in ('ADMIN', 'PICKING') or p_expected_status not in ('PUBLISHED', 'IN_PICKING') then
      raise exception 'No se puede marcar lista en este estado';
    end if;
    select count(*) into pending_required
    from public.delivery_requirements
    where delivery_id = p_delivery_id and required and applicable and status <> 'COMPLETE';
    if pending_required > 0 then raise exception 'Todavía faltan requisitos obligatorios'; end if;
  elsif p_next_status = 'CLOSED' then
    if actor_role <> 'ADMIN' or p_expected_status <> 'READY' then
      raise exception 'Sólo Administración puede cerrar una entrega lista';
    end if;
    if current_row.has_open_observation then
      raise exception 'Resolvé la observación abierta antes de cerrar';
    end if;
  elsif p_next_status = 'IN_PICKING' and p_expected_status = 'READY' then
    if actor_role <> 'ADMIN' or p_action <> 'RETURNED' then
      raise exception 'No se puede devolver esta entrega';
    end if;
  elsif p_next_status = 'IN_PICKING' and p_expected_status = 'CLOSED' then
    if actor_role <> 'ADMIN' or p_action <> 'REOPENED' then
      raise exception 'No se puede reabrir esta entrega';
    end if;
  else
    raise exception 'Transición no permitida';
  end if;

  update public.deliveries
  set status = p_next_status,
      ready_at = case when p_next_status = 'READY' then now() else ready_at end,
      closed_at = case when p_next_status = 'CLOSED' then now() when p_expected_status = 'CLOSED' then null else closed_at end,
      closed_by = case when p_next_status = 'CLOSED' then actor_id when p_expected_status = 'CLOSED' then null else closed_by end,
      has_open_observation = case when p_action = 'RETURNED' then true else has_open_observation end,
      observations = case
        when p_action = 'RETURNED' then concat_ws(E'\n', observations,
          format('[%s · %s] Devuelta a Picking: %s',
            to_char(timezone('America/Argentina/Buenos_Aires', now()), 'DD/MM/YYYY HH24:MI'),
            (select full_name from public.profiles where id = actor_id),
            coalesce(p_metadata->>'reason', 'Requiere corrección')))
        else observations
      end
  where id = p_delivery_id and status = p_expected_status;

  if not found then raise exception 'La entrega cambió de estado'; end if;

  insert into public.audit_events (delivery_id, actor_id, action, metadata, before, after)
  values (
    p_delivery_id,
    actor_id,
    p_action,
    coalesce(p_metadata, '{}'::jsonb),
    jsonb_build_object('status', p_expected_status),
    jsonb_build_object('status', p_next_status)
  );

  return p_delivery_id;
end;
$$;

grant execute on function public.transition_delivery(uuid, public.delivery_status, public.delivery_status, public.audit_action, jsonb) to authenticated;

create or replace function public.review_evidence(
  p_evidence_id uuid,
  p_decision text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  delivery_id uuid;
  delivery_status public.delivery_status;
  actor_name text;
begin
  if public.current_role() <> 'ADMIN' then raise exception 'No autorizado'; end if;
  if p_decision not in ('ACCEPTED', 'REJECTED') then raise exception 'Decisión inválida'; end if;
  if p_decision = 'REJECTED' and length(trim(coalesce(p_note, ''))) < 2 then
    raise exception 'Escribí por qué no sirve la foto';
  end if;

  select r.delivery_id, d.status
  into delivery_id, delivery_status
  from public.evidences e
  join public.delivery_requirements r on r.id = e.requirement_id
  join public.deliveries d on d.id = r.delivery_id
  where e.id = p_evidence_id and e.voided_at is null and d.deleted_at is null
  for update of e, d;

  if not found then raise exception 'Foto no encontrada o anulada'; end if;
  if delivery_status <> 'READY' then
    raise exception 'Sólo se revisan fotos de una entrega lista';
  end if;

  update public.evidences
  set review_status = p_decision,
      review_note = nullif(trim(coalesce(p_note, '')), '')
  where id = p_evidence_id;

  insert into public.audit_events (delivery_id, actor_id, action, metadata)
  values (delivery_id, actor_id, 'EVIDENCE_REVIEWED',
    jsonb_build_object('evidenceId', p_evidence_id, 'decision', p_decision, 'note', nullif(trim(coalesce(p_note, '')), '')));

  if p_decision = 'REJECTED' then
    select full_name into actor_name from public.profiles where id = actor_id;
    update public.deliveries
    set status = 'IN_PICKING',
        has_open_observation = true,
        observations = concat_ws(E'\n', observations,
          format('[%s · %s] Foto rechazada: %s',
            to_char(timezone('America/Argentina/Buenos_Aires', now()), 'DD/MM/YYYY HH24:MI'),
            actor_name,
            trim(p_note)))
    where id = delivery_id and status = 'READY';

    insert into public.audit_events (delivery_id, actor_id, action, metadata, before, after)
    values (delivery_id, actor_id, 'RETURNED',
      jsonb_build_object('reason', trim(p_note), 'evidenceId', p_evidence_id, 'kind', 'EVIDENCE_REJECTED'),
      jsonb_build_object('status', 'READY'), jsonb_build_object('status', 'IN_PICKING'));
  end if;

  return delivery_id;
end;
$$;

grant execute on function public.review_evidence(uuid, text, text) to authenticated;

create or replace function public.assign_delivery(
  p_delivery_id uuid,
  p_expected_assignee uuid,
  p_next_assignee uuid,
  p_action public.audit_action
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.user_role;
  current_row public.deliveries%rowtype;
begin
  select role into actor_role from public.profiles where id = actor_id and active;
  if actor_role is null then raise exception 'Sesión inválida o usuario desactivado'; end if;

  select * into current_row from public.deliveries where id = p_delivery_id for update;
  if not found then raise exception 'Entrega no encontrada'; end if;
  if current_row.deleted_at is not null then raise exception 'Entrega archivada'; end if;
  if current_row.assignee_id is distinct from p_expected_assignee then
    raise exception 'La asignación cambió. Actualizá la página e intentá de nuevo';
  end if;

  if actor_role = 'PICKING' then
    if current_row.status not in ('PUBLISHED', 'IN_PICKING') then
      raise exception 'No se puede cambiar la asignación en este estado';
    end if;
    if not (
      (current_row.assignee_id is null and p_next_assignee = actor_id and p_action = 'CLAIMED')
      or (current_row.assignee_id = actor_id and p_next_assignee is null and p_action = 'REASSIGNED')
    ) then
      raise exception 'Picking sólo puede tomar una entrega libre o soltar la propia';
    end if;
  elsif actor_role = 'ADMIN' then
    if current_row.status in ('DRAFT', 'CLOSED') then
      raise exception 'No se puede reasignar en este estado';
    end if;
  else
    raise exception 'No autorizado';
  end if;

  if p_next_assignee is not null and not exists (
    select 1 from public.profiles where id = p_next_assignee and role = 'PICKING' and active
  ) then
    raise exception 'El responsable no está activo en Picking';
  end if;

  update public.deliveries set assignee_id = p_next_assignee where id = p_delivery_id;
  insert into public.audit_events (delivery_id, actor_id, action, before, after)
  values (p_delivery_id, actor_id, p_action,
    jsonb_build_object('assignee_id', p_expected_assignee),
    jsonb_build_object('assignee_id', p_next_assignee));
  return p_delivery_id;
end;
$$;

grant execute on function public.assign_delivery(uuid, uuid, uuid, public.audit_action) to authenticated;

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
  p_requirements jsonb
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

  if p_delivery_id is null then
    next_status := case
      when p_intent = 'publish' then 'PUBLISHED'::public.delivery_status
      else 'DRAFT'::public.delivery_status
    end;
    insert into public.deliveries (
      number, modality, destination, packages, priority, status, assignee_id,
      created_by, due_at, observations, published_at
    ) values (
      p_number, p_modality, p_destination, p_packages, p_priority, next_status,
      p_assignee_id, actor_id, p_due_at, nullif(trim(coalesce(p_observations, '')), ''),
      case when next_status = 'PUBLISHED' then now() else null end
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
    values (saved_id, actor_id, 'CREATED', jsonb_build_object('number', p_number, 'status', next_status));
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
    jsonb_build_object('number', current_row.number, 'status', current_row.status, 'assignee_id', current_row.assignee_id),
    jsonb_build_object('number', p_number, 'status', next_status, 'assignee_id', p_assignee_id));
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

grant execute on function public.save_delivery(uuid, public.delivery_status, text, public.delivery_modality, text, integer, public.delivery_priority, uuid, timestamptz, text, text, jsonb) to authenticated;

create or replace function public.save_delivery_template(
  p_template_id uuid,
  p_requirements jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  req jsonb;
begin
  if not exists (select 1 from public.profiles where id = actor_id and role = 'ADMIN' and active) then
    raise exception 'No autorizado';
  end if;
  if not exists (select 1 from public.delivery_templates where id = p_template_id) then
    raise exception 'Plantilla no encontrada';
  end if;
  if jsonb_typeof(p_requirements) <> 'array' or jsonb_array_length(p_requirements) = 0 then
    raise exception 'La plantilla necesita requisitos';
  end if;

  delete from public.template_requirements where template_id = p_template_id;
  for req in select value from jsonb_array_elements(p_requirements)
  loop
    insert into public.template_requirements (
      template_id, requirement_type_id, required, applicable, display_order
    ) values (
      p_template_id, (req->>'typeId')::uuid,
      (req->>'required')::boolean and (req->>'applicable')::boolean,
      (req->>'applicable')::boolean, (req->>'displayOrder')::integer
    );
  end loop;
  return p_template_id;
end;
$$;

grant execute on function public.save_delivery_template(uuid, jsonb) to authenticated;

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
begin
  select role into actor_role from public.profiles where id = actor_id and active;
  if actor_role not in ('ADMIN', 'PICKING') then raise exception 'No autorizado'; end if;

  select * into requirement_row from public.delivery_requirements where id = p_requirement_id;
  if not found then raise exception 'Requisito no encontrado'; end if;
  if not requirement_row.applicable then raise exception 'Ese requisito no aplica'; end if;
  select * into delivery_row from public.deliveries where id = requirement_row.delivery_id for update;
  if delivery_row.deleted_at is not null then raise exception 'Entrega archivada'; end if;
  if delivery_row.status in ('DRAFT', 'READY', 'CLOSED') then
    raise exception 'No se pueden cargar evidencias en este estado';
  end if;

  insert into public.evidences (
    id, requirement_id, provider, storage_key, filename, mime_type, size_bytes,
    width, height, checksum, comment, uploader_id, review_status
  ) values (
    p_evidence_id, p_requirement_id, 'SUPABASE', p_storage_key, p_filename,
    p_mime_type, p_size_bytes, p_width, p_height, p_checksum,
    nullif(trim(coalesce(p_comment, '')), ''), actor_id, 'PENDING'
  );

  if delivery_row.status = 'PUBLISHED' then
    update public.deliveries set status = 'IN_PICKING' where id = delivery_row.id;
    insert into public.audit_events (delivery_id, actor_id, action, before, after)
    values (delivery_row.id, actor_id, 'PICKING_STARTED',
      jsonb_build_object('status', 'PUBLISHED'), jsonb_build_object('status', 'IN_PICKING'));
  end if;

  insert into public.audit_events (delivery_id, actor_id, action, metadata)
  values (delivery_row.id, actor_id, 'EVIDENCE_UPLOADED', jsonb_build_object(
    'requirementId', p_requirement_id, 'evidenceId', p_evidence_id,
    'filename', p_filename, 'mime', p_mime_type, 'size', p_size_bytes,
    'checksum', p_checksum));
  return delivery_row.id;
end;
$$;

grant execute on function public.register_evidence(uuid, uuid, text, text, text, integer, integer, integer, text, text) to authenticated;

create or replace function public.record_observation(
  p_delivery_id uuid,
  p_text text,
  p_resolve boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.user_role;
  actor_name text;
  current_row public.deliveries%rowtype;
begin
  select role, full_name into actor_role, actor_name from public.profiles where id = actor_id and active;
  if actor_role is null then raise exception 'Sesión inválida'; end if;
  select * into current_row from public.deliveries where id = p_delivery_id for update;
  if not found then raise exception 'Entrega no encontrada'; end if;
  if current_row.deleted_at is not null then raise exception 'Entrega archivada'; end if;
  if current_row.status = 'CLOSED' then raise exception 'La entrega está cerrada'; end if;

  if p_resolve then
    if actor_role <> 'ADMIN' then raise exception 'No autorizado'; end if;
    update public.deliveries set has_open_observation = false where id = p_delivery_id;
    insert into public.audit_events (delivery_id, actor_id, action, before, after)
    values (p_delivery_id, actor_id, 'OBSERVATION_RESOLVED',
      jsonb_build_object('has_open_observation', current_row.has_open_observation),
      jsonb_build_object('has_open_observation', false));
  else
    if actor_role not in ('ADMIN', 'PICKING') or length(trim(coalesce(p_text, ''))) < 2 then
      raise exception 'Observación inválida';
    end if;
    update public.deliveries set
      observations = concat_ws(E'\n', observations,
        format('[%s · %s] %s',
          to_char(timezone('America/Argentina/Buenos_Aires', now()), 'DD/MM/YYYY HH24:MI'),
          actor_name, trim(p_text))),
      has_open_observation = true
    where id = p_delivery_id;
    insert into public.audit_events (delivery_id, actor_id, action, metadata)
    values (p_delivery_id, actor_id, 'OBSERVATION_ADDED', jsonb_build_object('text', trim(p_text)));
  end if;
  return p_delivery_id;
end;
$$;

grant execute on function public.record_observation(uuid, text, boolean) to authenticated;

create or replace function public.void_evidence(
  p_evidence_id uuid,
  p_reason text
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
  evidence_row public.evidences%rowtype;
  target_delivery_id uuid;
  pending_required integer;
begin
  select role into actor_role from public.profiles where id = actor_id and active;
  if actor_role not in ('ADMIN', 'PICKING') then raise exception 'No autorizado'; end if;
  if length(trim(coalesce(p_reason, ''))) < 2 then raise exception 'Escribí el motivo'; end if;

  select e.* into evidence_row
  from public.evidences e
  where e.id = p_evidence_id for update;
  if not found then raise exception 'Evidencia no encontrada'; end if;
  if evidence_row.voided_at is not null then raise exception 'La evidencia ya está anulada'; end if;
  select r.delivery_id into target_delivery_id
  from public.delivery_requirements r
  where r.id = evidence_row.requirement_id;
  select * into delivery_row from public.deliveries where id = target_delivery_id for update;
  if delivery_row.deleted_at is not null then raise exception 'Entrega archivada'; end if;
  if delivery_row.status in ('DRAFT', 'CLOSED') then
    raise exception 'No se puede anular evidencia en este estado';
  end if;

  update public.evidences set
    voided_at = now(), voided_by = actor_id, void_reason = trim(p_reason)
  where id = p_evidence_id;

  insert into public.audit_events (delivery_id, actor_id, action, metadata)
  values (target_delivery_id, actor_id, 'EVIDENCE_VOIDED',
    jsonb_build_object('evidenceId', p_evidence_id, 'reason', trim(p_reason)));

  select count(*) into pending_required from public.delivery_requirements
  where public.delivery_requirements.delivery_id = delivery_row.id
    and required and applicable and status <> 'COMPLETE';
  if delivery_row.status = 'READY' and pending_required > 0 then
    update public.deliveries set status = 'IN_PICKING' where id = delivery_row.id;
    insert into public.audit_events (delivery_id, actor_id, action, metadata, before, after)
    values (target_delivery_id, actor_id, 'RETURNED',
      jsonb_build_object('reason', trim(p_reason), 'evidenceId', p_evidence_id, 'kind', 'EVIDENCE_VOIDED'),
      jsonb_build_object('status', 'READY'), jsonb_build_object('status', 'IN_PICKING'));
  end if;
  return target_delivery_id;
end;
$$;

grant execute on function public.void_evidence(uuid, text) to authenticated;

create or replace function public.bulk_assign_unassigned(p_assignee_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  row_id uuid;
  assigned_count integer := 0;
begin
  if not exists (select 1 from public.profiles where id = actor_id and role = 'ADMIN' and active) then
    raise exception 'No autorizado';
  end if;
  if not exists (select 1 from public.profiles where id = p_assignee_id and role = 'PICKING' and active) then
    raise exception 'El responsable no está activo en Picking';
  end if;

  for row_id in
    select id from public.deliveries
    where status in ('PUBLISHED', 'IN_PICKING') and assignee_id is null and deleted_at is null
    for update
  loop
    update public.deliveries set assignee_id = p_assignee_id where id = row_id;
    insert into public.audit_events (delivery_id, actor_id, action, after)
    values (row_id, actor_id, 'REASSIGNED', jsonb_build_object('assignee_id', p_assignee_id, 'bulk', true));
    assigned_count := assigned_count + 1;
  end loop;
  return assigned_count;
end;
$$;

grant execute on function public.bulk_assign_unassigned(uuid) to authenticated;
