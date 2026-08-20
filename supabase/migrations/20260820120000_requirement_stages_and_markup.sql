-- Etapa piso vs etiquetas de despacho, y recuadro en revisión de fotos.

alter table public.requirement_types
  add column if not exists stage text not null default 'FLOOR';

alter table public.requirement_types
  drop constraint if exists requirement_types_stage_check;

alter table public.requirement_types
  add constraint requirement_types_stage_check
  check (stage in ('FLOOR', 'DISPATCH'));

update public.requirement_types
set
  stage = 'DISPATCH',
  label = 'Etiquetas Andreani',
  description = 'Etiquetas del transportista. No traba el picking de bodega.',
  guidance = 'Se carga cuando estén las etiquetas. No bloquea marcar lista.'
where code in ('ETIQUETAS', 'ETIQUETAS_ANDREANI', 'ETIQUETA_ANDREANI');

insert into public.requirement_types (code, label, description, guidance, stage)
select 'ETIQUETAS_TECPETROL', 'Etiquetas Tecpetrol',
  'Etiquetas del cliente. No traba el picking de bodega.',
  'Se carga cuando Tecpetrol entrega las etiquetas.',
  'DISPATCH'
where not exists (select 1 from public.requirement_types where code = 'ETIQUETAS_TECPETROL');

insert into public.requirement_types (code, label, description, guidance, stage)
select 'ETIQUETAS_PLUSPETROL', 'Etiquetas Pluspetrol',
  'Etiquetas del cliente. No traba el picking de bodega.',
  'Se carga cuando Pluspetrol entrega las etiquetas.',
  'DISPATCH'
where not exists (select 1 from public.requirement_types where code = 'ETIQUETAS_PLUSPETROL');

insert into public.template_requirements (template_id, requirement_type_id, required, applicable, display_order)
select t.id, r.id, true, true, 70
from public.delivery_templates t
join public.requirement_types r on r.code = 'ETIQUETAS'
where t.modality = 'ANDREANI'
  and not exists (
    select 1 from public.template_requirements tr
    where tr.template_id = t.id and tr.requirement_type_id = r.id
  );

insert into public.template_requirements (template_id, requirement_type_id, required, applicable, display_order)
select t.id, r.id, true, false, 80
from public.delivery_templates t
join public.requirement_types r on r.code = 'ETIQUETAS_TECPETROL'
where not exists (
  select 1 from public.template_requirements tr
  where tr.template_id = t.id and tr.requirement_type_id = r.id
);

insert into public.template_requirements (template_id, requirement_type_id, required, applicable, display_order)
select t.id, r.id, true, false, 90
from public.delivery_templates t
join public.requirement_types r on r.code = 'ETIQUETAS_PLUSPETROL'
where not exists (
  select 1 from public.template_requirements tr
  where tr.template_id = t.id and tr.requirement_type_id = r.id
);

-- Entregas abiertas de Tecpetrol / Pluspetrol: sumar la etiqueta de despacho.
insert into public.delivery_requirements (
  delivery_id, requirement_type_id, label, required, applicable, status, display_order
)
select d.id, r.id, r.label, true, true, 'PENDING', 80
from public.deliveries d
join public.clients c on c.id = d.client_id
join public.requirement_types r on r.code = 'ETIQUETAS_TECPETROL'
where d.deleted_at is null
  and d.status not in ('CLOSED', 'DRAFT')
  and c.name ilike '%tecpetrol%'
  and not exists (
    select 1 from public.delivery_requirements x
    where x.delivery_id = d.id and x.requirement_type_id = r.id
  );

insert into public.delivery_requirements (
  delivery_id, requirement_type_id, label, required, applicable, status, display_order
)
select d.id, r.id, r.label, true, true, 'PENDING', 90
from public.deliveries d
join public.clients c on c.id = d.client_id
join public.requirement_types r on r.code = 'ETIQUETAS_PLUSPETROL'
where d.deleted_at is null
  and d.status not in ('CLOSED', 'DRAFT')
  and c.name ilike '%pluspetrol%'
  and not exists (
    select 1 from public.delivery_requirements x
    where x.delivery_id = d.id and x.requirement_type_id = r.id
  );

alter table public.evidences
  add column if not exists review_markup jsonb;

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
  pending_floor integer;
  pending_all integer;
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
    select count(*) into pending_floor
    from public.delivery_requirements r
    join public.requirement_types t on t.id = r.requirement_type_id
    where r.delivery_id = p_delivery_id
      and r.required and r.applicable and r.status <> 'COMPLETE'
      and coalesce(t.stage, 'FLOOR') = 'FLOOR';
    if pending_floor > 0 then raise exception 'Todavía faltan fotos de bodega'; end if;
  elsif p_next_status = 'CLOSED' then
    if actor_role <> 'ADMIN' or p_expected_status <> 'READY' then
      raise exception 'Sólo Administración puede cerrar una entrega lista';
    end if;
    if current_row.has_open_observation then
      raise exception 'Resolvé la observación abierta antes de cerrar';
    end if;
    select count(*) into pending_all
    from public.delivery_requirements r
    where r.delivery_id = p_delivery_id
      and r.required and r.applicable and r.status <> 'COMPLETE';
    if pending_all > 0 then raise exception 'Faltan etiquetas u otras fotos obligatorias para cerrar'; end if;
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
  pending_floor integer;
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

  select count(*) into pending_floor
  from public.delivery_requirements r
  join public.requirement_types t on t.id = r.requirement_type_id
  where r.delivery_id = delivery_row.id
    and r.required and r.applicable and r.status <> 'COMPLETE'
    and coalesce(t.stage, 'FLOOR') = 'FLOOR';
  if delivery_row.status = 'READY' and pending_floor > 0 then
    update public.deliveries set status = 'IN_PICKING' where id = delivery_row.id;
    insert into public.audit_events (delivery_id, actor_id, action, metadata, before, after)
    values (target_delivery_id, actor_id, 'RETURNED',
      jsonb_build_object('reason', trim(p_reason), 'evidenceId', p_evidence_id, 'kind', 'EVIDENCE_VOIDED'),
      jsonb_build_object('status', 'READY'), jsonb_build_object('status', 'IN_PICKING'));
  end if;
  return target_delivery_id;
end;
$$;

create or replace function public.review_evidence(
  p_evidence_id uuid,
  p_decision text,
  p_note text default null,
  p_markup jsonb default null
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
      review_note = nullif(trim(coalesce(p_note, '')), ''),
      review_markup = case when p_decision = 'REJECTED' then p_markup else null end
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
