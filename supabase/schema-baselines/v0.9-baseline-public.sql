


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."audit_action" AS ENUM (
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
    'REOPENED',
    'RETURNED',
    'CLAIMED',
    'REASSIGNED',
    'EVIDENCE_REVIEWED'
);


ALTER TYPE "public"."audit_action" OWNER TO "postgres";


CREATE TYPE "public"."delivery_modality" AS ENUM (
    'ANDREANI',
    'CUSTOMER_PICKUP'
);


ALTER TYPE "public"."delivery_modality" OWNER TO "postgres";


CREATE TYPE "public"."delivery_priority" AS ENUM (
    'NORMAL',
    'HIGH',
    'URGENT'
);


ALTER TYPE "public"."delivery_priority" OWNER TO "postgres";


CREATE TYPE "public"."delivery_status" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'IN_PICKING',
    'READY',
    'CLOSED'
);


ALTER TYPE "public"."delivery_status" OWNER TO "postgres";


CREATE TYPE "public"."requirement_status" AS ENUM (
    'PENDING',
    'COMPLETE'
);


ALTER TYPE "public"."requirement_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'ADMIN',
    'PICKING',
    'SUPERVISOR'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_delivery"("p_delivery_id" "uuid", "p_confirm_number" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."archive_delivery"("p_delivery_id" "uuid", "p_confirm_number" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_delivery"("p_delivery_id" "uuid", "p_expected_assignee" "uuid", "p_next_assignee" "uuid", "p_action" "public"."audit_action") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."assign_delivery"("p_delivery_id" "uuid", "p_expected_assignee" "uuid", "p_next_assignee" "uuid", "p_action" "public"."audit_action") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_assign_pallet"("p_delivery_ids" "uuid"[], "p_pallet_code" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."bulk_assign_pallet"("p_delivery_ids" "uuid"[], "p_pallet_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_assign_picker"("p_delivery_ids" "uuid"[], "p_assignee_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_count integer := 0;
  v_delivery_id uuid;
  v_user_role text;
  v_user_id uuid;
  v_picker_name text := 'Sin asignar';
begin
  v_user_role := public.current_role();
  v_user_id := auth.uid();

  if v_user_role not in ('ADMIN', 'SUPERVISOR') then
    raise exception 'No autorizado para asignar responsables en lote';
  end if;

  if p_assignee_id is not null then
    select full_name into v_picker_name from public.profiles where id = p_assignee_id;
  end if;

  foreach v_delivery_id in array p_delivery_ids
  loop
    update public.deliveries
    set
      assignee_id = p_assignee_id,
      updated_at = now()
    where id = v_delivery_id
      and deleted_at is null;

    if found then
      v_count := v_count + 1;
      insert into public.audit_events (delivery_id, actor_id, action, metadata)
      values (
        v_delivery_id,
        v_user_id,
        'ASSIGNED',
        jsonb_build_object(
          'assignee_id', p_assignee_id,
          'assignee_name', v_picker_name,
          'bulk', true
        )
      );
    end if;
  end loop;

  return v_count;
end;
$$;


ALTER FUNCTION "public"."bulk_assign_picker"("p_delivery_ids" "uuid"[], "p_assignee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_assign_unassigned"("p_assignee_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."bulk_assign_unassigned"("p_assignee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_close_ready_deliveries"("p_reason" "text", "p_confirmation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor_id uuid := auth.uid();
  actor_role public.user_role;
  row_record public.deliveries%rowtype;
  closed_count integer := 0;
  total_candidates integer := 0;
  normalized_reason text := trim(coalesce(p_reason, ''));
begin
  select role into actor_role
  from public.profiles
  where id = actor_id and active;

  if actor_role <> 'ADMIN' then
    raise exception 'Sólo Admin puede usar el cierre excepcional';
  end if;

  if p_confirmation <> 'CERRAR TODAS' then
    raise exception 'Confirmación inválida';
  end if;

  if length(normalized_reason) < 5 then
    raise exception 'Escribí un motivo de al menos 5 caracteres';
  end if;

  select count(*) into total_candidates
  from public.deliveries d
  where d.deleted_at is null
    and d.status <> 'CLOSED';

  for row_record in
    select d.*
    from public.deliveries d
    where d.deleted_at is null
      and d.status <> 'CLOSED'
    order by d.updated_at asc
    for update
  loop
    update public.deliveries
    set status = 'CLOSED',
        closed_at = now(),
        closed_by = actor_id
    where id = row_record.id
      and deleted_at is null
      and status <> 'CLOSED';

    if found then
      closed_count := closed_count + 1;

      insert into public.audit_events (delivery_id, actor_id, action, metadata, before, after)
      values (
        row_record.id,
        actor_id,
        'CLOSED',
        jsonb_build_object(
          'exceptional', true,
          'bulk', true,
          'forced', true,
          'reason', normalized_reason,
          'confirmation', p_confirmation,
          'bypassedStatusRules', true,
          'bypassedPendingRequirements', true,
          'bypassedOpenObservations', true
        ),
        jsonb_build_object('status', row_record.status),
        jsonb_build_object('status', 'CLOSED')
      );
    end if;
  end loop;

  return jsonb_build_object(
    'totalCandidates', total_candidates,
    'closedCount', closed_count,
    'skippedCount', total_candidates - closed_count
  );
end;
$$;


ALTER FUNCTION "public"."bulk_close_ready_deliveries"("p_reason" "text", "p_confirmation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_delivery"("target_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.deliveries d
    where d.id = target_id
      and (
        public.current_role() in ('ADMIN', 'SUPERVISOR')
        or (public.current_role() = 'PICKING' and d.status <> 'DRAFT')
      )
  )
$$;


ALTER FUNCTION "public"."can_read_delivery"("target_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_role"() RETURNS "public"."user_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select role
  from public.profiles
  where id = (select auth.uid())
    and active
    and deleted_at is null
$$;


ALTER FUNCTION "public"."current_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_kpis"() RETURNS TABLE("active" bigint, "picking" bigint, "ready" bigint, "observations" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select
    count(*) filter (where status not in ('CLOSED', 'DRAFT')) as active,
    count(*) filter (where status = 'IN_PICKING') as picking,
    count(*) filter (where status = 'READY') as ready,
    count(*) filter (where has_open_observation and status <> 'CLOSED') as observations
  from public.deliveries
  where deleted_at is null;
$$;


ALTER FUNCTION "public"."dashboard_kpis"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."day_report"("p_date" "date") RETURNS TABLE("published" bigint, "ready" bigint, "closed" bigint, "urgent_open" bigint, "observations" bigint, "avg_first_photo_minutes" integer, "avg_ready_to_close_minutes" integer, "avg_warehouse_lead_minutes" integer, "open_ids" "uuid"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with bounds as (
    select
      (p_date::timestamp at time zone 'America/Argentina/Buenos_Aires') as starts_at,
      ((p_date + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires') as ends_at
  ),
  status_events as (
    select
      a.delivery_id,
      a.created_at,
      coalesce(
        a.after->>'status',
        case a.action
          when 'PUBLISHED' then 'PUBLISHED'
          when 'PICKING_STARTED' then 'IN_PICKING'
          when 'READY' then 'READY'
          when 'CLOSED' then 'CLOSED'
          when 'REOPENED' then 'IN_PICKING'
          when 'RETURNED' then 'IN_PICKING'
          else null
        end
      ) as status_after
    from public.audit_events a, bounds b
    where a.created_at < b.ends_at
      and a.action in ('PUBLISHED', 'PICKING_STARTED', 'READY', 'CLOSED', 'REOPENED', 'RETURNED')
  ),
  latest_status as (
    select distinct on (delivery_id) delivery_id, status_after
    from status_events
    where status_after is not null
    order by delivery_id, created_at desc
  ),
  open_at_end as (
    select l.delivery_id
    from latest_status l
    join public.deliveries d on d.id = l.delivery_id
    where l.status_after not in ('DRAFT', 'CLOSED')
      and (d.deleted_at is null or d.deleted_at >= (select ends_at from bounds))
  ),
  event_counts as (
    select
      count(*) filter (where a.action = 'PUBLISHED') as published,
      count(*) filter (where a.action = 'READY') as ready,
      count(*) filter (where a.action = 'CLOSED') as closed
    from public.audit_events a, bounds b
    where a.created_at >= b.starts_at and a.created_at < b.ends_at
  ),
  latest_observation as (
    select distinct on (a.delivery_id)
      a.delivery_id,
      a.action
    from public.audit_events a, bounds b
    where a.created_at < b.ends_at
      and a.action in ('OBSERVATION_ADDED', 'OBSERVATION_RESOLVED', 'RETURNED')
    order by a.delivery_id, a.created_at desc
  ),
  published_events as (
    select a.delivery_id, a.created_at
    from public.audit_events a, bounds b
    where a.action = 'PUBLISHED'
      and a.created_at >= b.starts_at and a.created_at < b.ends_at
  ),
  first_photo as (
    select p.delivery_id, p.created_at as published_at, min(e.created_at) as photo_at
    from published_events p
    left join public.delivery_requirements r on r.delivery_id = p.delivery_id
    left join public.evidences e on e.requirement_id = r.id and e.voided_at is null
    group by p.delivery_id, p.created_at
  ),
  warehouse_completion as (
    select
      p.delivery_id,
      p.created_at as published_at,
      max(e.created_at) as warehouse_done_at
    from published_events p
    join public.delivery_requirements r on r.delivery_id = p.delivery_id
    join public.requirement_types t on t.id = r.requirement_type_id
    join public.evidences e on e.requirement_id = r.id and e.voided_at is null
    where t.code not in ('ETIQUETA_ANDREANI', 'PACKING_LIST')
      and r.applicable = true
    group by p.delivery_id, p.created_at
  ),
  closed_events as (
    select a.delivery_id, a.created_at as closed_at,
      (
        select max(r.created_at)
        from public.audit_events r
        where r.delivery_id = a.delivery_id and r.action = 'READY' and r.created_at <= a.created_at
      ) as ready_at
    from public.audit_events a, bounds b
    where a.action = 'CLOSED'
      and a.created_at >= b.starts_at and a.created_at < b.ends_at
  )
  select
    c.published,
    c.ready,
    c.closed,
    (select count(*) from open_at_end o join public.deliveries d on d.id = o.delivery_id where d.priority = 'URGENT'),
    (select count(*) from latest_observation o join open_at_end x on x.delivery_id = o.delivery_id where o.action in ('OBSERVATION_ADDED', 'RETURNED')),
    (select round(avg(extract(epoch from (photo_at - published_at)) / 60))::integer from first_photo where photo_at is not null and photo_at >= published_at),
    (select round(avg(extract(epoch from (closed_at - ready_at)) / 60))::integer from closed_events where ready_at is not null),
    (select round(avg(extract(epoch from (warehouse_done_at - published_at)) / 60))::integer from warehouse_completion where warehouse_done_at is not null and warehouse_done_at >= published_at),
    coalesce((select array_agg(delivery_id) from open_at_end), array[]::uuid[])
  from event_counts c
  where public.current_role() in ('ADMIN', 'SUPERVISOR')
$$;


ALTER FUNCTION "public"."day_report"("p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_delivery_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."enforce_delivery_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_evidence_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."enforce_evidence_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_requirement_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."enforce_requirement_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_audit_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if auth.uid() is not null then
    raise exception 'El historial de auditoría no se puede modificar';
  end if;
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."prevent_audit_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_observation"("p_delivery_id" "uuid", "p_text" "text", "p_resolve" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."record_observation"("p_delivery_id" "uuid", "p_text" "text", "p_resolve" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_evidence"("p_evidence_id" "uuid", "p_requirement_id" "uuid", "p_storage_key" "text", "p_filename" "text", "p_mime_type" "text", "p_size_bytes" integer, "p_width" integer, "p_height" integer, "p_checksum" "text", "p_comment" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."register_evidence"("p_evidence_id" "uuid", "p_requirement_id" "uuid", "p_storage_key" "text", "p_filename" "text", "p_mime_type" "text", "p_size_bytes" integer, "p_width" integer, "p_height" integer, "p_checksum" "text", "p_comment" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_evidence_v2"("p_evidence_id" "uuid", "p_requirement_id" "uuid", "p_storage_key" "text", "p_filename" "text", "p_mime_type" "text", "p_size_bytes" integer, "p_width" integer, "p_height" integer, "p_checksum" "text", "p_comment" "text", "p_thumbnail_storage_key" "text", "p_thumbnail_mime_type" "text", "p_thumbnail_size_bytes" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  delivery_id uuid;
begin
  delivery_id := public.register_evidence(
    p_evidence_id, p_requirement_id, p_storage_key, p_filename, p_mime_type,
    p_size_bytes, p_width, p_height, p_checksum, p_comment
  );
  update public.evidences set
    thumbnail_storage_key = p_thumbnail_storage_key,
    thumbnail_mime_type = p_thumbnail_mime_type,
    thumbnail_size_bytes = p_thumbnail_size_bytes
  where id = p_evidence_id;
  return delivery_id;
end;
$$;


ALTER FUNCTION "public"."register_evidence_v2"("p_evidence_id" "uuid", "p_requirement_id" "uuid", "p_storage_key" "text", "p_filename" "text", "p_mime_type" "text", "p_size_bytes" integer, "p_width" integer, "p_height" integer, "p_checksum" "text", "p_comment" "text", "p_thumbnail_storage_key" "text", "p_thumbnail_mime_type" "text", "p_thumbnail_size_bytes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_evidence"("p_evidence_id" "uuid", "p_decision" "text", "p_note" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."review_evidence"("p_evidence_id" "uuid", "p_decision" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_evidence"("p_evidence_id" "uuid", "p_decision" "text", "p_note" "text" DEFAULT NULL::"text", "p_markup" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."review_evidence"("p_evidence_id" "uuid", "p_decision" "text", "p_note" "text", "p_markup" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_delivery"("p_delivery_id" "uuid", "p_expected_status" "public"."delivery_status", "p_number" "text", "p_modality" "public"."delivery_modality", "p_destination" "text", "p_packages" integer, "p_priority" "public"."delivery_priority", "p_assignee_id" "uuid", "p_due_at" timestamp with time zone, "p_observations" "text", "p_intent" "text", "p_requirements" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."save_delivery"("p_delivery_id" "uuid", "p_expected_status" "public"."delivery_status", "p_number" "text", "p_modality" "public"."delivery_modality", "p_destination" "text", "p_packages" integer, "p_priority" "public"."delivery_priority", "p_assignee_id" "uuid", "p_due_at" timestamp with time zone, "p_observations" "text", "p_intent" "text", "p_requirements" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_delivery"("p_delivery_id" "uuid", "p_expected_status" "public"."delivery_status", "p_number" "text", "p_modality" "public"."delivery_modality", "p_destination" "text", "p_packages" integer, "p_priority" "public"."delivery_priority", "p_assignee_id" "uuid", "p_due_at" timestamp with time zone, "p_observations" "text", "p_intent" "text", "p_requirements" "jsonb", "p_client_id" "uuid" DEFAULT NULL::"uuid", "p_pallet_code" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."save_delivery"("p_delivery_id" "uuid", "p_expected_status" "public"."delivery_status", "p_number" "text", "p_modality" "public"."delivery_modality", "p_destination" "text", "p_packages" integer, "p_priority" "public"."delivery_priority", "p_assignee_id" "uuid", "p_due_at" timestamp with time zone, "p_observations" "text", "p_intent" "text", "p_requirements" "jsonb", "p_client_id" "uuid", "p_pallet_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_delivery_template"("p_template_id" "uuid", "p_requirements" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."save_delivery_template"("p_template_id" "uuid", "p_requirements" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_requirement_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."sync_requirement_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_delivery_from_requirement"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  update public.deliveries
    set updated_at = now()
    where id = coalesce(new.delivery_id, old.delivery_id);
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."touch_delivery_from_requirement"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transition_delivery"("p_delivery_id" "uuid", "p_expected_status" "public"."delivery_status", "p_next_status" "public"."delivery_status", "p_action" "public"."audit_action", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."transition_delivery"("p_delivery_id" "uuid", "p_expected_status" "public"."delivery_status", "p_next_status" "public"."delivery_status", "p_action" "public"."audit_action", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."void_evidence"("p_evidence_id" "uuid", "p_reason" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."void_evidence"("p_evidence_id" "uuid", "p_reason" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "delivery_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "action" "public"."audit_action" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "before" "jsonb",
    "after" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "number" "text" NOT NULL,
    "modality" "public"."delivery_modality" NOT NULL,
    "destination" "text" NOT NULL,
    "packages" integer NOT NULL,
    "priority" "public"."delivery_priority" DEFAULT 'NORMAL'::"public"."delivery_priority" NOT NULL,
    "status" "public"."delivery_status" DEFAULT 'DRAFT'::"public"."delivery_status" NOT NULL,
    "assignee_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "observations" "text",
    "has_open_observation" boolean DEFAULT false NOT NULL,
    "published_at" timestamp with time zone,
    "ready_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "closed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "due_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "client_id" "uuid",
    "pallet_code" "text",
    CONSTRAINT "deliveries_packages_check" CHECK (("packages" > 0))
);


ALTER TABLE "public"."deliveries" OWNER TO "postgres";


COMMENT ON COLUMN "public"."deliveries"."due_at" IS 'Campo legado. La operación actual no utiliza fecha ni hora comprometida.';



CREATE TABLE IF NOT EXISTS "public"."delivery_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "delivery_id" "uuid" NOT NULL,
    "requirement_type_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "required" boolean DEFAULT true NOT NULL,
    "applicable" boolean DEFAULT true NOT NULL,
    "status" "public"."requirement_status" DEFAULT 'PENDING'::"public"."requirement_status" NOT NULL,
    "display_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."delivery_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "modality" "public"."delivery_modality" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."delivery_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."destination_presets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "destination" "text" NOT NULL,
    "modality" "public"."delivery_modality" NOT NULL,
    "packages" integer,
    "default_assignee_id" "uuid",
    "requirement_overrides" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."destination_presets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evidences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requirement_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'SUPABASE'::"text" NOT NULL,
    "storage_key" "text" NOT NULL,
    "filename" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "size_bytes" integer NOT NULL,
    "width" integer,
    "height" integer,
    "checksum" "text",
    "comment" "text",
    "uploader_id" "uuid" NOT NULL,
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "void_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "review_status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "review_note" "text",
    "thumbnail_storage_key" "text",
    "thumbnail_mime_type" "text",
    "thumbnail_size_bytes" integer,
    "review_markup" "jsonb",
    CONSTRAINT "evidences_review_status_check" CHECK (("review_status" = ANY (ARRAY['PENDING'::"text", 'ACCEPTED'::"text", 'REJECTED'::"text"]))),
    CONSTRAINT "evidences_size_bytes_check" CHECK (("size_bytes" > 0))
);


ALTER TABLE "public"."evidences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'PICKING'::"public"."user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "disabled_at" timestamp with time zone,
    "must_change_password" boolean DEFAULT true NOT NULL,
    "password_changed_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."must_change_password" IS 'Obliga a reemplazar la contraseña temporal antes de usar la aplicación.';



COMMENT ON COLUMN "public"."profiles"."password_changed_at" IS 'Fecha del último cambio de contraseña confirmado desde la aplicación.';



COMMENT ON COLUMN "public"."profiles"."deleted_at" IS 'Fecha en que se eliminó la cuenta de acceso. El perfil se conserva para atribución histórica.';



COMMENT ON COLUMN "public"."profiles"."deleted_by" IS 'Administrador que eliminó la cuenta de acceso.';



CREATE TABLE IF NOT EXISTS "public"."requirement_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "guidance" "text",
    "stage" "text" DEFAULT 'FLOOR'::"text" NOT NULL,
    CONSTRAINT "requirement_types_stage_check" CHECK (("stage" = ANY (ARRAY['FLOOR'::"text", 'DISPATCH'::"text"])))
);


ALTER TABLE "public"."requirement_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."template_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "requirement_type_id" "uuid" NOT NULL,
    "required" boolean DEFAULT true NOT NULL,
    "applicable" boolean DEFAULT true NOT NULL,
    "display_order" integer NOT NULL
);


ALTER TABLE "public"."template_requirements" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_events"
    ADD CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_number_unique" UNIQUE ("number");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_requirements"
    ADD CONSTRAINT "delivery_requirements_delivery_id_requirement_type_id_key" UNIQUE ("delivery_id", "requirement_type_id");



ALTER TABLE ONLY "public"."delivery_requirements"
    ADD CONSTRAINT "delivery_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_templates"
    ADD CONSTRAINT "delivery_templates_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."delivery_templates"
    ADD CONSTRAINT "delivery_templates_modality_key" UNIQUE ("modality");



ALTER TABLE ONLY "public"."delivery_templates"
    ADD CONSTRAINT "delivery_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."destination_presets"
    ADD CONSTRAINT "destination_presets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evidences"
    ADD CONSTRAINT "evidences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."requirement_types"
    ADD CONSTRAINT "requirement_types_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."requirement_types"
    ADD CONSTRAINT "requirement_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_requirements"
    ADD CONSTRAINT "template_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_requirements"
    ADD CONSTRAINT "template_requirements_template_id_requirement_type_id_key" UNIQUE ("template_id", "requirement_type_id");



CREATE INDEX "audit_events_action_idx" ON "public"."audit_events" USING "btree" ("action");



CREATE INDEX "audit_events_delivery_idx" ON "public"."audit_events" USING "btree" ("delivery_id", "created_at");



CREATE INDEX "clients_active_idx" ON "public"."clients" USING "btree" ("active");



CREATE UNIQUE INDEX "clients_name_ci" ON "public"."clients" USING "btree" ("lower"("name"));



CREATE INDEX "deliveries_active_status_idx" ON "public"."deliveries" USING "btree" ("status", "updated_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "deliveries_assignee_idx" ON "public"."deliveries" USING "btree" ("assignee_id");



CREATE INDEX "deliveries_client_idx" ON "public"."deliveries" USING "btree" ("client_id");



CREATE INDEX "deliveries_created_at_idx" ON "public"."deliveries" USING "btree" ("created_at" DESC);



CREATE INDEX "deliveries_destination_trgm_idx" ON "public"."deliveries" USING "gin" ("destination" "public"."gin_trgm_ops") WHERE ("deleted_at" IS NULL);



CREATE INDEX "deliveries_modality_idx" ON "public"."deliveries" USING "btree" ("modality");



CREATE UNIQUE INDEX "deliveries_number_ci" ON "public"."deliveries" USING "btree" ("lower"("number"));



CREATE INDEX "deliveries_number_lookup_idx" ON "public"."deliveries" USING "btree" ("number") WHERE ("deleted_at" IS NULL);



CREATE INDEX "deliveries_number_trgm_idx" ON "public"."deliveries" USING "gin" ("number" "public"."gin_trgm_ops") WHERE ("deleted_at" IS NULL);



CREATE INDEX "deliveries_observation_idx" ON "public"."deliveries" USING "btree" ("has_open_observation") WHERE ("has_open_observation" = true);



CREATE INDEX "deliveries_pallet_code_idx" ON "public"."deliveries" USING "btree" ("lower"("pallet_code"));



CREATE INDEX "deliveries_pallet_trgm_idx" ON "public"."deliveries" USING "gin" ("pallet_code" "public"."gin_trgm_ops") WHERE (("deleted_at" IS NULL) AND ("pallet_code" IS NOT NULL));



CREATE INDEX "deliveries_priority_idx" ON "public"."deliveries" USING "btree" ("priority");



CREATE INDEX "deliveries_status_idx" ON "public"."deliveries" USING "btree" ("status");



CREATE INDEX "deliveries_updated_at_idx" ON "public"."deliveries" USING "btree" ("updated_at" DESC);



CREATE INDEX "delivery_requirements_delivery_idx" ON "public"."delivery_requirements" USING "btree" ("delivery_id", "display_order");



CREATE INDEX "evidences_active_idx" ON "public"."evidences" USING "btree" ("requirement_id") WHERE ("voided_at" IS NULL);



CREATE INDEX "evidences_requirement_idx" ON "public"."evidences" USING "btree" ("requirement_id");



CREATE INDEX "idx_audit_events_delivery_created" ON "public"."audit_events" USING "btree" ("delivery_id", "created_at");



CREATE INDEX "idx_deliveries_client_id" ON "public"."deliveries" USING "btree" ("client_id");



CREATE INDEX "idx_deliveries_pallet_code" ON "public"."deliveries" USING "btree" ("pallet_code");



CREATE INDEX "idx_deliveries_status_priority" ON "public"."deliveries" USING "btree" ("status", "priority");



CREATE INDEX "idx_evidences_req_active" ON "public"."evidences" USING "btree" ("requirement_id") WHERE ("voided_at" IS NULL);



CREATE INDEX "profiles_active_picking_idx" ON "public"."profiles" USING "btree" ("full_name") WHERE ("active" AND ("role" = 'PICKING'::"public"."user_role"));



CREATE INDEX "profiles_deleted_by_idx" ON "public"."profiles" USING "btree" ("deleted_by") WHERE ("deleted_by" IS NOT NULL);



CREATE OR REPLACE TRIGGER "audit_events_no_update" BEFORE DELETE OR UPDATE ON "public"."audit_events" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_audit_mutation"();



CREATE OR REPLACE TRIGGER "clients_set_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "deliveries_enforce_update" BEFORE UPDATE ON "public"."deliveries" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_delivery_update"();



CREATE OR REPLACE TRIGGER "deliveries_set_updated_at" BEFORE UPDATE ON "public"."deliveries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "delivery_requirements_enforce" BEFORE INSERT OR DELETE OR UPDATE ON "public"."delivery_requirements" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_requirement_mutation"();



CREATE OR REPLACE TRIGGER "delivery_requirements_set_updated_at" BEFORE UPDATE ON "public"."delivery_requirements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "delivery_requirements_touch_delivery" AFTER INSERT OR DELETE OR UPDATE ON "public"."delivery_requirements" FOR EACH ROW EXECUTE FUNCTION "public"."touch_delivery_from_requirement"();



CREATE OR REPLACE TRIGGER "evidences_enforce_update" BEFORE UPDATE ON "public"."evidences" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_evidence_update"();



CREATE OR REPLACE TRIGGER "evidences_sync_requirement" AFTER INSERT OR DELETE OR UPDATE ON "public"."evidences" FOR EACH ROW EXECUTE FUNCTION "public"."sync_requirement_status"();



CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."audit_events"
    ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."audit_events"
    ADD CONSTRAINT "audit_events_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."delivery_requirements"
    ADD CONSTRAINT "delivery_requirements_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_requirements"
    ADD CONSTRAINT "delivery_requirements_requirement_type_id_fkey" FOREIGN KEY ("requirement_type_id") REFERENCES "public"."requirement_types"("id");



ALTER TABLE ONLY "public"."destination_presets"
    ADD CONSTRAINT "destination_presets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."destination_presets"
    ADD CONSTRAINT "destination_presets_default_assignee_id_fkey" FOREIGN KEY ("default_assignee_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."evidences"
    ADD CONSTRAINT "evidences_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "public"."delivery_requirements"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."evidences"
    ADD CONSTRAINT "evidences_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."evidences"
    ADD CONSTRAINT "evidences_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."template_requirements"
    ADD CONSTRAINT "template_requirements_requirement_type_id_fkey" FOREIGN KEY ("requirement_type_id") REFERENCES "public"."requirement_types"("id");



ALTER TABLE ONLY "public"."template_requirements"
    ADD CONSTRAINT "template_requirements_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."delivery_templates"("id") ON DELETE CASCADE;



ALTER TABLE "public"."audit_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_insert" ON "public"."audit_events" FOR INSERT TO "authenticated" WITH CHECK (("public"."can_read_delivery"("delivery_id") OR (("public"."current_role"() = 'ADMIN'::"public"."user_role") AND (EXISTS ( SELECT 1
   FROM "public"."deliveries" "d"
  WHERE ("d"."id" = "audit_events"."delivery_id"))))));



CREATE POLICY "audit_select" ON "public"."audit_events" FOR SELECT TO "authenticated" USING ("public"."can_read_delivery"("delivery_id"));



CREATE POLICY "catalog_admin_template_requirements" ON "public"."template_requirements" TO "authenticated" USING (("public"."current_role"() = 'ADMIN'::"public"."user_role")) WITH CHECK (("public"."current_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "catalog_admin_templates" ON "public"."delivery_templates" TO "authenticated" USING (("public"."current_role"() = 'ADMIN'::"public"."user_role")) WITH CHECK (("public"."current_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "catalog_admin_types" ON "public"."requirement_types" TO "authenticated" USING (("public"."current_role"() = 'ADMIN'::"public"."user_role")) WITH CHECK (("public"."current_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "catalog_read_template_requirements" ON "public"."template_requirements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "catalog_read_templates" ON "public"."delivery_templates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "catalog_read_types" ON "public"."requirement_types" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_admin_write" ON "public"."clients" TO "authenticated" USING (("public"."current_role"() = 'ADMIN'::"public"."user_role")) WITH CHECK (("public"."current_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "clients_select" ON "public"."clients" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."deliveries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deliveries_delete_admin" ON "public"."deliveries" FOR DELETE TO "authenticated" USING (("public"."current_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "deliveries_insert_admin" ON "public"."deliveries" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "deliveries_select" ON "public"."deliveries" FOR SELECT TO "authenticated" USING ((("public"."current_role"() = ANY (ARRAY['ADMIN'::"public"."user_role", 'SUPERVISOR'::"public"."user_role"])) OR (("public"."current_role"() = 'PICKING'::"public"."user_role") AND ("status" <> 'DRAFT'::"public"."delivery_status"))));



CREATE POLICY "deliveries_update" ON "public"."deliveries" FOR UPDATE TO "authenticated" USING ((("public"."current_role"() = 'ADMIN'::"public"."user_role") OR (("public"."current_role"() = 'PICKING'::"public"."user_role") AND ("status" <> 'DRAFT'::"public"."delivery_status") AND ("status" <> 'CLOSED'::"public"."delivery_status")))) WITH CHECK ((("public"."current_role"() = 'ADMIN'::"public"."user_role") OR (("public"."current_role"() = 'PICKING'::"public"."user_role") AND ("status" <> 'DRAFT'::"public"."delivery_status") AND ("status" <> 'CLOSED'::"public"."delivery_status"))));



ALTER TABLE "public"."delivery_requirements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delivery_requirements_admin_write" ON "public"."delivery_requirements" TO "authenticated" USING (("public"."current_role"() = 'ADMIN'::"public"."user_role")) WITH CHECK (("public"."current_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "delivery_requirements_select" ON "public"."delivery_requirements" FOR SELECT TO "authenticated" USING ("public"."can_read_delivery"("delivery_id"));



ALTER TABLE "public"."delivery_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."destination_presets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "destination_presets_admin" ON "public"."destination_presets" TO "authenticated" USING (("public"."current_role"() = 'ADMIN'::"public"."user_role")) WITH CHECK (("public"."current_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "destination_presets_select" ON "public"."destination_presets" FOR SELECT TO "authenticated" USING (("public"."current_role"() = ANY (ARRAY['ADMIN'::"public"."user_role", 'SUPERVISOR'::"public"."user_role"])));



ALTER TABLE "public"."evidences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evidences_delete_admin" ON "public"."evidences" FOR DELETE TO "authenticated" USING (("public"."current_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "evidences_insert" ON "public"."evidences" FOR INSERT TO "authenticated" WITH CHECK ((("uploader_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."delivery_requirements" "r"
     JOIN "public"."deliveries" "d" ON (("d"."id" = "r"."delivery_id")))
  WHERE (("r"."id" = "evidences"."requirement_id") AND "public"."can_read_delivery"("d"."id") AND ("d"."status" <> 'CLOSED'::"public"."delivery_status") AND ("d"."status" <> 'DRAFT'::"public"."delivery_status"))))));



CREATE POLICY "evidences_select" ON "public"."evidences" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."delivery_requirements" "r"
  WHERE (("r"."id" = "evidences"."requirement_id") AND "public"."can_read_delivery"("r"."delivery_id")))));



CREATE POLICY "evidences_update_void" ON "public"."evidences" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."delivery_requirements" "r"
     JOIN "public"."deliveries" "d" ON (("d"."id" = "r"."delivery_id")))
  WHERE (("r"."id" = "evidences"."requirement_id") AND "public"."can_read_delivery"("d"."id") AND ("d"."status" <> 'CLOSED'::"public"."delivery_status"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."delivery_requirements" "r"
     JOIN "public"."deliveries" "d" ON (("d"."id" = "r"."delivery_id")))
  WHERE (("r"."id" = "evidences"."requirement_id") AND "public"."can_read_delivery"("d"."id") AND ("d"."status" <> 'CLOSED'::"public"."delivery_status")))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."requirement_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."template_requirements" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."archive_delivery"("p_delivery_id" "uuid", "p_confirm_number" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."archive_delivery"("p_delivery_id" "uuid", "p_confirm_number" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_delivery"("p_delivery_id" "uuid", "p_confirm_number" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_delivery"("p_delivery_id" "uuid", "p_expected_assignee" "uuid", "p_next_assignee" "uuid", "p_action" "public"."audit_action") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_delivery"("p_delivery_id" "uuid", "p_expected_assignee" "uuid", "p_next_assignee" "uuid", "p_action" "public"."audit_action") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_delivery"("p_delivery_id" "uuid", "p_expected_assignee" "uuid", "p_next_assignee" "uuid", "p_action" "public"."audit_action") TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_assign_pallet"("p_delivery_ids" "uuid"[], "p_pallet_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_assign_pallet"("p_delivery_ids" "uuid"[], "p_pallet_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_assign_pallet"("p_delivery_ids" "uuid"[], "p_pallet_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_assign_picker"("p_delivery_ids" "uuid"[], "p_assignee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_assign_picker"("p_delivery_ids" "uuid"[], "p_assignee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_assign_picker"("p_delivery_ids" "uuid"[], "p_assignee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_assign_unassigned"("p_assignee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_assign_unassigned"("p_assignee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_assign_unassigned"("p_assignee_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bulk_close_ready_deliveries"("p_reason" "text", "p_confirmation" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bulk_close_ready_deliveries"("p_reason" "text", "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_close_ready_deliveries"("p_reason" "text", "p_confirmation" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_read_delivery"("target_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_read_delivery"("target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_read_delivery"("target_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."dashboard_kpis"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dashboard_kpis"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_kpis"() TO "service_role";



GRANT ALL ON FUNCTION "public"."day_report"("p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."day_report"("p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."day_report"("p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_delivery_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_delivery_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_delivery_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_evidence_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_evidence_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_evidence_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_requirement_mutation"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_requirement_mutation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_requirement_mutation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_audit_mutation"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_audit_mutation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_audit_mutation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_observation"("p_delivery_id" "uuid", "p_text" "text", "p_resolve" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."record_observation"("p_delivery_id" "uuid", "p_text" "text", "p_resolve" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_observation"("p_delivery_id" "uuid", "p_text" "text", "p_resolve" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."register_evidence"("p_evidence_id" "uuid", "p_requirement_id" "uuid", "p_storage_key" "text", "p_filename" "text", "p_mime_type" "text", "p_size_bytes" integer, "p_width" integer, "p_height" integer, "p_checksum" "text", "p_comment" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."register_evidence"("p_evidence_id" "uuid", "p_requirement_id" "uuid", "p_storage_key" "text", "p_filename" "text", "p_mime_type" "text", "p_size_bytes" integer, "p_width" integer, "p_height" integer, "p_checksum" "text", "p_comment" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_evidence"("p_evidence_id" "uuid", "p_requirement_id" "uuid", "p_storage_key" "text", "p_filename" "text", "p_mime_type" "text", "p_size_bytes" integer, "p_width" integer, "p_height" integer, "p_checksum" "text", "p_comment" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."register_evidence_v2"("p_evidence_id" "uuid", "p_requirement_id" "uuid", "p_storage_key" "text", "p_filename" "text", "p_mime_type" "text", "p_size_bytes" integer, "p_width" integer, "p_height" integer, "p_checksum" "text", "p_comment" "text", "p_thumbnail_storage_key" "text", "p_thumbnail_mime_type" "text", "p_thumbnail_size_bytes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."register_evidence_v2"("p_evidence_id" "uuid", "p_requirement_id" "uuid", "p_storage_key" "text", "p_filename" "text", "p_mime_type" "text", "p_size_bytes" integer, "p_width" integer, "p_height" integer, "p_checksum" "text", "p_comment" "text", "p_thumbnail_storage_key" "text", "p_thumbnail_mime_type" "text", "p_thumbnail_size_bytes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_evidence_v2"("p_evidence_id" "uuid", "p_requirement_id" "uuid", "p_storage_key" "text", "p_filename" "text", "p_mime_type" "text", "p_size_bytes" integer, "p_width" integer, "p_height" integer, "p_checksum" "text", "p_comment" "text", "p_thumbnail_storage_key" "text", "p_thumbnail_mime_type" "text", "p_thumbnail_size_bytes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."review_evidence"("p_evidence_id" "uuid", "p_decision" "text", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."review_evidence"("p_evidence_id" "uuid", "p_decision" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."review_evidence"("p_evidence_id" "uuid", "p_decision" "text", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."review_evidence"("p_evidence_id" "uuid", "p_decision" "text", "p_note" "text", "p_markup" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."review_evidence"("p_evidence_id" "uuid", "p_decision" "text", "p_note" "text", "p_markup" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."review_evidence"("p_evidence_id" "uuid", "p_decision" "text", "p_note" "text", "p_markup" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."save_delivery"("p_delivery_id" "uuid", "p_expected_status" "public"."delivery_status", "p_number" "text", "p_modality" "public"."delivery_modality", "p_destination" "text", "p_packages" integer, "p_priority" "public"."delivery_priority", "p_assignee_id" "uuid", "p_due_at" timestamp with time zone, "p_observations" "text", "p_intent" "text", "p_requirements" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."save_delivery"("p_delivery_id" "uuid", "p_expected_status" "public"."delivery_status", "p_number" "text", "p_modality" "public"."delivery_modality", "p_destination" "text", "p_packages" integer, "p_priority" "public"."delivery_priority", "p_assignee_id" "uuid", "p_due_at" timestamp with time zone, "p_observations" "text", "p_intent" "text", "p_requirements" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_delivery"("p_delivery_id" "uuid", "p_expected_status" "public"."delivery_status", "p_number" "text", "p_modality" "public"."delivery_modality", "p_destination" "text", "p_packages" integer, "p_priority" "public"."delivery_priority", "p_assignee_id" "uuid", "p_due_at" timestamp with time zone, "p_observations" "text", "p_intent" "text", "p_requirements" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."save_delivery"("p_delivery_id" "uuid", "p_expected_status" "public"."delivery_status", "p_number" "text", "p_modality" "public"."delivery_modality", "p_destination" "text", "p_packages" integer, "p_priority" "public"."delivery_priority", "p_assignee_id" "uuid", "p_due_at" timestamp with time zone, "p_observations" "text", "p_intent" "text", "p_requirements" "jsonb", "p_client_id" "uuid", "p_pallet_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."save_delivery"("p_delivery_id" "uuid", "p_expected_status" "public"."delivery_status", "p_number" "text", "p_modality" "public"."delivery_modality", "p_destination" "text", "p_packages" integer, "p_priority" "public"."delivery_priority", "p_assignee_id" "uuid", "p_due_at" timestamp with time zone, "p_observations" "text", "p_intent" "text", "p_requirements" "jsonb", "p_client_id" "uuid", "p_pallet_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_delivery"("p_delivery_id" "uuid", "p_expected_status" "public"."delivery_status", "p_number" "text", "p_modality" "public"."delivery_modality", "p_destination" "text", "p_packages" integer, "p_priority" "public"."delivery_priority", "p_assignee_id" "uuid", "p_due_at" timestamp with time zone, "p_observations" "text", "p_intent" "text", "p_requirements" "jsonb", "p_client_id" "uuid", "p_pallet_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."save_delivery_template"("p_template_id" "uuid", "p_requirements" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."save_delivery_template"("p_template_id" "uuid", "p_requirements" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_delivery_template"("p_template_id" "uuid", "p_requirements" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_requirement_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_requirement_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_requirement_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_delivery_from_requirement"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_delivery_from_requirement"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_delivery_from_requirement"() TO "service_role";



GRANT ALL ON FUNCTION "public"."transition_delivery"("p_delivery_id" "uuid", "p_expected_status" "public"."delivery_status", "p_next_status" "public"."delivery_status", "p_action" "public"."audit_action", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."transition_delivery"("p_delivery_id" "uuid", "p_expected_status" "public"."delivery_status", "p_next_status" "public"."delivery_status", "p_action" "public"."audit_action", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transition_delivery"("p_delivery_id" "uuid", "p_expected_status" "public"."delivery_status", "p_next_status" "public"."delivery_status", "p_action" "public"."audit_action", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."void_evidence"("p_evidence_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."void_evidence"("p_evidence_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."void_evidence"("p_evidence_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON TABLE "public"."audit_events" TO "anon";
GRANT ALL ON TABLE "public"."audit_events" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_events" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."deliveries" TO "anon";
GRANT ALL ON TABLE "public"."deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_requirements" TO "anon";
GRANT ALL ON TABLE "public"."delivery_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_templates" TO "anon";
GRANT ALL ON TABLE "public"."delivery_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_templates" TO "service_role";



GRANT ALL ON TABLE "public"."destination_presets" TO "anon";
GRANT ALL ON TABLE "public"."destination_presets" TO "authenticated";
GRANT ALL ON TABLE "public"."destination_presets" TO "service_role";



GRANT ALL ON TABLE "public"."evidences" TO "anon";
GRANT ALL ON TABLE "public"."evidences" TO "authenticated";
GRANT ALL ON TABLE "public"."evidences" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."requirement_types" TO "anon";
GRANT ALL ON TABLE "public"."requirement_types" TO "authenticated";
GRANT ALL ON TABLE "public"."requirement_types" TO "service_role";



GRANT ALL ON TABLE "public"."template_requirements" TO "anon";
GRANT ALL ON TABLE "public"."template_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."template_requirements" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







